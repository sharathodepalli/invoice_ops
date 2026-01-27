"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { formatFileSize } from "@/lib/utils";
import type { UploadProgress } from "@/types";

import Link from "next/link";

export default function UploadPage() {
  const [files, setFiles] = useState<UploadProgress[]>([]);

  const uploadFile = async (file: File, index: number) => {
    try {
      setFiles((prev) => {
        const updated = [...prev];
        updated[index].status = "uploading";
        return updated;
      });

      const formData = new FormData();
      formData.append("file", file);

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setFiles((prev) => {
            const updated = [...prev];
            updated[index].progress = percentComplete;
            return updated;
          });
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          setFiles((prev) => {
            const updated = [...prev];
            updated[index].status = "processing";
            updated[index].progress = 100;
            return updated;
          });

          // Simulate processing time
          setTimeout(() => {
            setFiles((prev) => {
              const updated = [...prev];
              updated[index].status = "complete";
              return updated;
            });
          }, 2000);
        } else {
          setFiles((prev) => {
            const updated = [...prev];
            updated[index].status = "error";
            updated[index].error = "Upload failed";
            return updated;
          });
        }
      });

      xhr.addEventListener("error", () => {
        setFiles((prev) => {
          const updated = [...prev];
          updated[index].status = "error";
          updated[index].error = "Network error";
          return updated;
        });
      });

      xhr.open("POST", "/api/upload");
      xhr.send(formData);
    } catch (error) {
      setFiles((prev) => {
        const updated = [...prev];
        updated[index].status = "error";
        updated[index].error = error instanceof Error ? error.message : "Upload failed";
        return updated;
      });
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles: UploadProgress[] = acceptedFiles.map((file) => ({
        file,
        progress: 0,
        status: "pending",
      }));
      setFiles((prev) => [...prev, ...newFiles]);

      // Upload files via API
      newFiles.forEach((fileProgress, index) => {
        uploadFile(fileProgress.file, files.length + index);
      });
    },
    [files.length]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getStatusIcon = (status: UploadProgress["status"]) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="text-destructive h-5 w-5" />;
      case "uploading":
      case "processing":
        return <Loader2 className="text-primary h-5 w-5 animate-spin" />;
      default:
        return <FileText className="text-muted-foreground h-5 w-5" />;
    }
  };

  const getStatusBadge = (status: UploadProgress["status"]) => {
    const variants: Record<UploadProgress["status"], any> = {
      pending: "outline",
      uploading: "default",
      processing: "default",
      complete: "success",
      error: "destructive",
    };
    return (
      <Badge variant={variants[status]} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 border-b backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
              <Upload className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">Invoice Automation</span>
          </div>
          <nav className="flex gap-6">
            <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
              Home
            </Link>
            <Link href="/upload" className="text-foreground text-sm font-medium">
              Upload
            </Link>
            <Link href="/jobs" className="text-muted-foreground hover:text-foreground text-sm">
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
        <div className="mx-auto max-w-4xl">
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold">Upload Invoices</h1>
            <p className="text-muted-foreground">
              Upload single or batch PDF invoices for automated processing
            </p>
          </div>

          {/* Drop Zone */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Drag & Drop Files</CardTitle>
              <CardDescription>
                Supports PDF files up to 10MB each. Process multiple invoices at once.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                {isDragActive ? (
                  <p className="text-lg font-medium">Drop files here...</p>
                ) : (
                  <>
                    <p className="mb-2 text-lg font-medium">
                      Drag & drop PDF files here, or click to select
                    </p>
                    <p className="text-muted-foreground text-sm">Maximum file size: 10MB</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Files List */}
          {files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Processing Queue</CardTitle>
                <CardDescription>{files.length} file(s) in queue</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {files.map((fileProgress, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 rounded-lg border p-4 transition-shadow hover:shadow-md"
                  >
                    {getStatusIcon(fileProgress.status)}
                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="font-medium">{fileProgress.file.name}</p>
                        {getStatusBadge(fileProgress.status)}
                      </div>
                      <p className="text-muted-foreground mb-2 text-sm">
                        {formatFileSize(fileProgress.file.size)}
                      </p>
                      {(fileProgress.status === "uploading" ||
                        fileProgress.status === "processing") && (
                        <div className="bg-secondary h-2 overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full transition-all duration-300"
                            style={{ width: `${fileProgress.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                      disabled={
                        fileProgress.status === "uploading" || fileProgress.status === "processing"
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
