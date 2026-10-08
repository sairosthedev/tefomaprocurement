import {
  runLowStockAlertJob,
  runRfqDeadlineAlertJob,
  runDocumentExpiryAlertJob,
  runSupplierReevaluationAlertJob
} from './alertJobs.js';
import { logger } from '../lib/logger.js';
import { activeSbus } from '../tenancy/registry.js';
import { runWithSbu } from '../tenancy/sbuContext.js';

const INTERVAL_MS = parseInt(process.env.ALERT_JOBS_INTERVAL_MS || String(60 * 60 * 1000), 10);
const ENABLED = process.env.ALERT_JOBS_ENABLED !== 'false';

let timer: ReturnType<typeof setInterval> | null = null;

async function runAlertJobs(): Promise<void> {
  await runLowStockAlertJob();
  await runRfqDeadlineAlertJob();
  await runDocumentExpiryAlertJob();
  await runSupplierReevaluationAlertJob();
}

/**
 * Jobs have no request to carry SBU context, so they walk the registry and run
 * each SBU's pass inside that SBU's context. One SBU failing must not stop the
 * rest — a single bad database would otherwise silence alerts group-wide.
 */
async function tick(): Promise<void> {
  logger.debug('Running scheduled alert jobs…');

  let sbus: Awaited<ReturnType<typeof activeSbus>> = [];
  try {
    sbus = await activeSbus();
  } catch (error) {
    logger.error('Could not read the SBU registry; skipping this alert tick', error);
    return;
  }

  if (sbus.length === 0) {
    // Registry not seeded yet: fall back to the single-tenant behaviour so
    // alerts keep working between deploying this and running seed:sbu-registry.
    await runAlertJobs();
    return;
  }

  for (const sbu of sbus) {
    try {
      await runWithSbu(sbu, () => runAlertJobs());
    } catch (error) {
      logger.error(`Alert jobs failed for SBU ${sbu.code}`, error);
    }
  }
}

export function startAlertScheduler(): void {
  if (!ENABLED) {
    logger.info('Alert scheduler disabled (ALERT_JOBS_ENABLED=false)');
    return;
  }

  if (timer) return;

  // Initial run shortly after startup so dev/test sees alerts without waiting an hour
  setTimeout(() => {
    tick().catch((err) => logger.error('Initial alert job tick failed', err));
  }, 15_000);

  timer = setInterval(() => {
    tick().catch((err) => logger.error('Scheduled alert job tick failed', err));
  }, INTERVAL_MS);

  timer.unref?.();

  logger.info(`Alert scheduler started (every ${Math.round(INTERVAL_MS / 60_000)} min)`);
}

export function stopAlertScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
