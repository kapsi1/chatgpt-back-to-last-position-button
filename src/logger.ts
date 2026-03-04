const DEBUG = true;
const LOG_PREFIX = "[CGPT-BTP]";

export function log(...args: unknown[]): void {
  if (DEBUG) {
    console.log(LOG_PREFIX, ...args);
  }
}

export function warn(...args: unknown[]): void {
  if (DEBUG) {
    console.warn(LOG_PREFIX, ...args);
  }
}
