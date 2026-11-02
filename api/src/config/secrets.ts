/**
 * Central access to the token signing secret.
 *
 * Previously each call site used `process.env.JWT_SECRET || 'your-secret-key'`.
 * That fallback is a full authentication bypass: with the secret absent, anyone
 * who knows the default (it is in the published source) can mint a token for any
 * user id and role. There is no safe default for a signing key, so a missing
 * secret is a startup error rather than something to paper over.
 */

const MIN_SECRET_LENGTH = 32;

/** Values that must never be accepted as a real secret. */
const REJECTED_SECRETS = new Set([
  'your-secret-key',
  'secret',
  'changeme',
  'replace-me-with-a-long-random-string'
]);

let cached: string | undefined;

export function getJwtSecret(): string {
  if (cached) return cached;

  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Generate one with `openssl rand -base64 48` and ' +
        'set it in the server environment before starting the API.'
    );
  }

  if (REJECTED_SECRETS.has(secret.toLowerCase())) {
    throw new Error(
      'JWT_SECRET is set to a well-known placeholder value. Replace it with a ' +
        'random secret: `openssl rand -base64 48`.'
    );
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${secret.length}). ` +
        'Generate one with `openssl rand -base64 48`.'
    );
  }

  cached = secret;
  return cached;
}

/**
 * Clear the memoised secret. Tests only — in a running process the secret is
 * read once at boot and cannot change.
 */
export function resetSecretCache(): void {
  cached = undefined;
}

/** How long a freshly issued session token stays valid. */
export function getJwtExpiry(): string {
  return process.env.JWT_EXPIRE || process.env.JWT_EXPIRES_IN || '7d';
}

/**
 * Validate the signing key at boot. Callers generally want
 * `validateEnvironment()` from ./validate.js, which runs this check alongside
 * the database, CORS and email checks; this remains for scripts that only need
 * to mint or verify a token.
 */
export function assertSecretsConfigured(): void {
  getJwtSecret();
}
