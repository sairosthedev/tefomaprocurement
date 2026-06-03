'use strict';

/**
 * Minimal level-based logger. Swap with pino/winston later without
 * touching call sites.
 */
const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const current = levels[process.env.LOG_LEVEL] ?? levels.info;

function emit(level, args) {
  if (levels[level] > current) return;
  const stamp = new Date().toISOString();
  const tag = `[${stamp}] [${level.toUpperCase()}]`;
  const writer = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  writer(tag, ...args);
}

module.exports = {
  error: (...args) => emit('error', args),
  warn: (...args) => emit('warn', args),
  info: (...args) => emit('info', args),
  debug: (...args) => emit('debug', args)
};
