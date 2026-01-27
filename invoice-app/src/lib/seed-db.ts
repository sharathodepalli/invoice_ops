import { mockInvoices } from "@/lib/mock-invoices";
import { supabase } from "@/lib/supabase";

/**
 * Seed database with demo invoices and testing data
 */
export async function seedDatabase() {
  try {
    console.log("🌱 Starting database seed...");

    // Create demo jobs
    const jobIds: string[] = [];
    for (let i = 0; i < mockInvoices.length; i++) {
      const invoice = mockInvoices[i];
      
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          filename: `${invoice.vendor.replace(/\s+/g, "_")}_${invoice.invoiceNumber}.pdf`,
          file_size: Math.floor(Math.random() * 500000) + 100000,
          file_url: `/uploads/demo_${i + 1}.pdf`,
          status: ["pending", "processing", "completed"][Math.floor(Math.random() * 3)],
          user_id: "demo-user",
          uploaded_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (jobError) throw jobError;
      jobIds.push(job.id);
    }

    console.log(`✅ Created ${jobIds.length} demo jobs`);

    // Create demo invoices
    for (let i = 0; i < mockInvoices.length; i++) {
      const invoice = mockInvoices[i];
      const status = ["pending", "exception", "approved", "rejected"][Math.floor(Math.random() * 4)];

      const { data: inv, error: invError } = await supabase
        .from("invoices")
        .insert({
          job_id: jobIds[i],
          status,
          vendor: invoice.vendor,
          invoice_number: invoice.invoiceNumber,
          invoice_date: invoice.invoiceDate,
          subtotal: invoice.subtotal,
          tax: invoice.tax,
          total: invoice.total,
          po_number: invoice.poNumber,
          currency: invoice.currency,
          pdf_url: `/uploads/demo_${i + 1}.pdf`,
          extracted_json: invoice,
          vendor_confidence: "high",
          invoice_number_confidence: "high",
          invoice_date_confidence: "medium",
          subtotal_confidence: "high",
          tax_confidence: "high",
          total_confidence: "high",
          po_number_confidence: "medium",
          currency_confidence: "high",
        })
        .select()
        .single();

      if (invError) throw invError;

      // Add validation flags for exception invoices
      if (status === "exception" && Math.random() > 0.5) {
        const flags = [
          {
            type: "total_mismatch",
            severity: "critical",
            field: "total",
            message: "Total amount doesn't match subtotal + tax",
            details: {
              calculated: invoice.subtotal + invoice.tax,
              stated: invoice.total,
            },
          },
          {
            type: "missing_field",
            severity: "warning",
            field: "po_number",
            message: "PO number is missing or unclear",
          },
        ];

        for (const flag of flags) {
          const { error: flagError } = await supabase.from("validation_flags").insert({
            invoice_id: inv.id,
            type: flag.type,
            severity: flag.severity,
            field: flag.field,
            message: flag.message,
            details: flag.details,
          });

          if (flagError) throw flagError;
        }
      }

      // Add approval audit logs for approved invoices
      if (status === "approved") {
        const { error: auditError } = await supabase.from("audit_logs").insert({
          invoice_id: inv.id,
          action: "approved",
          user_id: "demo-user",
          user_name: "Demo User",
          comment: "Automatically approved during demo setup",
          field_changes: [],
          created_at: new Date().toISOString(),
        });

        if (auditError) throw auditError;
      }
    }

    console.log(`✅ Created ${mockInvoices.length} demo invoices`);

    // Create sample export record
    const approvedIds = await supabase
      .from("invoices")
      .select("id")
      .eq("status", "approved")
      .then((res) => res.data?.map((inv) => inv.id) || []);

    if (approvedIds.length > 0) {
      const { error: exportError } = await supabase.from("export_records").insert({
        invoice_ids: approvedIds.slice(0, 3),
        exported_by: "demo-user",
        file_name: `demo_export_${Date.now()}.csv`,
        record_count: 3,
        exported_at: new Date().toISOString(),
      });

      if (exportError) throw exportError;
      console.log("✅ Created sample export record");
    }

    console.log("🎉 Database seeding complete!");
    return true;
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  }
}

export async function clearDatabase() {
  try {
    console.log("🧹 Clearing demo data...");

    // Delete in order of dependencies
    await supabase.from("export_records").delete().eq("exported_by", "demo-user");
    await supabase.from("audit_logs").delete().eq("user_id", "demo-user");
    await supabase.from("validation_flags").delete().eq("invoice_id", "demo");
    await supabase.from("invoices").delete().eq("user_id", "demo-user");
    await supabase.from("jobs").delete().eq("user_id", "demo-user");

    console.log("✅ Database cleared");
    return true;
  } catch (error) {
    console.error("❌ Clear failed:", error);
    throw error;
  }
}
