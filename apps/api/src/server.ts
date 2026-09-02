import { buildApp } from './app.js';
import { readEnvironment } from './config/environment.js';
import { startTelemetry } from './plugins/observability.js';

const environment = readEnvironment();
const telemetry = startTelemetry(environment.otelServiceName);
const app = buildApp({ environment });

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, 'Graceful shutdown started');
  await app.close();
  await telemetry.shutdown();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({
    host: environment.host,
    port: environment.port,
  });
} catch (error) {
  app.log.error(error);
  await telemetry.shutdown();
  process.exitCode = 1;
}
