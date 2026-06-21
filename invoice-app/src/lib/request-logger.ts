export type RequestLogLevel = "info" | "warn" | "error";

export type RequestLogContext = {
  requestId: string;
  route: string;
  method: string;
  actor?: string | null;
};

const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_KEY_PATTERN = /(?:password|secret|token|api[_-]?key|authorization|cookie|comment|rejection_reason|raw_extraction_json|file_url|pdf_url)$/i;

function sanitizeValue(value: unknown, keyPath = ""): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (keyPath && SENSITIVE_KEY_PATTERN.test(keyPath)) {
      return REDACTED_VALUE;
    }

    return value.length > 256 ? `${value.slice(0, 256)}…` : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, keyPath));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED_VALUE : sanitizeValue(nestedValue, key),
      ]),
    );
  }

  return value;
}

export function redactRequestDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;

  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [key, SENSITIVE_KEY_PATTERN.test(key) ? REDACTED_VALUE : sanitizeValue(value, key)]),
  );
}

export function resolveRequestId(request: Request): string {
  return (
    request.headers.get("x-request-id") ??
    request.headers.get("x-correlation-id") ??
    crypto.randomUUID()
  );
}

export function buildRequestLogContext(
  request: Request,
  route: string,
  actor?: string | null,
  requestId?: string,
): RequestLogContext {
  return {
    requestId: requestId ?? resolveRequestId(request),
    route,
    method: request.method,
    actor: actor ?? null,
  };
}

export function logRequestEvent(
  level: RequestLogLevel,
  context: RequestLogContext,
  event: string,
  details?: Record<string, unknown>,
): void {
  const payload = {
    level,
    event,
    request_id: context.requestId,
    route: context.route,
    method: context.method,
    actor: context.actor ?? null,
    ...redactRequestDetails(details),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}
