import React, { lazy, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Pages load as their own chunks, so the first screen downloads only its own
 * code. Once the app is idle every page is fetched in the background, which
 * keeps moving between pages as instant as when it was one bundle.
 */

type Loader = () => Promise<{ default: React.ComponentType<any> }>;

const loaders: Loader[] = [];
const RELOAD_KEY = 'chunkReloadAt';

/**
 * After a deploy, a tab still running the old build asks for chunk files that
 * no longer exist. Reload once to pick up the new build instead of showing a
 * broken page; the timestamp stops a reload loop if the chunk is really gone.
 */
function withReloadOnStaleChunk(loader: Loader): Loader {
  return () =>
    loader().catch((error) => {
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      } catch {}
      if (Date.now() - last > 10000) {
        try {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        } catch {}
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw error;
    });
}

export function lazyPage(loader: Loader) {
  // Preloading uses the plain loader: a failed background fetch must never
  // reload the page under someone filling in a form.
  loaders.push(loader);
  return lazy(withReloadOnStaleChunk(loader));
}

let preloadStarted = false;

/** Fetch every page chunk once the browser has nothing better to do. */
export function preloadPagesWhenIdle() {
  if (preloadStarted || typeof window === 'undefined') return;
  preloadStarted = true;
  // On a metered or very slow connection, pages load only when opened.
  const connection = (navigator as any).connection;
  if (connection?.saveData || /2g/.test(connection?.effectiveType || '')) return;
  const idle: (cb: () => void) => void =
    (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 200));
  // Give the first screen's own data a head start before competing for bandwidth.
  setTimeout(() => idle(() => {
    // A few at a time, so the current page's API calls are never queued behind them.
    let next = 0;
    const pump = () => {
      const batch = loaders.slice(next, next + 4);
      next += batch.length;
      if (!batch.length) return;
      Promise.allSettled(batch.map((load) => load())).then(() => idle(pump));
    };
    pump();
  }), 3000);
}

/** Shown only if a page's code takes a noticeable time; quick loads show nothing. */
export function PageFallback() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 text-primary animate-spin" />
    </div>
  );
}
