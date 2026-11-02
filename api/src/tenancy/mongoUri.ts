/**
 * Pull the database name out of a MongoDB connection string.
 *
 * `new URL()` cannot be used here: a replica-set URI lists its hosts
 * comma-separated (`mongodb://a:27017,b:27017,c:27017/db`), which the WHATWG
 * parser rejects outright. The connection-string spec percent-encodes any `/`
 * in the credentials, so the first `/` after the scheme always starts the
 * database name.
 */
export function databaseFromUri(uri: string): string {
  const rest = uri.trim().replace(/^mongodb(\+srv)?:\/\//i, '');

  const slash = rest.indexOf('/');
  if (slash === -1) return '';

  const afterHosts = rest.slice(slash + 1).split('?')[0];
  if (!afterHosts) return '';

  try {
    return decodeURIComponent(afterHosts).trim();
  } catch {
    return afterHosts.trim();
  }
}
