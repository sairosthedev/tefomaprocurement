import { runLowStockAlertJob, runRfqDeadlineAlertJob } from './alertJobs.js';
import { logger } from '../lib/logger.js';

const INTERVAL_MS = parseInt(process.env.ALERT_JOBS_INTERVAL_MS || String(60 * 60 * 1000), 10);
const ENABLED = process.env.ALERT_JOBS_ENABLED !== 'false';

let timer: ReturnType<typeof setInterval> | null = null;

async function tick(): Promise<void> {
  logger.debug('Running scheduled alert jobs…');
  await runLowStockAlertJob();
  await runRfqDeadlineAlertJob();
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
