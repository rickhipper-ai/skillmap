import Fastify from 'fastify';
import { sql } from 'kysely';

import type { Environment } from './config/environment.js';
import { AuditService } from './modules/audit/service.js';
import { CatalogRepository } from './modules/catalog/repository.js';
import { registerCatalogRoutes } from './modules/catalog/routes.js';
import { CatalogSearchService } from './modules/catalog/search-service.js';
import { TrailQueryService } from './modules/catalog/trail-query-service.js';
import { CertificationQueryService } from './modules/catalog/certification-query-service.js';
import { AchievementService } from './modules/achievements/service.js';
import { createAchievementSubscribers } from './modules/achievements/subscribers.js';
import { registerAchievementRoutes } from './modules/achievements/routes.js';
import { CertificationRepository } from './modules/credentials/repository.js';
import { registerCredentialRoutes } from './modules/credentials/routes.js';
import { CertificationService } from './modules/credentials/service.js';
import { AdministrationRepository } from './modules/administration/repository.js';
import { PublicationService } from './modules/administration/publication-service.js';
import { LifecycleService } from './modules/administration/lifecycle-service.js';
import { registerAdministrationSchemas } from './modules/administration/schemas.js';
import { registerCategorySkillRoutes } from './modules/administration/category-skill-routes.js';
import { registerTrailRoutes } from './modules/administration/trail-routes.js';
import { registerCredentialAdministrationRoutes } from './modules/administration/credential-routes.js';
import { MailpitEmailAdapter, NullEmailAdapter, type EmailPort } from './modules/identity/email.js';
import { IdentityRepository } from './modules/identity/repository.js';
import { registerIdentityRoutes } from './modules/identity/routes.js';
import { IdentityService } from './modules/identity/service.js';
import {
  AccountErasureWorker,
  NoopProviderCleanup,
  type ProviderCleanupPort,
} from './modules/erasure/worker.js';
import { ErasureService } from './modules/erasure/service.js';
import { registerHealthRoutes } from './modules/health/routes.js';
import { ProfileRepository } from './modules/profiles/repository.js';
import { registerProfileRoutes } from './modules/profiles/routes.js';
import { ProfileService } from './modules/profiles/service.js';
import { ProgressRepository } from './modules/progress/repository.js';
import { registerProgressRoutes } from './modules/progress/routes.js';
import { ProgressService } from './modules/progress/service.js';
import { DashboardService } from './modules/recommendations/dashboard-service.js';
import { registerRecommendationRoutes } from './modules/recommendations/routes.js';
import { createAuth } from './plugins/auth.js';
import { registerAuthorization } from './plugins/authorization.js';
import { createDatabase, type OwnedDatabase } from './plugins/database.js';
import { JobRunner } from './plugins/jobs.js';
import { createLoggerOptions, createRequestId } from './plugins/observability.js';
import { registerOpenApi } from './plugins/openapi.js';
import { registerProblemDetails } from './plugins/problem-details.js';
import { registerSecurity, registerSecurityRoutes } from './plugins/security.js';

type AppEnvironment = Pick<Environment, 'nodeEnv' | 'host' | 'port' | 'webOrigin'> &
  Partial<
    Pick<
      Environment,
      | 'databaseUrl'
      | 'databaseConnectionTimeoutMs'
      | 'databaseQueryTimeoutMs'
      | 'databasePoolMax'
      | 'jobPollIntervalMs'
      | 'authSecret'
      | 'smtpHost'
      | 'smtpPort'
      | 'emailFrom'
    >
  >;

interface BuildAppOptions {
  environment?: AppEnvironment;
  database?: OwnedDatabase;
  email?: EmailPort;
  providerCleanup?: ProviderCleanupPort;
}

const testEnvironment: AppEnvironment = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 3000,
  webOrigin: 'http://localhost:5173',
};

