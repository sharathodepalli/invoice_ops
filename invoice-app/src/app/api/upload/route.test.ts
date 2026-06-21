import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/upload/route";
import { getInvoiceByJobId } from "@/lib/invoices-store";
import { withTempCwd } from "@/test-utils/fs-test-context";

let ctx: ReturnType<typeof withTempCwd>;

describe("POST /api/upload", () => {
  beforeEach(() => {
    ctx = withTempCwd();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it("returns invalid_file_type for non-pdf", async () => {
    const form = new FormData();
    const badFile = new File(["hello"], "bad.txt", { type: "text/plain" });
    form.append("files[]", badFile);

    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      body: form,
    });

    const res = await POST(req);
    const json = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("invalid_file_type");
  });

  it("creates and extracts jobs for valid pdf files", async () => {
    const form = new FormData();
    form.append(
      "files[]",
      new File(["pdf-content"], "a.pdf", { type: "application/pdf" }),
    );
    form.append(
      "files[]",
      new File(["pdf-content"], "b.pdf", { type: "application/pdf" }),
    );

    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      body: form,
    });

    const res = await POST(req);
    const json = (await res.json()) as {
      upload_id: string;
      jobs: Array<{ job_id: string; filename: string; status: string }>;
    };

    expect(res.status).toBe(201);
    expect(json.upload_id.length).toBeGreaterThan(0);
    expect(json.jobs).toHaveLength(2);
    expect(json.jobs[0].status).toBe("validated");

    const invoice = await getInvoiceByJobId(json.jobs[0].job_id);
    expect(invoice).not.toBeNull();
    expect(invoice?.status).toBe("pending");
  });
});
