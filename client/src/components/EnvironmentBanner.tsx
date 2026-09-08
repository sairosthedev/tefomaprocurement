import { getEnvBadgeLabel, isProduction } from '../lib/env';

/**
 * A fixed corner badge naming the environment on every non-production build.
 *
 * Staging is a faithful copy of production — same layout, same data shapes —
 * which makes the two easy to confuse. Confusing them is expensive in both
 * directions: test data entered into production, or a real requisition raised
 * in staging and never actually ordered. The badge is small and always visible
 * so the question "which system am I in?" never needs asking.
 *
 * Renders nothing in production.
 */
export function EnvironmentBanner(): JSX.Element | null {
  if (isProduction()) return null;

  const label = getEnvBadgeLabel();
  if (!label) return null;

  const isStagingBuild = label === 'STAGING';

  return (
    <div
      // pointer-events-none so the badge can never intercept a click meant for
      // the UI underneath it.
      className="pointer-events-none fixed bottom-3 left-3 z-[9999] select-none"
      aria-live="off"
    >
      <span
        className={[
          'rounded-full px-3 py-1 text-[11px] font-bold tracking-wider text-white shadow-lg',
          isStagingBuild ? 'bg-amber-600' : 'bg-slate-600'
        ].join(' ')}
        title={
          isStagingBuild
            ? 'Staging environment — data here is test data and may be wiped.'
            : 'Local development environment.'
        }
      >
        {label}
      </span>
    </div>
  );
}

export default EnvironmentBanner;
