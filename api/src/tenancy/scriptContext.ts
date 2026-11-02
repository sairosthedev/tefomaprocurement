import { sbuByCode } from './registry.js';
import { setAmbientSbu, type SbuRef } from './sbuContext.js';

/**
 * Point a CLI script at one SBU's database.
 *
 * Scripts have no request to carry SBU context, so they bind the whole process
 * instead. With no `--sbu` the script keeps its old behaviour and works against
 * the database named in MONGODB_URI, which is Fossil's.
 *
 *   npm run seed:all -w api -- --sbu DOKUMA
 *
 * Call it after connecting to Mongo and before touching any model.
 */
export async function useSbuFromArgs(argv: string[] = process.argv): Promise<SbuRef | null> {
  const index = argv.indexOf('--sbu');
  if (index === -1) return null;

  const code = argv[index + 1];
  if (!code || code.startsWith('--')) {
    throw new Error('--sbu needs a business unit code, e.g. --sbu DOKUMA');
  }

  const sbu = await sbuByCode(code);
  if (!sbu) {
    throw new Error(
      `No business unit "${code.toUpperCase()}" in the registry. Run seed:sbu-registry first.`
    );
  }

  setAmbientSbu(sbu);
  return sbu;
}
