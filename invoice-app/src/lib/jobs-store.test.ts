import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildIdempotencyKey,
  buildUploadId,
  createJobsForUpload,
  listJobs,
} from "@/lib/jobs-store";
import { withTempCwd } from "@/test-utils/fs-test-context";

let ctx: ReturnType<typeof withTempCwd>;

describe("jobs-store", () => {
  beforeEach(() => {
    ctx = withTempCwd();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it("creates jobs for upload and lists them", async () => {
    const uploadId = buildUploadId();

    await createJobsForUpload({
      uploadId,
      files: [
        {
          fileName: "one.pdf",
          fileSizeBytes: 100,
          fileUrl: "/uploads/one.pdf",
          idempotencyKey: buildIdempotencyKey(uploadId, "one.pdf"),
        },
      ],
    });

    const page = await listJobs({ limit: 10 });
    expect(page.jobs).toHaveLength(1);
    expect(page.jobs[0].filename).toBe("one.pdf");
    expect(page.jobs[0].status).toBe("queued");
  });

  it("does not duplicate jobs with the same idempotency key", async () => {
    const uploadId = buildUploadId();
    const key = buildIdempotencyKey(uploadId, "dup.pdf");

    await createJobsForUpload({
      uploadId,
      files: [
        {
          fileName: "dup.pdf",
          fileSizeBytes: 100,
          fileUrl: "/uploads/dup.pdf",
          idempotencyKey: key,
        },
      ],
    });

    await createJobsForUpload({
      uploadId,
      files: [
        {
          fileName: "dup.pdf",
          fileSizeBytes: 100,
          fileUrl: "/uploads/dup.pdf",
          idempotencyKey: key,
        },
      ],
    });

    const page = await listJobs({ limit: 10 });
    expect(page.jobs).toHaveLength(1);
  });
});
