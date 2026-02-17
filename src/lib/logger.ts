// ── Structured Logging System ────────────────────────────────────────
// Provides tagged, leveled, timestamped logging with an in-memory ring
// buffer. Logs go to both console (for Vercel log stream) and the buffer
// (for the /api/logs endpoint).

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  tag: string;
  message: string;
  data?: Record<string, unknown>;
  durationMs?: number;
}

const LOG_BUFFER_SIZE = 1000;
const logBuffer: LogEntry[] = [];

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  const minLevel = (process.env.LOG_LEVEL as LogLevel) || "debug";
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function pushEntry(entry: LogEntry) {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();

  if (!shouldLog(entry.level)) return;

  const ts = entry.timestamp.split("T")[1]?.replace("Z", "") || entry.timestamp;
  const lvl = entry.level.toUpperCase().padEnd(5);
  const prefix = `[${ts}] [${lvl}] [${entry.tag}]`;
  const dur = entry.durationMs != null ? ` (${entry.durationMs}ms)` : "";
  const extra = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
  const line = `${prefix} ${entry.message}${dur}${extra}`;

  switch (entry.level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

export interface Logger {
  debug: (msg: string, data?: Record<string, unknown>) => void;
  info: (msg: string, data?: Record<string, unknown>) => void;
  warn: (msg: string, data?: Record<string, unknown>) => void;
  error: (msg: string, data?: Record<string, unknown>) => void;
  /** Start a timer. Call `.end()` on the returned object to log duration. */
  time: (label: string) => {
    end: (msg?: string, data?: Record<string, unknown>) => number;
  };
}

export function createLogger(tag: string): Logger {
  const log = (level: LogLevel, message: string, data?: Record<string, unknown>) =>
    pushEntry({ timestamp: new Date().toISOString(), level, tag, message, data });

  return {
    debug: (msg, data) => log("debug", msg, data),
    info: (msg, data) => log("info", msg, data),
    warn: (msg, data) => log("warn", msg, data),
    error: (msg, data) => log("error", msg, data),
    time: (label: string) => {
      const start = Date.now();
      return {
        end: (msg?: string, data?: Record<string, unknown>) => {
          const durationMs = Date.now() - start;
          pushEntry({
            timestamp: new Date().toISOString(),
            level: "info",
            tag,
            message: msg || label,
            data,
            durationMs,
          });
          return durationMs;
        },
      };
    },
  };
}

// ── Log Retrieval ────────────────────────────────────────────────────

export function getLogEntries(options?: {
  level?: LogLevel;
  tag?: string;
  limit?: number;
}): LogEntry[] {
  let entries = [...logBuffer];

  if (options?.level) {
    const minLevel = LEVEL_ORDER[options.level];
    entries = entries.filter((e) => LEVEL_ORDER[e.level] >= minLevel);
  }

  if (options?.tag) {
    const tagFilter = options.tag.toLowerCase();
    entries = entries.filter((e) => e.tag.toLowerCase().includes(tagFilter));
  }

  if (options?.limit) {
    entries = entries.slice(-options.limit);
  }

  return entries;
}

export function getLogStats(): {
  total: number;
  byLevel: Record<LogLevel, number>;
  byTag: Record<string, number>;
} {
  const byLevel: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
  const byTag: Record<string, number> = {};

  for (const entry of logBuffer) {
    byLevel[entry.level]++;
    byTag[entry.tag] = (byTag[entry.tag] || 0) + 1;
  }

  return { total: logBuffer.length, byLevel, byTag };
}
