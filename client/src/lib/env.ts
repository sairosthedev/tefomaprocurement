/**
 * Which deployment of the front-end this bundle is.
 *
 * Vite inlines `import.meta.env.*` at build time, so this is fixed when the
 * bundle is built — the staging build and the production build are different
 * artifacts. That is deliberate: the environment cannot drift at runtime.
 */

export const APP_ENVS = ['development', 'staging', 'production'] as const;

export type AppEnv = (typeof APP_ENVS)[number];

function resolveAppEnv(): AppEnv {
  const raw = String(import.meta.env.VITE_APP_ENV || '').trim().toLowerCase();

  if ((APP_ENVS as readonly string[]).includes(raw)) {
    return raw as AppEnv;
  }

  // No explicit value: fall back to Vite's own dev/prod split. `vite build`
  // without VITE_APP_ENV set is treated as production, which is the safe
  // default — it hides debugging affordances rather than exposing them.
  return import.meta.env.DEV ? 'development' : 'production';
}

export const APP_ENV: AppEnv = resolveAppEnv();

export const isDevelopment = (): boolean => APP_ENV === 'development';
export const isStaging = (): boolean => APP_ENV === 'staging';
export const isProduction = (): boolean => APP_ENV === 'production';

/**
 * True for staging and production — anything other people can reach. Use this
 * to gate debugging affordances, not `isProduction()`, so staging never gets
 * development behaviour by omission.
 */
export const isDeployed = (): boolean => !isDevelopment();

/**
 * A short label for non-production builds, shown in the UI so a tester can
 * always tell which system they are looking at. Empty in production.
 */
export function getEnvBadgeLabel(): string {
  if (isProduction()) return '';
  return APP_ENV === 'staging' ? 'STAGING' : 'DEV';
}
