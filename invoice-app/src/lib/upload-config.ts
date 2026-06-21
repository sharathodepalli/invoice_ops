export const UPLOAD_LIMITS = {
  maxFileSizeBytes: 20 * 1024 * 1024,
  maxBatchFiles: 25,
};

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
]);

export function isLikelyPdf(fileName: string, mimeType: string): boolean {
  const hasPdfExt = fileName.toLowerCase().endsWith(".pdf");
  return hasPdfExt && ALLOWED_MIME_TYPES.has(mimeType);
}
