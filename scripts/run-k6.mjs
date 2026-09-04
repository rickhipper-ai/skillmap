import { spawnSync } from 'node:child_process';

const image =
  'grafana/k6:0.57.0-with-browser@sha256:50f12739853bbba74c8e2e6bde1d77796fc7ce2a00aef54e2afc8468442a7a4e';
const allowedEnvironment = [
  'ALLOW_SESSION_REUSE',
  'AUTH_SESSION_FILE',
  'BASE_URL',
  'BROWSER_ITERATIONS',
  'BROWSER_MAX_DURATION',
  'BROWSER_SESSION_COOKIE',
  'BROWSER_VUS',
  'CATALOG_RATIO',
  'CATALOG_URL',
  'DASHBOARD_SESSION_COOKIES',
  'DASHBOARD_URL',
  'HOLD_DURATION',
  'K6_BROWSER_HEADLESS',
  'LOAD_PROFILE',
  'RAMP_DOWN_DURATION',
  'RAMP_DURATION',
  'REQUEST_PAUSE_SECONDS',
  'SESSION_COUNT',
  'SOAK_DURATION',
  'SPIKE_HOLD_DURATION',
  'SPIKE_RAMP_DURATION',
  'WEB_URL',
];

const command = process.argv[2] === 'inspect' ? 'inspect' : 'run';
const arguments_ = ['run', '--rm', '--volume', `${process.cwd()}:/work:ro`, '--workdir', '/work'];
for (const name of allowedEnvironment) {
  if (process.env[name] !== undefined) arguments_.push('--env', name);
}
arguments_.push(image, command, 'tests/load/catalog-dashboard-500.js');

const result = spawnSync('docker', arguments_, { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
