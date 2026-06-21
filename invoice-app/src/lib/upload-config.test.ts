import { describe, expect, it } from "vitest";
import { isLikelyPdf, UPLOAD_LIMITS } from "@/lib/upload-config";

describe("upload-config", () => {
  it("accepts a .pdf file with application/pdf", () => {
    expect(isLikelyPdf("invoice.pdf", "application/pdf")).toBe(true);
  });

  it("rejects non-pdf extension", () => {
    expect(isLikelyPdf("invoice.txt", "application/pdf")).toBe(false);
  });

  it("rejects unsupported mime type", () => {
    expect(isLikelyPdf("invoice.pdf", "text/plain")).toBe(false);
  });

  it("has expected upload limits", () => {
    expect(UPLOAD_LIMITS.maxFileSizeBytes).toBe(20 * 1024 * 1024);
    expect(UPLOAD_LIMITS.maxBatchFiles).toBe(25);
  });
});
