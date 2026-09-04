[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string]$BackupPath,

    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string]$ErasureLedgerPath,

    [ValidateSet('Auto', 'Custom', 'Plain')]
    [string]$BackupFormat = 'Auto',

    [ValidateRange(1, 1440)]
    [int]$MaxRpoMinutes = 15,

    [ValidateRange(1, 24)]
    [int]$MaxRtoHours = 4,

    [string]$ReportPath,

    [string]$PostgresImage = 'postgres:18-alpine@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2',

    [switch]$KeepContainer
)

$ErrorActionPreference = 'Stop'
$containerName = 'skill-maps-restore-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
$resolvedBackup = (Resolve-Path -LiteralPath $BackupPath).Path
$resolvedLedger = (Resolve-Path -LiteralPath $ErasureLedgerPath).Path
$ledgerEntries = @()
foreach ($line in [IO.File]::ReadAllLines($resolvedLedger)) {
    $value = $line.Trim()
    if (-not $value -or $value.StartsWith('#')) { continue }
    $parts = @($value.Split(',') | ForEach-Object { $_.Trim() })
    if ($parts.Count -ne 2) {
        throw 'Each ledger line must contain request_id,user_id.'
    }
    foreach ($identifier in $parts) {
        $parsed = [Guid]::Empty
        if (-not [Guid]::TryParse($identifier, [ref]$parsed)) {
            throw "Invalid UUID in erasure ledger: $identifier"
        }
    }
    $ledgerEntries += [PSCustomObject]@{ RequestId = $parts[0]; UserId = $parts[1] }
}

if ($ledgerEntries.Count -eq 0) {
    throw 'The erasure ledger must contain at least one completed request and user UUID pair.'
}

function Invoke-Docker {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    $output = & docker @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "docker $($Arguments -join ' ') failed: $($output -join [Environment]::NewLine)"
    }
    return $output
}

$startedAt = [DateTimeOffset]::UtcNow
$stopwatch = [Diagnostics.Stopwatch]::StartNew()
$backupInfo = Get-Item -LiteralPath $resolvedBackup
$backupAgeMinutes = ($startedAt - [DateTimeOffset]$backupInfo.LastWriteTimeUtc).TotalMinutes
$containerStarted = $false

try {
    Invoke-Docker @(
        'run', '--detach', '--name', $containerName, '--network', 'none',
        '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', '--env', 'POSTGRES_USER=drill_admin',
        '--env', 'POSTGRES_DB=drill_restore', $PostgresImage
    ) | Out-Null
    $containerStarted = $true

    $ready = $false
    $consecutiveReadyChecks = 0
    for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
        & docker exec $containerName pg_isready --username drill_admin --dbname drill_restore *> $null
        if ($LASTEXITCODE -eq 0) {
            $consecutiveReadyChecks += 1
            if ($consecutiveReadyChecks -ge 3) {
                $ready = $true
                break
            }
        } else {
            $consecutiveReadyChecks = 0
        }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) {
        throw 'Disposable PostgreSQL did not become ready within 60 seconds.'
    }

    Invoke-Docker @('cp', $resolvedBackup, "${containerName}:/tmp/skill-maps-backup") | Out-Null
    $effectiveFormat = if ($BackupFormat -eq 'Auto') {
        if ([IO.Path]::GetExtension($resolvedBackup) -eq '.sql') { 'Plain' } else { 'Custom' }
    } else {
        $BackupFormat
    }
    if ($effectiveFormat -eq 'Plain') {
        Invoke-Docker @(
            'exec', $containerName, 'psql', '--set', 'ON_ERROR_STOP=1', '--username', 'drill_admin',
            '--dbname', 'drill_restore', '--file', '/tmp/skill-maps-backup'
        ) | Out-Null
    } else {
        Invoke-Docker @(
            'exec', $containerName, 'pg_restore', '--exit-on-error', '--no-owner', '--no-privileges',
            '--username', 'drill_admin', '--dbname', 'drill_restore', '/tmp/skill-maps-backup'
        ) | Out-Null
    }

    $ledgerValues = ($ledgerEntries | ForEach-Object {
        "('$($_.RequestId)'::uuid, '$($_.UserId)'::uuid)"
    }) -join ','
    $captureSql = @"
CREATE TABLE restore_erasure_targets (request_id uuid PRIMARY KEY, user_id uuid NOT NULL);
INSERT INTO restore_erasure_targets (request_id, user_id) VALUES $ledgerValues;
UPDATE users
SET status = 'deletion_pending', deletion_requested_at = COALESCE(deletion_requested_at, now())
WHERE id IN (SELECT user_id FROM restore_erasure_targets);
INSERT INTO account_deletion_requests (id, user_id, state)
SELECT targets.request_id, targets.user_id, 'requested'
FROM restore_erasure_targets targets
JOIN users ON users.id = targets.user_id
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id, state = 'requested', completed_at = NULL,
    next_attempt_at = NULL, last_error_code = NULL;