export function buildApp(options: BuildAppOptions = {}) {
  const environment = options.environment ?? testEnvironment;
  const database =
    options.database ??
    (environment.databaseUrl
      ? createDatabase(environment.databaseUrl, {
          connectionTimeoutMillis: environment.databaseConnectionTimeoutMs,
          queryTimeoutMillis: environment.databaseQueryTimeoutMs,
          max: environment.databasePoolMax,
        })
      : undefined);
  const app = Fastify({
    logger: environment.nodeEnv === 'test' ? false : createLoggerOptions(),
    genReqId: (request) => createRequestId(request.headers['x-request-id'] as string | undefined),
    trustProxy: false,
    ajv: { customOptions: { removeAdditional: false } },
  });

  registerProblemDetails(app);
  registerSecurity(app, environment.webOrigin);
  registerAuthorization(app);

  app.decorate('database', database?.db ?? null);
  const jobs = database ? new JobRunner(database.db) : null;
  app.decorate('jobs', jobs);
  let identity: IdentityService | undefined;
  let profiles: ProfileService | undefined;
  let erasure: ErasureService | undefined;
  let catalogSearch: CatalogSearchService | undefined;
  let trailQueries: TrailQueryService | undefined;
  let certificationQueries: CertificationQueryService | undefined;
  let progress: ProgressService | undefined;
  let dashboard: DashboardService | undefined;
  let credentialRecords: CertificationService | undefined;
  let achievements: AchievementService | undefined;
  let audit: AuditService | undefined;
  let administrationRepository: AdministrationRepository | undefined;
  let publication: PublicationService | undefined;
  let lifecycle: LifecycleService | undefined;
  if (database) {
    audit = new AuditService(database.db);
    const identityRepository = new IdentityRepository(database.db);
    const email =
      options.email ??
      (environment.nodeEnv === 'test'
        ? new NullEmailAdapter()
        : new MailpitEmailAdapter(
            environment.smtpHost,
            environment.smtpPort,
            environment.emailFrom,
          ));
    const auth = environment.authSecret
      ? createAuth(database.db, environment.authSecret, environment.webOrigin, email)
      : null;
    app.decorate('auth', auth);
    identity = auth ? new IdentityService(identityRepository, auth, audit) : undefined;
    profiles = new ProfileService(new ProfileRepository(database.db), audit);
    erasure = identity ? new ErasureService(database.db, identity, audit) : undefined;
    const catalogRepository = new CatalogRepository(database.db);
    catalogSearch = new CatalogSearchService(catalogRepository);
    trailQueries = new TrailQueryService(catalogRepository);
    certificationQueries = new CertificationQueryService(catalogRepository);
    achievements = new AchievementService(database.db);
    const achievementSubscribers = createAchievementSubscribers(achievements);
    credentialRecords = new CertificationService(
      new CertificationRepository(database.db),
      achievementSubscribers.onCertificationRecorded,
    );
    progress = new ProgressService(
      new ProgressRepository(database.db),
      achievementSubscribers.onProgressEvent,
    );
    dashboard = new DashboardService(database.db, {
      listCertificationRecords: (userId) => credentialRecords!.list(userId),
      listAchievementAwards: (userId) => achievements!.list(userId),
    });
    administrationRepository = new AdministrationRepository(database.db);
    publication = new PublicationService(administrationRepository);
    lifecycle = new LifecycleService(administrationRepository);
    const worker = new AccountErasureWorker(
      database.db,
      options.providerCleanup ?? new NoopProviderCleanup(),
    );
    jobs?.register('account_erasure', async (payload) => {
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('requestId' in payload) ||
        typeof payload.requestId !== 'string'
      ) {
        throw new Error('INVALID_ERASURE_JOB_PAYLOAD');
      }
      await worker.process(payload.requestId);
    });
  } else {
    app.decorate('auth', null);
  }

  app.register(async (api) => {
    await registerOpenApi(api);
    registerAdministrationSchemas(api);
    registerSecurityRoutes(api);
    registerHealthRoutes(api, {
      async ready() {
        if (!database) return true;
        try {
          await sql`SELECT 1`.execute(database.db);
          return true;
        } catch {
          return false;
        }
      },
    });
    registerIdentityRoutes(api, {
      identity,
      profiles,
      erasure,
    });
    registerProfileRoutes(api, profiles);
    registerCatalogRoutes(api, {
      search: catalogSearch,
      trails: trailQueries,
      certifications: certificationQueries,
    });
    registerProgressRoutes(api, progress);
    registerRecommendationRoutes(api, dashboard);
    registerCredentialRoutes(api, credentialRecords);
    registerAchievementRoutes(api, achievements);
    const administration = {
      repository: administrationRepository,
      publication,
      lifecycle,
      audit,
    };
    registerCategorySkillRoutes(api, administration);
    registerTrailRoutes(api, administration);
    registerCredentialAdministrationRoutes(api, administration);
    api.get('/', async () => ({ name: 'SKILL MAPS API', status: 'setup' }));
  });

  if (database) {
    let jobTimer: NodeJS.Timeout | undefined;
    let activeJobRun: Promise<boolean> | undefined;
    if (environment.nodeEnv !== 'test') {
      app.addHook('onReady', async () => {
        jobTimer = setInterval(() => {
          if (activeJobRun) return;
          activeJobRun = jobs!
            .runOne()
            .catch(() => {
              app.log.error({ errorCode: 'BACKGROUND_JOB_POLL_FAILED' }, 'Background job failed');
              return false;
            })
            .finally(() => {
              activeJobRun = undefined;
            });
        }, environment.jobPollIntervalMs ?? 1_000);
        jobTimer.unref();
      });
    }
    app.addHook('onClose', async () => {
      if (jobTimer) clearInterval(jobTimer);
      await activeJobRun;
    });
    app.addHook('onClose', async () => database.destroy());
  }

  return app;
}
