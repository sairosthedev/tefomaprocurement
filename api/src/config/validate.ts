/**
 * Startup configuration checks.
 *
 * A deployment that is missing a variable should fail while it is starting,
 * with a message naming the variable — not hours later when the first user hits
 * the code path that needed it. Each check below exists because getting it
 * wrong is either an outage or a security problem.
 */

import { getAppEnv, isDeployed, isProduction, isStaging, type AppEnv } from './env.js';
import { getJwtSecret } from './secrets.js';

/** Database names that must never be what production connects to. */
const NON_PRODUCTION_DB_MARKERS = ['dev', 'develop', 'development', 'staging', 'stage', 'test', 'local'];

class ConfigError extends Error {
  constructor(problems: string[], env: AppEnv) {
    super(
      `Invalid configuration for APP_ENV=${env}:\n` +
        problems.map((p) => `  - ${p}`).join('\n') +
        `\n\nSee api/.env.${env}.example for the expected variables.`
    );
    this.name = 'ConfigError';
  }
}

/** Extract the database name from a MongoDB connection string. */
function databaseNameFromUri(uri: string): string | undefined {
  try {
    // mongodb+srv://user:pass@host/dbname?opts — the path is the db name.
    const withoutQuery = uri.split('?')[0];
    const afterHost = withoutQuery.split('/').slice(3).join('/');
    return afterHost || undefined;
  } catch {
    return undefined;
  }
}

function checkDatabase(env: AppEnv, problems: string[]): void {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    problems.push('MONGODB_URI is not set.');
    return;
  }

  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    problems.push('MONGODB_URI must start with mongodb:// or mongodb+srv://.');
    return;
  }

  const dbName = databaseNameFromUri(uri)?.toLowerCase();

  if (isProduction()) {
    // Each environment owns its own database. Pointing production at the
    // staging database means test data lands in real records — and worse, a
    // staging wipe destroys production. Catch the obvious version of that
    // mistake: a production deployment whose database is named for another
    // environment.
    if (dbName && NON_PRODUCTION_DB_MARKERS.some((marker) => dbName.includes(marker))) {
      problems.push(
        `MONGODB_URI points at a database named "${dbName}", which looks like a ` +
          'non-production database. Production must use its own database.'
      );
    }

    if (/localhost|127\.0\.0\.1/.test(uri)) {
      problems.push('MONGODB_URI points at localhost, which cannot be right for production.');
    }
  }

  if (env === 'staging' && dbName && !NON_PRODUCTION_DB_MARKERS.some((m) => dbName.includes(m))) {
    // Not fatal — a staging database may simply be named differently — but the
    // reverse mistake (staging writing to production) is the expensive one.
    console.warn(
      `⚠️  APP_ENV=staging but MONGODB_URI database is "${dbName}". ` +
        'Confirm this is not the production database.'
    );
  }
}

function checkClientUrl(problems: string[]): void {
  const clientUrl = process.env.CLIENT_URL?.trim();

  if (!clientUrl) {
    if (isDeployed()) {
      problems.push(
        'CLIENT_URL is not set. Deployed environments need it for CORS and for ' +
          'the links in outgoing email.'
      );
    }
    return;
  }

  if (isDeployed() && /localhost|127\.0\.0\.1/.test(clientUrl)) {
    problems.push(`CLIENT_URL is "${clientUrl}", which is a local address and cannot be reached from a deployment.`);
  }
}

function checkEmail(problems: string[]): void {
  if (!isDeployed()) return;

  // Without a key the app still runs, but every OTP and notification silently
  // fails to send — and in a deployed environment the console fallback is off,
  // so nobody can log in at all.
  if (!process.env.RESEND_API_KEY?.trim()) {
    problems.push(
      'RESEND_API_KEY is not set. Deployed environments cannot deliver login ' +
        'OTPs without it, which locks every user out.'
    );
  }
}

function checkOtpExposure(_problems: string[]): void {
  // Returning the OTP to the caller removes the second factor: the login
  // endpoint hands the code to whoever asked, so knowing an email address is
  // enough to sign in as that person.
  //
  // Production used to refuse this outright. It is now permitted, by an
  // explicit decision taken on 2026-10-07 to let the pilot SBUs be used before
  // their users have working mailboxes. It is a temporary measure and should be
  // turned off — OTP_EXPOSE_IN_RESPONSE=false — as soon as those users can
  // receive email. RESEND_API_KEY and EMAIL_FROM are already configured on the
  // deployed projects, so turning it off costs nothing but real addresses.
  if (process.env.OTP_EXPOSE_IN_RESPONSE !== 'true') return;
  if (!isStaging() && !isProduction()) return;

  // Loud, every boot, and loudest in production. These deployments are
  // internet-reachable, so this belongs in the log rather than buried in a
  // config file.
  const where = isProduction() ? 'PRODUCTION' : 'staging';
  console.warn(
    `⚠️  OTP auto-fill is ON for ${where}: the login endpoint returns the code ` +
      'to the caller, so anyone who can reach this deployment can sign in as ' +
      'any user whose email they know — including finance and supplier ' +
      'accounts. Two-factor authentication is effectively disabled. Set ' +
      'OTP_EXPOSE_IN_RESPONSE=false to require the real emailed code.'
  );
}

/**
 * Validate the whole environment. Throws with every problem listed at once so a
 * misconfigured deployment is fixed in one pass rather than one restart per
 * missing variable.
 */
export function validateEnvironment(): void {
  const env = getAppEnv();
  const problems: string[] = [];

  try {
    getJwtSecret();
  } catch (error) {
    problems.push((error as Error).message);
  }

  checkDatabase(env, problems);
  checkClientUrl(problems);
  checkEmail(problems);
  checkOtpExposure(problems);

  if (problems.length > 0) {
    throw new ConfigError(problems, env);
  }
}