"@
    Invoke-Docker @(
        'exec', $containerName, 'psql', '--set', 'ON_ERROR_STOP=1', '--username', 'drill_admin',
        '--dbname', 'drill_restore', '--command', $captureSql
    ) | Out-Null

    foreach ($entry in $ledgerEntries) {
        $requestId = $entry.RequestId
        $userId = $entry.UserId
        $replay = Invoke-Docker @(
            'exec', $containerName, 'psql', '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1',
            '--username', 'drill_admin', '--dbname', 'drill_restore', '--command',
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM users WHERE id = '$userId'::uuid) THEN complete_account_erasure('$requestId'::uuid) ELSE true END;"
        )
        if (($replay -join '').Trim() -ne 't') {
            throw "Erasure replay did not confirm request $requestId."
        }
    }

    $validationSql = @"
WITH incomplete AS (
  SELECT count(*) AS count
  FROM restore_erasure_targets targets
  LEFT JOIN account_deletion_requests requests ON requests.id = targets.request_id
  WHERE requests.id IS NULL OR requests.state <> 'completed' OR requests.user_id IS NOT NULL
), identifiable AS (
  SELECT id AS user_id FROM users WHERE id IN (SELECT user_id FROM restore_erasure_targets)
  UNION ALL SELECT user_id FROM auth_accounts WHERE user_id IN (SELECT user_id FROM restore_erasure_targets WHERE user_id IS NOT NULL)
  UNION ALL SELECT user_id FROM auth_sessions WHERE user_id IN (SELECT user_id FROM restore_erasure_targets WHERE user_id IS NOT NULL)
  UNION ALL SELECT user_id FROM professional_profiles WHERE user_id IN (SELECT user_id FROM restore_erasure_targets WHERE user_id IS NOT NULL)
  UNION ALL SELECT user_id FROM progress_events WHERE user_id IN (SELECT user_id FROM restore_erasure_targets WHERE user_id IS NOT NULL)
  UNION ALL SELECT user_id FROM user_certification_records WHERE user_id IN (SELECT user_id FROM restore_erasure_targets WHERE user_id IS NOT NULL)
  UNION ALL SELECT user_id FROM user_achievement_awards WHERE user_id IN (SELECT user_id FROM restore_erasure_targets WHERE user_id IS NOT NULL)
  UNION ALL SELECT user_id FROM learning_recommendations WHERE user_id IN (SELECT user_id FROM restore_erasure_targets WHERE user_id IS NOT NULL)
)
SELECT (SELECT count FROM incomplete)::text || ',' || (SELECT count(*) FROM identifiable)::text;
"@
    $validation = Invoke-Docker @(
        'exec', $containerName, 'psql', '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1',
        '--username', 'drill_admin', '--dbname', 'drill_restore', '--command', $validationSql
    )
    $counts = ($validation -join '').Trim().Split(',')
    if ($counts.Count -ne 2 -or $counts[0] -ne '0' -or $counts[1] -ne '0') {
        throw "Restore validation failed: incomplete ledger rows=$($counts[0]), identifiable rows=$($counts[1])."
    }
    Invoke-Docker @(
        'exec', $containerName, 'psql', '--set', 'ON_ERROR_STOP=1', '--username', 'drill_admin',
        '--dbname', 'drill_restore', '--command', 'DROP TABLE restore_erasure_targets;'
    ) | Out-Null

    $stopwatch.Stop()
    $imageId = (Invoke-Docker @('inspect', '--format', '{{.Image}}', $containerName) | Select-Object -Last 1).Trim()
    $report = [ordered]@{
        outcome = 'PASS'
        startedAtUtc = $startedAt.ToString('o')
        completedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
        backupSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedBackup).Hash.ToLowerInvariant()
        backupAgeMinutes = [Math]::Round($backupAgeMinutes, 3)
        maxRpoMinutes = $MaxRpoMinutes
        restoreAndReplaySeconds = [Math]::Round($stopwatch.Elapsed.TotalSeconds, 3)
        maxRtoHours = $MaxRtoHours
        erasureRequestsReplayed = $ledgerEntries.Count
        incompleteLedgerRows = 0
        identifiableRows = 0
        postgresImageId = $imageId
        isolatedNetwork = 'none'
    }
    if ($backupAgeMinutes -gt $MaxRpoMinutes) {
        throw "Backup age $([Math]::Round($backupAgeMinutes, 2)) minutes exceeds RPO $MaxRpoMinutes minutes."
    }
    if ($stopwatch.Elapsed.TotalHours -gt $MaxRtoHours) {
        throw "Restore duration $([Math]::Round($stopwatch.Elapsed.TotalHours, 3)) hours exceeds RTO $MaxRtoHours hours."
    }

    $json = $report | ConvertTo-Json
    if ($ReportPath) {
        $reportParent = Split-Path -Parent $ReportPath
        if ($reportParent -and -not (Test-Path -LiteralPath $reportParent -PathType Container)) {
            throw "Report directory does not exist: $reportParent"
        }
        [IO.File]::WriteAllText([IO.Path]::GetFullPath($ReportPath), $json + [Environment]::NewLine)
    }
    $json
} finally {
    if ($containerStarted -and -not $KeepContainer) {
        & docker rm --force $containerName *> $null
    }
}
