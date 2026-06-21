import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function withTempCwd() {
  const originalCwd = process.cwd();
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "invoice-app-test-"));
  process.chdir(tempDir);

  return {
    tempDir,
    cleanup() {
      process.chdir(originalCwd);
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}
