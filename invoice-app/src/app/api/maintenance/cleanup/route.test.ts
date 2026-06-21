import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/maintenance/cleanup/route";
import { withTempCwd } from "@/test-utils/fs-test-context";

let ctx: ReturnType<typeof withTempCwd>;
const originalSystemToken = process.env.SLICE_2_SYSTEM_TOKEN;

describe("POST /api/maintenance/cleanup", () => {
  beforeEach(() => {
    ctx = withTempCwd();
    process.env.SLICE_2_SYSTEM_TOKEN = "test-system-token";
  });

  afterEach(() => {
    ctx.cleanup();
    if (originalSystemToken === undefined) {
      delete process.env.SLICE_2_SYSTEM_TOKEN;
    } else {
      process.env.SLICE_2_SYSTEM_TOKEN = originalSystemToken;
    }
  });

  it("rejects missing system auth", async () => {
    const res = await POST(new Request("http://localhost/api/maintenance/cleanup", { method: "POST" }));
    const json = (await res.json()) as { error: { code: string; request_id: string } };

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("unauthorized");
    expect(json.error.request_id).toBeTruthy();
  });

  it("runs retention cleanup for local stores", async () => {
    const res = await POST(
      new Request("http://localhost/api/maintenance/cleanup?audit_log_days=1&export_record_days=1&upload_days=1", {
        method: "POST",
        headers: { Authorization: "Bearer test-system-token" },
      }),
    );

    const json = (await res.json()) as { cleanup: { audit_logs_removed: number; export_records_removed: number; upload_files_removed: number } };

    expect(res.status).toBe(200);
    expect(json.cleanup).toEqual({
      audit_logs_removed: 0,
      export_records_removed: 0,
      upload_files_removed: 0,
    });
  });

  it("rejects invalid retention windows", async () => {
    const res = await POST(
      new Request("http://localhost/api/maintenance/cleanup?audit_log_days=0", {
        method: "POST",
        headers: { Authorization: "Bearer test-system-token" },
      }),
    );

    const json = (await res.json()) as { error: { code: string; message: string } };

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("invalid_retention_window");
    expect(json.error.message).toContain("positive integer");
  });
});