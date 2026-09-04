import { browser } from 'k6/browser';
import { check, fail, sleep } from 'k6';
import http from 'k6/http';
import { SharedArray } from 'k6/data';
import { Trend } from 'k6/metrics';

const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const webUrl = (__ENV.WEB_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const catalogUrl = __ENV.CATALOG_URL || `${baseUrl}/v1/catalog?limit=50`;
const dashboardUrl = __ENV.DASHBOARD_URL || `${baseUrl}/v1/me/dashboard`;
const sessionCount = Number.parseInt(__ENV.SESSION_COUNT || '500', 10);
const catalogSessions = Math.ceil(sessionCount * Number.parseFloat(__ENV.CATALOG_RATIO || '0.6'));
const dashboardSessions = sessionCount - catalogSessions;
const profile = __ENV.LOAD_PROFILE || 'load';
const requestPauseSeconds = Number.parseFloat(__ENV.REQUEST_PAUSE_SECONDS || '1');
const browserReady = new Trend('browser_view_ready', true);

const sessionCookies = new SharedArray('dashboard session cookies', () => {
  if (__ENV.AUTH_SESSION_FILE) {
    const parsed = JSON.parse(open(__ENV.AUTH_SESSION_FILE));
    if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) {
      throw new Error(
        'AUTH_SESSION_FILE must contain a JSON array of complete Cookie header values',
      );
    }
    return parsed;
  }
  return (__ENV.DASHBOARD_SESSION_COOKIES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
});

const durations = {
  ramp: __ENV.RAMP_DURATION || '2m',
  hold: __ENV.HOLD_DURATION || '10m',
  down: __ENV.RAMP_DOWN_DURATION || '1m',
  soak: __ENV.SOAK_DURATION || '2h',
  spikeRamp: __ENV.SPIKE_RAMP_DURATION || '30s',
  spikeHold: __ENV.SPIKE_HOLD_DURATION || '2m',
};

function ramping(exec, vus, tags, stages) {
  return {
    executor: 'ramping-vus',
    exec,
    startVUs: 0,
    stages,
    gracefulRampDown: '30s',
    tags,
  };
}

function workloadScenarios() {
  if (profile === 'load') {
    return {
      catalog_load: ramping('catalogFlow', catalogSessions, { profile, surface: 'catalog' }, [
        { duration: durations.ramp, target: catalogSessions },
        { duration: durations.hold, target: catalogSessions },
        { duration: durations.down, target: 0 },
      ]),
      dashboard_load: ramping(
        'dashboardFlow',
        dashboardSessions,
        { profile, surface: 'dashboard' },
        [
          { duration: durations.ramp, target: dashboardSessions },
          { duration: durations.hold, target: dashboardSessions },
          { duration: durations.down, target: 0 },
        ],
      ),
    };
  }
  if (profile === 'spike') {
    return {
      spike: ramping('combinedFlow', sessionCount, { profile }, [
        { duration: durations.spikeRamp, target: sessionCount },
        { duration: durations.spikeHold, target: sessionCount },
        { duration: durations.down, target: 0 },
      ]),
    };
  }
  if (profile === 'soak') {
    return {
      soak: {
        executor: 'constant-vus',
        exec: 'combinedFlow',
        vus: sessionCount,
        duration: durations.soak,
        gracefulStop: '30s',
        tags: { profile },
      },
    };
  }
  if (profile === 'browser') {
    return {
      browser_readiness: {
        executor: 'shared-iterations',
        exec: 'browserReadiness',
        vus: Number.parseInt(__ENV.BROWSER_VUS || '1', 10),
        iterations: Number.parseInt(__ENV.BROWSER_ITERATIONS || '5', 10),
        maxDuration: __ENV.BROWSER_MAX_DURATION || '5m',
        options: { browser: { type: 'chromium' } },
        tags: { profile, surface: 'browser' },
      },
    };
  }
  throw new Error(`Unknown LOAD_PROFILE ${profile}; use load, spike, soak, or browser`);
}

export const options = {
  discardResponseBodies: true,
  scenarios: workloadScenarios(),
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{surface:catalog}': ['p(95)<2000'],
    'http_req_duration{surface:dashboard}': ['p(95)<2000'],
    browser_view_ready: ['p(95)<2000'],
    browser_web_vital_lcp: ['p(75)<2500'],
    browser_web_vital_inp: ['p(75)<200'],
    browser_web_vital_cls: ['p(75)<0.1'],
  },
};

export function setup() {
  if (!Number.isInteger(sessionCount) || sessionCount < 1)
    fail('SESSION_COUNT must be a positive integer');
  const needsDashboard = profile !== 'browser' && dashboardSessions > 0;
  const reuseAllowed = (__ENV.ALLOW_SESSION_REUSE || '').toLowerCase() === 'true';
  if (needsDashboard && sessionCookies.length === 0) {
    fail('Provide AUTH_SESSION_FILE or DASHBOARD_SESSION_COOKIES; no credentials are embedded');
  }
  if (needsDashboard && !reuseAllowed && sessionCookies.length < dashboardSessions) {
    fail(
      `Provide at least ${dashboardSessions} distinct dashboard sessions or explicitly set ALLOW_SESSION_REUSE=true for a smoke run`,
    );
  }
  return { cookieCount: sessionCookies.length };
}

export function catalogFlow() {
  const response = http.get(catalogUrl, { tags: { surface: 'catalog' } });
  check(response, { 'catalog is ready': (result) => result.status === 200 });
  sleep(requestPauseSeconds);
}

export function dashboardFlow() {
  const cookie = sessionCookies[(__VU - 1) % sessionCookies.length];
  const response = http.get(dashboardUrl, {
    headers: { Cookie: cookie },
    tags: { surface: 'dashboard' },
  });
  check(response, { 'dashboard is ready': (result) => result.status === 200 });
  sleep(requestPauseSeconds);
}

export function combinedFlow() {
  if (__VU <= catalogSessions) catalogFlow();
  else dashboardFlow();
}

export async function browserReadiness() {
  const page = await browser.newPage();
  try {
    if (__ENV.BROWSER_SESSION_COOKIE) {
      const separator = __ENV.BROWSER_SESSION_COOKIE.indexOf('=');
      if (separator < 1) fail('BROWSER_SESSION_COOKIE must use name=value format');
      const target = new URL(webUrl);
      await page.context().addCookies([
        {
          name: __ENV.BROWSER_SESSION_COOKIE.slice(0, separator),
          value: __ENV.BROWSER_SESSION_COOKIE.slice(separator + 1),
          domain: target.hostname,
          path: '/',
          secure: target.protocol === 'https:',
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
    }

    for (const route of ['/catalogo', '/painel']) {
      const started = Date.now();
      await page.goto(`${webUrl}${route}`, { waitUntil: 'networkidle' });
      await page.locator('main h1').waitFor({ state: 'visible' });
      browserReady.add(Date.now() - started, { route });
      check(page, { [`${route} browser view is ready`]: () => true });
    }
  } finally {
    await page.close();
  }
}
