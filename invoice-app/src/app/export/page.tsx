"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileDown, CheckCircle2, Calendar, Hash, FileText } from "lucide-react";
import { ExportSkeleton } from "@/components/skeletons";
import { formatDate } from "@/lib/utils";

interface ExportRecord {
  id: string;
  file_name: string;
  record_count: number;
  exported_at: string;
  exported_by: string;
}

export default function ExportPage() {
  const [approvedInvoices, setApprovedInvoices] = useState<any[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [exportHistory, setExportHistory] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"header" | "line-items">("line-items");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch approved invoices
      const invoicesRes = await fetch("/api/invoices?status=approved");
      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        setApprovedInvoices(data.invoices || []);
      }

      // Fetch export history
      const historyRes = await fetch("/api/export/history");
      if (historyRes.ok) {
        const data = await historyRes.json();
        setExportHistory(data.history || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (invoiceId: string) => {
    const newSelection = new Set(selectedInvoices);
    if (newSelection.has(invoiceId)) {
      newSelection.delete(invoiceId);
    } else {
      newSelection.add(invoiceId);
    }
    setSelectedInvoices(newSelection);
  };

  const selectAll = () => {
    if (selectedInvoices.size === approvedInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(approvedInvoices.map((inv) => inv.id)));
    }
  };

  const handleExport = async () => {
    if (selectedInvoices.size === 0) {
      alert("Please select at least one invoice to export");
      return;
    }

    try {
      setExporting(true);
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceIds: Array.from(selectedInvoices),
          userId: "demo-user",
          userName: "Demo User",
          format: exportFormat, // Pass selected format
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `invoices_export_${exportFormat}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Refresh data
        setSelectedInvoices(new Set());
        await fetchData();
      } else {
        alert("Export failed");
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Export Invoices</h1>
              <p className="text-muted-foreground mt-1">
                Download approved invoices as ERP-ready CSV
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Export Format Toggle */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Format:</span>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as "header" | "line-items")}
                  className="border-input bg-background rounded-md border px-3 py-1"
                >
                  <option value="line-items">Line Items (Detailed)</option>
                  <option value="header">Header Only</option>
                </select>
              </div>
              <Button
                onClick={handleExport}
                disabled={selectedInvoices.size === 0 || exporting}
                size="lg"
              >
                <Download className="mr-2 h-5 w-5" />
                {exporting ? "Exporting..." : `Export ${selectedInvoices.size} Selected`}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Approved Invoices */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Approved Invoices</CardTitle>
                    <CardDescription>{approvedInvoices.length} ready for export</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    {selectedInvoices.size === approvedInvoices.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <ExportSkeleton />
                ) : approvedInvoices.length === 0 ? (
                  <div className="py-12 text-center">
                    <CheckCircle2 className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                    <h3 className="mb-2 text-lg font-semibold">No Approved Invoices</h3>
                    <p className="text-muted-foreground">
                      Approve invoices from the exceptions queue first
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {approvedInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className={`hover:bg-muted flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors ${
                          selectedInvoices.has(invoice.id) ? "border-primary bg-primary/5" : ""
                        }`}
                        onClick={() => toggleSelection(invoice.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedInvoices.has(invoice.id)}
                          onChange={() => {}}
                          className="h-5 w-5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{invoice.vendor || "Unknown"}</p>
                            <Badge variant="success">Approved</Badge>
                          </div>
                          <div className="text-muted-foreground mt-1 flex gap-4 text-sm">
                            <span>#{invoice.invoice_number}</span>
                            <span>${invoice.total}</span>
                            <span>{invoice.currency}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Export History */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Export History</CardTitle>
                <CardDescription>Recent exports</CardDescription>
              </CardHeader>
              <CardContent>
                {exportHistory.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileDown className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                    <p className="text-muted-foreground text-sm">No exports yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {exportHistory.map((record) => (
                      <div key={record.id} className="rounded-lg border p-3 text-sm">
                        <div className="mb-2 flex items-start gap-2">
                          <FileText className="text-muted-foreground mt-0.5 h-4 w-4" />
                          <div className="flex-1">
                            <p className="font-medium">{record.file_name}</p>
                            <div className="text-muted-foreground mt-1 space-y-1 text-xs">
                              <div className="flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                {record.record_count} invoices
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(record.exported_at)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
