// Core domain types

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type InvoiceStatus = "pending" | "exception" | "approved" | "rejected" | "exported";

export type ValidationSeverity = "critical" | "warning" | "info";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface Job {
  id: string;
  filename: string;
  fileSize: number;
  status: JobStatus;
  uploadedAt: Date;
  processedAt?: Date;
  errorMessage?: string;
  userId: string;
}

export interface ExtractedField<T = string> {
  value: T | null;
  confidence: ConfidenceLevel;
  rawText?: string;
}

export interface Invoice {
  id: string;
  jobId: string;
  status: InvoiceStatus;
  
  // Extracted fields with confidence
  vendor: ExtractedField;
  invoiceNumber: ExtractedField;
  invoiceDate: ExtractedField<Date>;
  subtotal: ExtractedField<number>;
  tax: ExtractedField<number>;
  total: ExtractedField<number>;
  poNumber: ExtractedField;
  currency: ExtractedField;
  
  // Metadata
  pdfUrl: string;
  extractedJson: Record<string, any>;
  validationFlags: ValidationFlag[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  exportedAt?: Date;
}

export interface ValidationFlag {
  id: string;
  invoiceId: string;
  type: "missing_field" | "total_mismatch" | "duplicate" | "missing_po" | "custom";
  severity: ValidationSeverity;
  field?: string;
  message: string;
  details?: Record<string, any>;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface AuditLog {
  id: string;
  invoiceId: string;
  action: "created" | "updated" | "approved" | "rejected" | "exported" | "comment_added";
  userId: string;
  userName: string;
  fieldChanges?: FieldChange[];
  comment?: string;
  timestamp: Date;
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface ExportRecord {
  id: string;
  invoiceIds: string[];
  exportedBy: string;
  exportedAt: Date;
  fileName: string;
  recordCount: number;
}

// UI-specific types

export interface UploadProgress {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  error?: string;
}

export interface FilterOptions {
  status?: InvoiceStatus[];
  severity?: ValidationSeverity[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  searchQuery?: string;
}
