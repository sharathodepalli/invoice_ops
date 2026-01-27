"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Filter,
} from "lucide-react";
import { InvoiceSkeleton } from "@/components/skeletons";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Invoice {
  id: string;
  status: "pending" | "exception" | "approved" | "rejected" | "exported";
  filename?: string;
  vendor?: string;
  invoiceNumber?: string;
  total?: number;
  currency?: string;
  createdAt: string;
}

export default function ExceptionsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const statusFilter = filter === "all" ? "" : `?status=${filter}`;
      const response = await fetch(`/api/invoices${statusFilter}`);
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    const interval = setInterval(fetchInvoices, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [filter]);

  const getStatusBadge = (status: Invoice["status"]) => {
    const config: Record<
      Invoice["status"],
      { variant: any; icon: React.ReactNode; label: string }
    > = {
      pending: {
        variant: "outline",
        icon: <Clock className="mr-1 h-3 w-3" />,
        label: "Pending",
      },
      exception: {
        variant: "warning",
        icon: <AlertCircle className="mr-1 h-3 w-3" />,
        label: "Exception",
      },
      approved: {
        variant: "success",
        icon: <CheckCircle2 className="mr-1 h-3 w-3" />,
        label: "Approved",
      },
      rejected: {
        variant: "destructive",
        icon: <XCircle className="mr-1 h-3 w-3" />,
        label: "Rejected",
      },
      exported: {
        variant: "secondary",
        icon: <CheckCircle2 className="mr-1 h-3 w-3" />,
        label: "Exported",
      },
    };

    const { variant, icon, label } = config[status];
    return (
      <Badge variant={variant} className="inline-flex items-center">
        {icon}
        {label}
      </Badge>
    );
  };

  const filters = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "exception", label: "Exceptions" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  const stats = {
    total: invoices.length,
    pending: invoices.filter((i) => i.status === "pending").length,
    exceptions: invoices.filter((i) => i.status === "exception").length,
    approved: invoices.filter((i) => i.status === "approved").length,
  };

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 border-b backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">Invoice Automation</span>
          </div>
          <nav className="flex gap-6">
            <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
              Home
            </Link>
            <Link href="/upload" className="text-muted-foreground hover:text-foreground text-sm">
              Upload
            </Link>
            <Link href="/jobs" className="text-muted-foreground hover:text-foreground text-sm">
              Jobs
            </Link>
            <Link href="/exceptions" className="text-foreground text-sm font-medium">
              Exceptions
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-7xl">
          {/* Page Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-bold">Invoice Queue</h1>
              <p className="text-muted-foreground">Review and process extracted invoices</p>
            </div>
            <Button onClick={fetchInvoices} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="mb-8 grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total Invoices</CardDescription>
                <CardTitle className="text-3xl">{stats.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Pending Review</CardDescription>
                <CardTitle className="text-3xl text-yellow-600">{stats.pending}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Exceptions</CardDescription>
                <CardTitle className="text-3xl text-orange-600">{stats.exceptions}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Approved</CardDescription>
                <CardTitle className="text-3xl text-green-600">{stats.approved}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="text-muted-foreground h-5 w-5" />
                  <CardTitle>Filter by Status</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {filters.map((f) => (
                  <Button
                    key={f.value}
                    variant={filter === f.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(f.value)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Invoices Table */}
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>{invoices.length} invoice(s) found</CardDescription>
            </CardHeader>
            <CardContent>
              {loading && invoices.length === 0 ? (
                <InvoiceSkeleton />
              ) : invoices.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center">
                  <FileText className="mx-auto mb-4 h-12 w-12" />
                  <p className="mb-2 text-lg font-medium">No invoices found</p>
                  <p className="text-sm">Upload some invoices to get started</p>
                  <Link href="/upload">
                    <Button className="mt-4">Upload Invoices</Button>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr className="text-muted-foreground text-left text-sm">
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Vendor</th>
                        <th className="pb-3 font-medium">Invoice #</th>
                        <th className="pb-3 font-medium">Total</th>
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr
                          key={invoice.id}
                          className="hover:bg-muted/50 border-b transition-colors"
                        >
                          <td className="py-4">{getStatusBadge(invoice.status)}</td>
                          <td className="py-4">
                            <div className="font-medium">
                              {invoice.vendor || (
                                <span className="text-muted-foreground italic">Processing...</span>
                              )}
                            </div>
                            <div className="text-muted-foreground text-sm">{invoice.filename}</div>
                          </td>
                          <td className="py-4">{invoice.invoiceNumber || "—"}</td>
                          <td className="py-4 font-medium">
                            {invoice.total ? formatCurrency(invoice.total, invoice.currency) : "—"}
                          </td>
                          <td className="text-muted-foreground py-4 text-sm">
                            {formatDate(invoice.createdAt)}
                          </td>
                          <td className="py-4">
                            <Link href={`/invoices/${invoice.id}`}>
                              <Button variant="ghost" size="sm">
                                View Details
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
