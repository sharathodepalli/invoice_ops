import { supabase } from "./supabase";
import type { Job, Invoice, ValidationFlag, AuditLog } from "@/types";

/**
 * Create a new job in the database
 */
export async function createJob(data: {
  filename: string;
  fileSize: number;
  fileUrl: string;
  userId?: string;
}): Promise<Job> {
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      filename: data.filename,
      file_size: data.fileSize,
      file_url: data.fileUrl,
      status: "pending",
      user_id: data.userId,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: job.id,
    filename: job.filename,
    fileSize: job.file_size,
    status: job.status,
    uploadedAt: new Date(job.uploaded_at),
    processedAt: job.processed_at ? new Date(job.processed_at) : undefined,
    errorMessage: job.error_message,
    userId: job.user_id,
  };
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: Job["status"],
  errorMessage?: string
): Promise<void> {
  const updates: any = {
    status,
    ...(errorMessage && { error_message: errorMessage }),
    ...(status === "completed" && { processed_at: new Date().toISOString() }),
  };

  const { error } = await supabase.from("jobs").update(updates).eq("id", jobId);

  if (error) throw error;
}

/**
 * Get all jobs
 */
export async function getJobs(limit = 50): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data.map((job) => ({
    id: job.id,
    filename: job.filename,
    fileSize: job.file_size,
    status: job.status,
    uploadedAt: new Date(job.uploaded_at),
    processedAt: job.processed_at ? new Date(job.processed_at) : undefined,
    errorMessage: job.error_message,
    userId: job.user_id,
  }));
}

/**
 * Create invoice record
 */
export async function createInvoice(data: {
  jobId: string;
  pdfUrl: string;
  extractedJson?: any;
}): Promise<string> {
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      job_id: data.jobId,
      status: "pending",
      pdf_url: data.pdfUrl,
      extracted_json: data.extractedJson || {},
    })
    .select("id")
    .single();

  if (error) throw error;
  return invoice.id;
}

/**
 * Update invoice with extracted data (comprehensive)
 */
export async function updateInvoiceFields(
  invoiceId: string,
  fields: Record<string, any>
): Promise<any> {
  // If fullInvoice is provided, store it in extracted_json
  const updateData: any = { ...fields };
  
  if (fields.fullInvoice) {
    updateData.extracted_json = fields.fullInvoice;
    delete updateData.fullInvoice;
  }
  
  const { data, error } = await supabase
    .from("invoices")
    .update(updateData)
    .eq("id", invoiceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: string
): Promise<any> {
  const { data, error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", invoiceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get invoices with filters
 */
export async function getInvoices(filters?: {
  status?: string[];
  limit?: number;
}): Promise<any[]> {
  let query = supabase.from("invoices").select("*, jobs(filename)");

  if (filters?.status && filters.status.length > 0) {
    query = query.in("status", filters.status);
  }

  query = query.order("created_at", { ascending: false }).limit(filters?.limit || 50);

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Create validation flag
 */
export async function createValidationFlag(data: {
  invoiceId: string;
  type: ValidationFlag["type"];
  severity: ValidationFlag["severity"];
  field?: string;
  message: string;
  details?: Record<string, any>;
}): Promise<void> {
  const { error } = await supabase.from("validation_flags").insert({
    invoice_id: data.invoiceId,
    type: data.type,
    severity: data.severity,
    field: data.field,
    message: data.message,
    details: data.details,
  });

  if (error) throw error;
}

/**
 * Create audit log entry
 */
export async function createAuditLog(data: {
  invoiceId: string;
  action: AuditLog["action"];
  userId: string;
  userName: string;
  fieldChanges?: any[];
  comment?: string;
}): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    invoice_id: data.invoiceId,
    action: data.action,
    user_id: data.userId,
    user_name: data.userName,
    field_changes: data.fieldChanges,
    comment: data.comment,
  });

  if (error) throw error;
}
