"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Edit2,
  Save,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { InvoiceDetailSkeleton } from "@/components/skeletons";
import { formatCurrency, formatDate } from "@/lib/utils";
import { LineItemsSection } from "@/components/invoice/LineItemsSection";
import { PartiesSection } from "@/components/invoice/PartiesSection";
import { AdditionalInfoSection } from "@/components/invoice/AdditionalInfoSection";
import type { FullInvoice } from "@/types/full-invoice";

interface InvoiceField {
  value: any;
  confidence: "high" | "medium" | "low";
}

interface ValidationFlag {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  field?: string;
  message: string;
}

interface Invoice {
  id: string;
  status: string;
  pdfUrl: string;
  fields: {
    vendor: InvoiceField;
    invoiceNumber: InvoiceField;
    invoiceDate: InvoiceField;
    subtotal: InvoiceField;
    tax: InvoiceField;
    total: InvoiceField;
    poNumber: InvoiceField;
    currency: InvoiceField;
  };
  fullInvoice?: FullInvoice; // Complete structured data
  validationFlags: ValidationFlag[];
  job: {
    filename: string;
    uploaded_at: string;
  };
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchInvoice();
  }, [params.id]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setInvoice(data.invoice);
      }
    } catch (error) {
      console.error("Failed to fetch invoice:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (Object.keys(editedFields).length === 0) {
      setEditing(false);
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/invoices/${params.id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: editedFields,
          user: { id: "demo-user", name: "Demo User" },
        }),
      });

      if (response.ok) {
        await fetchInvoice();
        setEditedFields({});
        setEditing(false);
      }
    } catch (error) {
      console.error("Failed to save changes:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    try {
      const response = await fetch(`/api/invoices/${params.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: "Approved from detail view",
          user: { id: "demo-user", name: "Demo User" },
        }),
      });

      if (response.ok) {
        window.location.href = "/exceptions";
      }
    } catch (error) {
      console.error("Failed to approve invoice:", error);
    }
  };

  const handleReject = async () => {
    const reason = prompt("Please provide a reason for rejection:");
    if (!reason) return;

    try {
      const response = await fetch(`/api/invoices/${params.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          user: { id: "demo-user", name: "Demo User" },
        }),
      });

      if (response.ok) {
        window.location.href = "/exceptions";
      }
    } catch (error) {
      console.error("Failed to reject invoice:", error);
    }
  };

  const updateField = (field: string, value: any) => {
    setEditedFields((prev) => ({ ...prev, [field]: value }));
  };

  const getConfidenceBadge = (confidence: "high" | "medium" | "low") => {
    const variants = {
      high: "success",
      medium: "warning",
      low: "destructive",
    };
    return (
      <Badge variant={variants[confidence] as any} className="ml-2 text-xs">
        {confidence} confidence
      </Badge>
    );
  };

  const getSeverityIcon = (severity: "critical" | "warning" | "info") => {
    switch (severity) {
      case "critical":
        return <XCircle className="text-destructive h-4 w-4" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-background min-h-screen">
        <header className="bg-background border-b">
          <div className="container mx-auto flex h-16 items-center px-4">
            <div className="bg-muted h-8 w-32 animate-pulse rounded"></div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <InvoiceDetailSkeleton />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <FileText className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
          <h2 className="mb-2 text-2xl font-bold">Invoice Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested invoice could not be found.</p>
          <Link href="/exceptions">
            <Button>Back to Queue</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 border-b backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/exceptions">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <FileText className="text-primary h-5 w-5" />
              <span className="font-semibold">
                {invoice.fields.vendor.value || "Unknown Vendor"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="text-destructive" onClick={handleReject}>
              <ThumbsDown className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleApprove}>
              <ThumbsUp className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - PDF Viewer */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Invoice Document</CardTitle>
                <CardDescription>{invoice.job.filename}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted aspect-[8.5/11] w-full overflow-hidden rounded-lg border">
                  <iframe src={invoice.pdfUrl} className="h-full w-full" title="Invoice PDF" />
                </div>
                <p className="text-muted-foreground mt-4 text-sm">
                  Uploaded {formatDate(invoice.job.uploaded_at)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Extracted Fields */}
          <div className="space-y-6">
            {/* Validation Flags */}
            {invoice.validationFlags.length > 0 && (
              <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <CardTitle>Validation Issues</CardTitle>
                  </div>
                  <CardDescription>
                    {invoice.validationFlags.length} issue(s) need attention
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {invoice.validationFlags.map((flag) => (
                    <div
                      key={flag.id}
                      className="bg-background flex items-start gap-2 rounded-lg p-3"
                    >
                      {getSeverityIcon(flag.severity)}
                      <div className="flex-1">
                        <p className="font-medium">{flag.message}</p>
                        {flag.field && (
                          <p className="text-muted-foreground text-sm">Field: {flag.field}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Extracted Fields */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Extracted Data</CardTitle>
                    <CardDescription>Review and edit as needed</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => (editing ? handleSave() : setEditing(true))}
                    disabled={saving}
                  >
                    {editing ? (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? "Saving..." : "Save"}
                      </>
                    ) : (
                      <>
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Vendor */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Vendor
                    {invoice.fields.vendor.confidence &&
                      getConfidenceBadge(invoice.fields.vendor.confidence)}
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      className="w-full rounded-md border px-3 py-2"
                      defaultValue={invoice.fields.vendor.value || ""}
                      onChange={(e) => updateField("vendor", e.target.value)}
                    />
                  ) : (
                    <p className="text-lg">{invoice.fields.vendor.value || "—"}</p>
                  )}
                </div>

                {/* Invoice Number */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Invoice Number
                    {invoice.fields.invoiceNumber.confidence &&
                      getConfidenceBadge(invoice.fields.invoiceNumber.confidence)}
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      className="w-full rounded-md border px-3 py-2"
                      defaultValue={invoice.fields.invoiceNumber.value || ""}
                      onChange={(e) => updateField("invoice_number", e.target.value)}
                    />
                  ) : (
                    <p className="text-lg">{invoice.fields.invoiceNumber.value || "—"}</p>
                  )}
                </div>

                {/* Invoice Date */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Invoice Date
                    {invoice.fields.invoiceDate.confidence &&
                      getConfidenceBadge(invoice.fields.invoiceDate.confidence)}
                  </label>
                  {editing ? (
                    <input
                      type="date"
                      className="w-full rounded-md border px-3 py-2"
                      onChange={(e) => updateField("invoice_date", e.target.value)}
                      defaultValue={invoice.fields.invoiceDate.value || ""}
                    />
                  ) : (
                    <p className="text-lg">
                      {invoice.fields.invoiceDate.value
                        ? formatDate(invoice.fields.invoiceDate.value)
                        : "—"}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Subtotal */}
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Subtotal
                      {invoice.fields.subtotal.confidence &&
                        getConfidenceBadge(invoice.fields.subtotal.confidence)}
                    </label>
                    {editing ? (
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded-md border px-3 py-2"
                        onChange={(e) => updateField("subtotal", parseFloat(e.target.value) || 0)}
                        defaultValue={invoice.fields.subtotal.value || ""}
                      />
                    ) : (
                      <p className="text-lg">
                        {invoice.fields.subtotal.value
                          ? formatCurrency(
                              invoice.fields.subtotal.value,
                              invoice.fields.currency.value
                            )
                          : "—"}
                      </p>
                    )}
                  </div>

                  {/* Tax */}
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Tax
                      {invoice.fields.tax.confidence &&
                        getConfidenceBadge(invoice.fields.tax.confidence)}
                    </label>
                    {editing ? (
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded-md border px-3 py-2"
                        onChange={(e) => updateField("tax", parseFloat(e.target.value) || 0)}
                        defaultValue={invoice.fields.tax.value || ""}
                      />
                    ) : (
                      <p className="text-lg">
                        {invoice.fields.tax.value
                          ? formatCurrency(invoice.fields.tax.value, invoice.fields.currency.value)
                          : "—"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Total */}
                <div className="bg-muted rounded-lg p-4">
                  <label className="mb-1 block text-sm font-medium">
                    Total Amount
                    {invoice.fields.total.confidence &&
                      getConfidenceBadge(invoice.fields.total.confidence)}
                  </label>
                  {editing ? (
                    <input
                      type="number"
                      step="0.01"
                      onChange={(e) => updateField("total", parseFloat(e.target.value) || 0)}
                      className="w-full rounded-md border px-3 py-2"
                      defaultValue={invoice.fields.total.value || ""}
                    />
                  ) : (
                    <p className="text-2xl font-bold">
                      {invoice.fields.total.value
                        ? formatCurrency(invoice.fields.total.value, invoice.fields.currency.value)
                        : "—"}
                    </p>
                  )}
                </div>

                {/* PO Number */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    PO Number
                    {invoice.fields.poNumber.confidence &&
                      getConfidenceBadge(invoice.fields.poNumber.confidence)}
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      onChange={(e) => updateField("po_number", e.target.value)}
                      className="w-full rounded-md border px-3 py-2"
                      defaultValue={invoice.fields.poNumber.value || ""}
                    />
                  ) : (
                    <p className="text-lg">{invoice.fields.poNumber.value || "—"}</p>
                  )}
                </div>

                {/* Currency */}
                <div>
                  <label className="mb-1 block text-sm font-medium">Currency</label>
                  {editing ? (
                    <select
                      className="w-full rounded-md border px-3 py-2"
                      defaultValue={invoice.fields.currency.value || "USD"}
                      onChange={(e) => updateField("currency", e.target.value)}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  ) : (
                    <p className="text-lg">{invoice.fields.currency.value || "USD"}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Additional Invoice Data Sections */}
            {invoice.fullInvoice && (
              <div className="space-y-4">
                {/* Line Items */}
                <LineItemsSection
                  lineItems={invoice.fullInvoice.line_items || []}
                  currency={invoice.fields.currency.value || "USD"}
                />

                {/* Parties & Addresses */}
                <PartiesSection parties={invoice.fullInvoice.parties} />

                {/* Payment, Taxes, Discounts, Notes */}
                <AdditionalInfoSection
                  payment={invoice.fullInvoice.payment}
                  taxes={invoice.fullInvoice.taxes || []}
                  discounts={invoice.fullInvoice.discounts || []}
                  notes={invoice.fullInvoice.notes || []}
                  currency={invoice.fields.currency.value || "USD"}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
