type Level = 'error' | 'warn' | 'info' | 'debug';

const levels: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const current = levels[(process.env.LOG_LEVEL as Level) ?? 'info'] ?? levels.info;

function emit(level: Level, args: unknown[]): void {
  if (levels[level] > current) return;
  const stamp = new Date().toISOString();
  const tag = `[${stamp}] [${level.toUpperCase()}]`;
  const writer =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  writer(tag, ...args);
}

export const logger = {
  error: (...args: unknown[]): void => emit('error', args),
  warn: (...args: unknown[]): void => emit('warn', args),
  info: (...args: unknown[]): void => emit('info', args),
  debug: (...args: unknown[]): void => emit('debug', args)
};

export default logger;
