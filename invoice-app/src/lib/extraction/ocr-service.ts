import { createHash } from "node:crypto";

function toPrintableText(bytes: Uint8Array): string {
  const decoded = Buffer.from(bytes).toString("utf8");
  return decoded.replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " ").replace(/\s+/g, " ").trim();
}

export async function runOcr(bytes: Uint8Array, fileName: string): Promise<{
  text: string;
  provider: string;
  confidence: "high" | "medium" | "low";
  fingerprint: string;
}> {
  const printable = toPrintableText(bytes);
  const fingerprint = createHash("sha1").update(bytes).digest("hex").slice(0, 12);
  const fileStem = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();

  const text = printable.length > 20 ? printable : `${fileStem || "Invoice"} ${fingerprint}`;

  return {
    text,
    provider: "mock-ocr",
    confidence: printable.length > 20 ? "high" : "medium",
    fingerprint,
  };
}