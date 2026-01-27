"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Loader, Trash2 } from "lucide-react";

export default function DebugPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "seeding" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSeed = async () => {
    try {
      setLoading(true);
      setStatus("seeding");
      setMessage("Generating 12 demo invoices...");

      const response = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(`✅ ${data.message}\n${data.count} invoices created with mixed statuses`);
      } else {
        setStatus("error");
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setStatus("error");
      setMessage(`❌ Failed: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear all demo data?")) return;

    try {
      setLoading(true);
      setStatus("seeding");
      setMessage("Clearing demo data...");

      const response = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(`✅ ${data.message}`);
      } else {
        setStatus("error");
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setStatus("error");
      setMessage(`❌ Failed: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Debug & Demo Setup</CardTitle>
              <CardDescription>Seed database with test data for demos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Info Card */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <div className="text-sm">
                    <p className="mb-1 font-medium text-blue-900 dark:text-blue-100">
                      Development Only
                    </p>
                    <p className="text-blue-800 dark:text-blue-200">
                      This page creates realistic demo invoices across all statuses (pending,
                      exceptions, approved, rejected). Perfect for testing the complete workflow.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Message */}
              {status !== "idle" && (
                <div
                  className={`rounded-lg p-4 ${
                    status === "success"
                      ? "border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
                      : status === "error"
                        ? "border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                        : "border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950"
                  }`}
                >
                  <div className="flex gap-3">
                    {status === "success" ? (
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
                    ) : status === "error" ? (
                      <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                    ) : (
                      <Loader className="h-5 w-5 flex-shrink-0 animate-spin text-yellow-600 dark:text-yellow-400" />
                    )}
                    <div
                      className={`text-sm whitespace-pre-wrap ${
                        status === "success"
                          ? "text-green-800 dark:text-green-200"
                          : status === "error"
                            ? "text-red-800 dark:text-red-200"
                            : "text-yellow-800 dark:text-yellow-200"
                      }`}
                    >
                      {message}
                    </div>
                  </div>
                </div>
              )}

              {/* Features List */}
              <div className="space-y-3">
                <h3 className="font-semibold">Demo includes:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>12 realistic invoices with various vendors</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>Mixed statuses (pending, exception, approved, rejected)</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>Validation flags on exception invoices</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>Audit logs for approved invoices</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>Sample export record with approved invoices</span>
                  </li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={handleSeed} disabled={loading} size="lg" className="flex-1">
                  {loading ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Seed Demo Data"
                  )}
                </Button>
                <Button onClick={handleClear} disabled={loading} variant="destructive" size="lg">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>

              {/* Quick Links */}
              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-medium">After seeding, try:</p>
                <div className="grid grid-cols-2 gap-2">
                  <a href="/exceptions" className="text-primary text-sm hover:underline">
                    → View Exceptions Queue
                  </a>
                  <a href="/export" className="text-primary text-sm hover:underline">
                    → Export Approved
                  </a>
                  <a href="/upload" className="text-primary text-sm hover:underline">
                    → Upload New Invoice
                  </a>
                  <a href="/" className="text-primary text-sm hover:underline">
                    → Back to Home
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
