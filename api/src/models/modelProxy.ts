import type { Connection, Model } from 'mongoose';

/**
 * Wrap a model so that every use resolves to the copy compiled on whichever
 * connection `connectionFor()` returns at that moment.
 *
 * This is what lets 182 files keep `import { PurchaseOrder } from '../models/index.js'`
 * unchanged while each request reads and writes its own SBU's database. The
 * proxy forwards both calls (`PurchaseOrder.find(...)`) and construction
 * (`new PurchaseOrder(...)`), and keeps the base model's type so call sites
 * typecheck exactly as before.
 */
export function resolvingModel<T extends Model<any>>(base: T, connectionFor: () => Connection): T {
  const resolve = (): T => connectionFor().model(base.modelName) as unknown as T;

  return new Proxy(base, {
    get(_target, property) {
      const model = resolve();
      const value = Reflect.get(model, property, model);
      // Statics and query helpers need `this` to be the resolved model, not the
      // proxy — otherwise Mongoose reads the collection off the wrong connection.
      return typeof value === 'function' ? value.bind(model) : value;
    },
    set(_target, property, value) {
      return Reflect.set(resolve(), property, value);
    },
    has(_target, property) {
      return property in resolve();
    },
    construct(_target, args) {
      return Reflect.construct(resolve() as unknown as new (...a: unknown[]) => object, args);
    },
    getPrototypeOf() {
      return Object.getPrototypeOf(resolve());
    }
  }) as T;
}
