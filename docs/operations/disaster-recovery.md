# Disaster recovery

## Objectives

- Provisional RPO: at most 15 minutes. The backup platform owner must alert when the newest completed,
  restorable backup is older than 15 minutes.
- Provisional RTO: at most 4 hours from incident declaration to a validated service restore.
- A restored database must remain isolated from application traffic until every completed account
  erasure after the backup point has been replayed and validated.

These are release objectives, not evidence that a managed production backup policy already exists.

## Required artifacts

- A PostgreSQL custom-format dump (`pg_dump --format=custom`) or plain SQL dump.
- An encrypted append-only export containing `request_id,user_id` UUID pairs, one completed erasure per
  line. The user UUID is required to find data in a backup taken before the request existed. The ledger
  must be stored separately from backups, have stricter access than ordinary operational metadata, and
  expire only after every retained backup can no longer restore the corresponding user.
- The PostgreSQL image digest and application release identifier associated with the backup.

Never put database URLs, passwords, session cookies, e-mail addresses, or names in the ledger or
validation report. Treat the pseudonymous user UUID in the encrypted ledger as personal data. Restrict
ledger access to the privacy-approved restore automation and audited backup operators; reports contain
only counts and checksums, never ledger identifiers.

## Isolated restore drill

Run from the repository root with Docker available. The script requires explicit local artifact paths,
starts a uniquely named container with `--network none`, never publishes a port, and removes it unless
`-KeepContainer` is deliberately supplied for investigation.

```powershell
pwsh -NoProfile -File scripts/validate-restore.ps1 `
  -BackupPath C:\secure-drill-input\skill-maps.dump `
  -ErasureLedgerPath C:\secure-drill-input\completed-erasures.txt `
  -ReportPath docs\validation\restore-drill-local.json
```

The command fails unless all of these hold:

- PostgreSQL restores without an ignored error.
- Every ledger pair is either already absent or reaches `completed` with no `user_id`.
- No captured user identifier remains in users, auth, profile, progress, certification, achievement, or
  recommendation tables.
- Backup age is at most 15 minutes and restore plus replay takes at most 4 hours.

`-BackupFormat Plain` supports a `.sql` input. A different tested image may be supplied through
`-PostgresImage`; release drills should keep the default digest or record the approved replacement.

## Monthly procedure

1. The on-call database operator selects the newest production-equivalent backup and the independently
   retained completed-erasure ledger.
2. The operator records incident-free drill start time, backup creation time, object versions, and
   checksums in the ticket without recording credentials or user data.
3. Run `scripts/validate-restore.ps1` on an isolated runner with no production application route.
4. Attach the JSON report and command exit code to the drill ticket.
5. Verify RPO, RTO, backup retention, encryption, access logs, and restore audit logs.
6. Destroy temporary resources. Rotate any short-lived access credential used to retrieve artifacts.
7. Assign failed checks to the database/platform owner; a failed erasure replay blocks exposure of the
   restored database and blocks release until remediated or explicitly excepted under the Constitution.

## Incident restoration

Restore into a new database, apply the external completed-erasure ledger, run all validation queries,
then migrate forward to the application release. Only the incident commander may authorize traffic
after database, application health, synthetic checks, and erasure replay all pass. Keep the old database
read-isolated for forensics according to the approved retention policy; do not reconnect it to users.
