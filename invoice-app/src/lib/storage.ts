import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface FileStorageResult {
  url: string;
  path: string;
  size: number;
}

/**
 * Store file locally (for development)
 * In production, replace with S3 upload
 */
export async function storeFile(file: File): Promise<FileStorageResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileExtension = path.extname(file.name);
  const fileName = `${randomUUID()}${fileExtension}`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  // Write file to disk
  fs.writeFileSync(filePath, buffer);

  return {
    url: `/api/uploads/${fileName}`,
    path: filePath,
    size: buffer.length,
  };
}

/**
 * Delete file from local storage
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Get file from local storage
 */
export function getFile(fileName: string): Buffer | null {
  const filePath = path.join(UPLOAD_DIR, fileName);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  return null;
}

/**
 * Validate PDF file
 */
export function validatePdfFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ["application/pdf"];

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "Only PDF files are allowed" };
  }

  if (file.size > maxSize) {
    return { valid: false, error: "File size must be less than 10MB" };
  }

  return { valid: true };
}
