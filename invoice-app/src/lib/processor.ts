import { extractTextFromPdf } from "./ocr";
import { extractInvoiceFields } from "./extraction";
import { updateInvoiceFields, updateJobStatus } from "./db";
import { validateInvoiceData, saveValidationFlags } from "./validation";
import { supabase } from "./supabase";

/**
 * Process a job: extract text, parse fields, validate, update database
 */
export async function processInvoiceJob(
  jobId: string,
  invoiceId: string,
  filePath: string
): Promise<void> {
  try {
    // Update job status to processing
    await updateJobStatus(jobId, "processing");

    // Step 1: Extract text from PDF
    console.log(`[Job ${jobId}] Extracting text from PDF...`);
    const pdfText = await extractTextFromPdf(filePath);

    // Step 2: Extract structured fields using LLM
    console.log(`[Job ${jobId}] Extracting invoice fields...`);
    const extractedData = await extractInvoiceFields(pdfText);

    // Step 3: Validate extracted data
    console.log(`[Job ${jobId}] Validating extracted data...`);
    const validationResult = await validateInvoiceData(extractedData);

    // Step 4: Update invoice with extracted data
    console.log(`[Job ${jobId}] Saving extracted data...`);
    await updateInvoiceFields(invoiceId, {
      vendor_value: extractedData.vendor.value,
      vendor_confidence: extractedData.vendor.confidence,
      invoice_number_value: extractedData.invoiceNumber.value,
      invoice_number_confidence: extractedData.invoiceNumber.confidence,
      invoice_date_value: extractedData.invoiceDate.value?.toISOString(),
      invoice_date_confidence: extractedData.invoiceDate.confidence,
      subtotal_value: extractedData.subtotal.value,
      subtotal_confidence: extractedData.subtotal.confidence,
      tax_value: extractedData.tax.value,
      tax_confidence: extractedData.tax.confidence,
      total_value: extractedData.total.value,
      total_confidence: extractedData.total.confidence,
      po_number_value: extractedData.poNumber.value,
      po_number_confidence: extractedData.poNumber.confidence,
      currency_value: extractedData.currency.value,
      currency_confidence: extractedData.currency.confidence,
      status: validationResult.hasErrors ? "exception" : "pending",
      extracted_json: extractedData.fullInvoice || {
        rawText: pdfText.substring(0, 500), // Store first 500 chars
        extractedAt: new Date().toISOString(),
        extractedFields: extractedData,
        validationResult,
      },
    });

    // Step 5: Save validation flags
    if (validationResult.flags.length > 0) {
      console.log(`[Job ${jobId}] Saving ${validationResult.flags.length} validation flags...`);
      await saveValidationFlags(invoiceId, validationResult);
    }

    // Step 6: Mark job as completed
    await updateJobStatus(jobId, "completed");
    console.log(
      `[Job ${jobId}] Processing completed successfully - Status: ${validationResult.hasErrors ? "Exception" : "Pending"}`
    );
  } catch (error) {
    console.error(`[Job ${jobId}] Processing failed:`, error);
    await updateJobStatus(
      jobId,
      "failed",
      error instanceof Error ? error.message : "Processing failed"
    );
    throw error;
  }
}
