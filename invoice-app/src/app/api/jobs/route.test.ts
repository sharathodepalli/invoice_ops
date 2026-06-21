import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/jobs/route";
import { buildIdempotencyKey, buildUploadId, createJobsForUpload } from "@/lib/jobs-store";
import { withTempCwd } from "@/test-utils/fs-test-context";

let ctx: ReturnType<typeof withTempCwd>;

describe("GET /api/jobs", () => {
  beforeEach(() => {
    ctx = withTempCwd();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it("returns invalid_status for unknown status", async () => {
    const req = new Request("http://localhost/api/jobs?status=unknown", {
      method: "GET",
    });

    const res = await GET(req);
    const json = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("invalid_status");
  });

  it("returns jobs list", async () => {
    const uploadId = buildUploadId();
    await createJobsForUpload({
      uploadId,
      files: [
        {
          fileName: "invoice.pdf",
          fileSizeBytes: 100,
          fileUrl: "/uploads/invoice.pdf",
          idempotencyKey: buildIdempotencyKey(uploadId, "invoice.pdf"),
        },
      ],
    });

    const req = new Request("http://localhost/api/jobs?limit=10", {
      method: "GET",
    });

    const res = await GET(req);
    const json = (await res.json()) as {
      jobs: Array<{ filename: string; status: string }>;
      next_cursor: string | null;
    };

    expect(res.status).toBe(200);
    expect(json.jobs.length).toBe(1);
    expect(json.jobs[0].filename).toBe("invoice.pdf");
    expect(json.jobs[0].status).toBe("queued");
    expect(json.next_cursor).toBeNull();
  });
});
