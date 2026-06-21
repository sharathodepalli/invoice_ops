import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRequestLogContext, logRequestEvent, redactRequestDetails, resolveRequestId } from "@/lib/request-logger";

describe("request logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the inbound request id when present", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-request-id": "trace-123" },
    });

    expect(resolveRequestId(req)).toBe("trace-123");
    expect(buildRequestLogContext(req, "/api/test").requestId).toBe("trace-123");
  });

  it("reuses an explicit request id in the log context", () => {
    const req = new Request("http://localhost/api/test");
    const context = buildRequestLogContext(req, "/api/test", null, "trace-explicit");

    expect(context.requestId).toBe("trace-explicit");
  });

  it("redacts sensitive fields before logging", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const context = {
      requestId: "trace-123",
      route: "/api/test",
      method: "POST",
      actor: "admin",
    };

    logRequestEvent("warn", context, "test_event", {
      comment: "internal review note",
      file_url: "/uploads/private.pdf",
      nested: { password: "secret-value", safe: "visible" },
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(warnSpy.mock.calls[0]?.[0])) as Record<string, unknown>;

    expect(payload.comment).toBe("[REDACTED]");
    expect(payload.file_url).toBe("[REDACTED]");
    expect((payload.nested as Record<string, unknown>).password).toBe("[REDACTED]");
    expect((payload.nested as Record<string, unknown>).safe).toBe("visible");
  });

  it("redacts direct sensitive details helper inputs", () => {
    expect(
      redactRequestDetails({
        token: "abc123",
        comment: "keep private",
        invoice_id: "inv_1",
      }),
    ).toEqual({
      token: "[REDACTED]",
      comment: "[REDACTED]",
      invoice_id: "inv_1",
    });
  });
});