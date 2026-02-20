const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
type LogLevel = keyof typeof LOG_LEVELS

const CURRENT_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'warn'

export const logger = {
  debug: (...args: unknown[]): void => {
    if (LOG_LEVELS[CURRENT_LEVEL] <= 0) console.log('[DEBUG]', ...args)
  },
  info: (...args: unknown[]): void => {
    if (LOG_LEVELS[CURRENT_LEVEL] <= 1) console.info('[INFO]', ...args)
  },
  warn: (...args: unknown[]): void => {
    if (LOG_LEVELS[CURRENT_LEVEL] <= 2) console.warn('[WARN]', ...args)
  },
  error: (...args: unknown[]): void => {
    console.error('[ERROR]', ...args)
  }
}
