import {
  runLowStockAlertJob,
  runRfqDeadlineAlertJob,
  runDocumentExpiryAlertJob,
  runSupplierReevaluationAlertJob
} from './alertJobs.js';
import { runRetentionJob } from '../services/retention.service.js';
import { logger } from '../lib/logger.js';
import { activeSbus } from '../tenancy/registry.js';
import { runWithSbu } from '../tenancy/sbuContext.js';

const INTERVAL_MS = parseInt(process.env.ALERT_JOBS_INTERVAL_MS || String(60 * 60 * 1000), 10);
const ENABLED = process.env.ALERT_JOBS_ENABLED !== 'false';

const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let lastRetentionRun = 0;

async function runAlertJobs(includeRetention: boolean): Promise<void> {
  await runLowStockAlertJob();
  await runRfqDeadlineAlertJob();
  await runDocumentExpiryAlertJob();
  await runSupplierReevaluationAlertJob();
  // Deletes only short-lived data (see retention.service); once a day is plenty.
  if (includeRetention) await runRetentionJob();
}

export interface AlertRunSummary {
  /** SBUs whose jobs completed ('default' when the registry is empty). */
  completed: string[];
  failed: string[];
  includedRetention: boolean;
  /** Set when the registry itself could not be read and nothing ran. */
  error?: string;
}

/**
 * Jobs have no request to carry SBU context, so they walk the registry and run
 * each SBU's pass inside that SBU's context. One SBU failing must not stop the
 * rest — a single bad database would otherwise silence alerts group-wide.
 *
 * Shared by the in-process timer and the HTTP trigger (routes/internal), so a
 * serverless deployment with no long-lived process runs exactly the same pass.
 */
export async function runAlertJobsForAllSbus(): Promise<AlertRunSummary> {
  const includeRetention = Date.now() - lastRetentionRun >= RETENTION_INTERVAL_MS;
  if (includeRetention) lastRetentionRun = Date.now();

  const summary: AlertRunSummary = { completed: [], failed: [], includedRetention: includeRetention };

  let sbus: Awaited<ReturnType<typeof activeSbus>> = [];
  try {
    sbus = await activeSbus();
  } catch (error) {
    logger.error('Could not read the SBU registry; skipping this alert tick', error);
    summary.error = 'Could not read the SBU registry';
    return summary;
  }

  if (sbus.length === 0) {
    // Registry not seeded yet: fall back to the single-tenant behaviour so
    // alerts keep working between deploying this and running seed:sbu-registry.
    await runAlertJobs(includeRetention);
    summary.completed.push('default');
    return summary;
  }

  for (const sbu of sbus) {
    try {
      await runWithSbu(sbu, () => runAlertJobs(includeRetention));
      summary.completed.push(sbu.code);
    } catch (error) {
      logger.error(`Alert jobs failed for SBU ${sbu.code}`, error);
      summary.failed.push(sbu.code);
    }
  }

  return summary;
}

async function tick(): Promise<void> {
  logger.debug('Running scheduled alert jobs…');
  await runAlertJobsForAllSbus();
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
