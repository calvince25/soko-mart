import { getRequestId } from "./requestContext";

export type LogFields = Record<string, string | number | boolean | null | undefined>;

type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, event: string, fields: LogFields = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    requestId: getRequestId(),
    ...fields,
  };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields, error?: unknown) => {
    const errorFields: LogFields = {};
    if (error instanceof Error) {
      errorFields.errorName = error.name;
      errorFields.errorMessage = error.message;
      const code = (error as Error & { code?: string }).code;
      if (code) errorFields.errorCode = code;
    }
    write("error", event, { ...fields, ...errorFields });
  },
};
