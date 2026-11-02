import mongoose, { type Connection } from 'mongoose';
import { registerSbuModels } from '../models/registerModels.js';
import { getAppEnv } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type { SbuRef } from './sbuContext.js';

/**
 * Connections are resolved synchronously, because `PurchaseOrder.find()` is a
 * synchronous call. That is safe: `useDb` only splits an already-open
 * connection, and the server awaits `connectToDatabase()` before serving any
 * `/api` route (see `server.ts` and the Vercel guard in `app.ts`).
 */

/**
 * Collections and indexes are created explicitly, not automatically.
 *
 * Mongoose creates a model's collection (autoCreate) and builds its indexes
 * (autoIndex) the moment the model is registered on an open connection. Every
 * SBU
 * connection registers all two dozen models so that populate() can resolve its
 * refs, which turned each empty business unit into two dozen empty collections
 * — enough to exhaust a shared Atlas cluster's 500-collection ceiling on no
 * data at all.
 *
 * It is set here rather than in config/db.ts because the CLI scripts call
 * mongoose.connect directly and never import that module, and they are what
 * create SBU databases in the first place.
 *
 * Disabling it is also the documented practice for production, where an
 * unexpected index build is a load event nobody asked for. Indexes are built
 * deliberately instead, by bootstrap-sbus --with-indexes when an SBU goes live.
 */
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);

/** SBUs on the shared cluster, keyed by database name. */
const sharedConnections = new Map<string, Connection>();
/** SBUs with their own cluster, keyed by SBU code. Opened at startup. */
const dedicatedConnections = new Map<string, Connection>();

/** Group-wide database: the SBU registry, and later the KPI roll-ups. */
export function platformDbName(): string {
  return process.env.PLATFORM_DB_NAME?.trim() || `sourceline-${getAppEnv()}-platform`;
}

export function platformConnection(): Connection {
  return mongoose.connection.useDb(platformDbName(), { useCache: true });
}

export function connectionForSbu(sbu: SbuRef): Connection {
  if (sbu.connectionUriEnv) {
    const open = dedicatedConnections.get(sbu.code);
    if (!open) {
      throw new Error(
        `SBU "${sbu.code}" is on a dedicated cluster (${sbu.connectionUriEnv}) but its ` +
          'connection is not open. Call openDedicatedConnections() during startup.'
      );
    }
    return open;
  }

  const cached = sharedConnections.get(sbu.dbName);
  if (cached) return cached;

  // useCache keeps Mongoose from building a second connection object for the
  // same database; the underlying socket pool is shared with the primary
  // connection, which matters on serverless where pools are scarce.
  const connection = mongoose.connection.useDb(sbu.dbName, { useCache: true });
  registerSbuModels(connection);
  sharedConnections.set(sbu.dbName, connection);
  return connection;
}

/**
 * Open the clusters of any SBUs that do not sit on the shared one. Listed
 * companies' auditors sometimes require physical separation, so the registry
 * can point an SBU at its own cluster via an env var holding the URI.
 */
export async function openDedicatedConnections(sbus: SbuRef[]): Promise<void> {
  for (const sbu of sbus) {
    if (!sbu.connectionUriEnv || dedicatedConnections.has(sbu.code)) continue;

    const uri = process.env[sbu.connectionUriEnv]?.trim();
    if (!uri) {
      throw new Error(
        `SBU "${sbu.code}" expects its cluster URI in ${sbu.connectionUriEnv}, which is not set.`
      );
    }

    const connection = await mongoose
      .createConnection(uri, { serverSelectionTimeoutMS: 10_000, bufferCommands: false })
      .asPromise();
    registerSbuModels(connection);
    dedicatedConnections.set(sbu.code, connection);
    logger.info(`Opened dedicated cluster connection for SBU ${sbu.code}`);
  }
}

export async function closeDedicatedConnections(): Promise<void> {
  for (const connection of dedicatedConnections.values()) {
    await connection.close();
  }
  dedicatedConnections.clear();
}

/** Test seam: drop cached handles so a suite can rebind to fresh databases. */
export function resetConnectionCacheForTests(): void {
  sharedConnections.clear();
}
