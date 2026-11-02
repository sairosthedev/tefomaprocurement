/**
 * Central environment resolution.
 *
 * The system runs in exactly three environments — development, staging and
 * production — and several behaviours differ between them (OTP echoing, error
 * detail in responses, which database is safe to touch). Before this module
 * those decisions were spread across call sites as bare `process.env.NODE_ENV
 * === 'production'` checks, which had two problems:
 *
 *   1. Anything that was not literally 'production' got development behaviour.
 *     A staging box with NODE_ENV unset would print login OTPs to its logs and
 *     return stack traces to callers.
 *   2. There was no single place to state what a valid configuration looks
 *     like, so a missing variable surfaced as a runtime failure much later.
 *
 * Everything here fails closed: an unrecognised APP_ENV is a startup error, and
 * anything that relaxes security is enabled only in development.
 */

export const APP_ENVS = ['development', 'staging', 'production'] as const;

export type AppEnv = (typeof APP_ENVS)[number];

function isAppEnv(value: string): value is AppEnv {
  return (APP_ENVS as readonly string[]).includes(value);
}

let cachedEnv: AppEnv | undefined;

/**
 * The active environment.
 *
 * APP_ENV is the authority; NODE_ENV is read only as a fallback so existing
 * deployments and tooling that set it keep working. Node itself gives NODE_ENV
 * other meanings (build tooling treats anything non-'production' as a dev
 * build), so a dedicated variable keeps deployment intent explicit.
 */
export function getAppEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;

  const raw = (process.env.APP_ENV || process.env.NODE_ENV || '').trim().toLowerCase();

  if (!raw) {
    // No signal at all means someone is running locally without an env file.
    cachedEnv = 'development';
    return cachedEnv;
  }

  // Common aliases people set by habit.
  const normalised = raw === 'dev' ? 'development' : raw === 'prod' ? 'production' : raw;

  if (!isAppEnv(normalised)) {
    throw new Error(
      `APP_ENV is "${raw}", which is not a known environment. ` +
        `Expected one of: ${APP_ENVS.join(', ')}.`
    );
  }

  cachedEnv = normalised;
  return cachedEnv;
}

export function isDevelopment(): boolean {
  return getAppEnv() === 'development';
}

export function isStaging(): boolean {
  return getAppEnv() === 'staging';
}

export function isProduction(): boolean {
  return getAppEnv() === 'production';
}

/**
 * True for any environment that is reachable by someone other than the
 * developer running it. Staging is deployed and shared, so it must be treated
 * with production's caution for anything that leaks credentials or internals.
 */
export function isDeployed(): boolean {
  return !isDevelopment();
}

/** Reset memoised state. Tests only. */
export function resetEnvCache(): void {
  cachedEnv = undefined;
}
