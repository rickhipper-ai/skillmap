export interface ShutdownTarget {
  close(): Promise<void>;
}

export function createGracefulShutdown(app: ShutdownTarget, telemetry: ShutdownTarget) {
  let shutdownPromise: Promise<void> | undefined;

  return function shutdown(): Promise<void> {
    shutdownPromise ??= (async () => {
      try {
        await app.close();
      } finally {
        await telemetry.close();
      }
    })();
    return shutdownPromise;
  };
}
