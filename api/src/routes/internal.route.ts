import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import { runAlertJobsForAllSbus } from '../jobs/scheduler.js';
import { logger } from '../lib/logger.js';

/**
 * Machine-to-machine endpoints for a scheduler to call.
 *
 * The alert jobs — including the one that applies document expiry to KYS —
 * only ran from the in-process timer started by server.ts. The serverless
 * entrypoint has no long-lived process, so on the deployed API they never ran.
 * This lets an external cron (Vercel Cron, or anything that can send a
 * request) run the same pass.
 *
 * Mounted ahead of the SBU context middleware: the run walks every SBU itself.
 */
const router = express.Router();

/**
 * `Authorization: Bearer <CRON_SECRET>`. With no secret configured the route
 * is closed (503), never open — and the API still starts without it.
 */
function requireCronSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ success: false, message: 'Scheduled jobs are not configured on this deployment' });
    return;
  }

  const header = req.headers.authorization || '';
  const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  // Compare digests so the comparison is constant-time and length-independent.
  const a = crypto.createHash('sha256').update(presented).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  if (!presented || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ success: false, message: 'Not authorized' });
    return;
  }
  next();
}

const runAlertJobs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const summary = await runAlertJobsForAllSbus();
    const ok = !summary.error && summary.failed.length === 0;
    res.status(ok ? 200 : 500).json({ success: ok, data: summary });
  } catch (error) {
    logger.error('Triggered alert job run failed', error);
    res.status(500).json({ success: false, message: 'Alert jobs failed' });
  }
};

// Vercel Cron calls with GET; other schedulers usually POST. Both are accepted.
router.get('/run-alert-jobs', requireCronSecret, runAlertJobs);
router.post('/run-alert-jobs', requireCronSecret, runAlertJobs);

export default router;
