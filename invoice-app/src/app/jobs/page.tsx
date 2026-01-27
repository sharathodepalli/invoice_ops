"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { formatFileSize, formatDate } from "@/lib/utils";
import Link from "next/link";

interface Job {
  id: string;
  filename: string;
  fileSize: number;
  status: "pending" | "processing" | "completed" | "failed";
  uploadedAt: string;
  processedAt?: string;
  errorMessage?: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/jobs");
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: Job["status"]) => {
    const variants: Record<Job["status"], any> = {
      pending: "outline",
      processing: "default",
      completed: "success",
      failed: "destructive",
    };
    return (
      <Badge variant={variants[status]} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getStatusIcon = (status: Job["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="text-destructive h-5 w-5" />;
      case "processing":
        return <RefreshCw className="text-primary h-5 w-5 animate-spin" />;
      default:
        return <Clock className="text-muted-foreground h-5 w-5" />;
    }
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
            <Link href="/jobs" className="text-foreground text-sm font-medium">
              Jobs
            </Link>
            <Link
              href="/exceptions"
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Exceptions
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-6xl">
          {/* Page Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-bold">Processing Jobs</h1>
              <p className="text-muted-foreground">Track the status of your uploaded invoices</p>
            </div>
            <Button onClick={fetchJobs} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* Jobs List */}
          <Card>
            <CardHeader>
              <CardTitle>All Jobs</CardTitle>
              <CardDescription>
                {jobs.length} {jobs.length === 1 ? "job" : "jobs"} total
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && jobs.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center">
                  <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin" />
                  <p>Loading jobs...</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center">
                  <FileText className="mx-auto mb-4 h-12 w-12" />
                  <p className="mb-2 text-lg font-medium">No jobs yet</p>
                  <p className="text-sm">Upload some invoices to get started</p>
                  <Link href="/upload">
                    <Button className="mt-4">Upload Invoices</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center gap-4 rounded-lg border p-4 transition-shadow hover:shadow-md"
                    >
                      {getStatusIcon(job.status)}
                      <div className="flex-1">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="font-medium">{job.filename}</p>
                          {getStatusBadge(job.status)}
                        </div>
                        <div className="text-muted-foreground flex gap-4 text-sm">
                          <span>{formatFileSize(job.fileSize)}</span>
                          <span>•</span>
                          <span>Uploaded {formatDate(job.uploadedAt)}</span>
                          {job.processedAt && (
                            <>
                              <span>•</span>
                              <span>Processed {formatDate(job.processedAt)}</span>
                            </>
                          )}
                        </div>
                        {job.errorMessage && (
                          <p className="text-destructive mt-2 text-sm">{job.errorMessage}</p>
                        )}
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
  );
}
