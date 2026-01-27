import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSearch, CheckCircle2, Download, Zap, Shield, BarChart3 } from "lucide-react";

export default function Home() {
  return (
    <div className="from-background via-secondary/20 to-background min-h-screen bg-gradient-to-b">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <div className="bg-secondary mb-8 inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium">
            <Zap className="text-primary mr-2 h-4 w-4" />
            AI-Powered Invoice Automation
          </div>
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Transform Your
            <span className="from-primary block bg-gradient-to-r to-blue-600 bg-clip-text text-transparent">
              Invoice Processing
            </span>
          </h1>
          <p className="text-muted-foreground mx-auto mb-10 max-w-2xl text-lg sm:text-xl">
            Automate extraction, validation, and approval of invoices with industry-leading
            accuracy. Save time, reduce errors, and streamline your AP workflow.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/upload">
              <Button size="lg" className="w-full sm:w-auto">
                <Upload className="mr-2 h-5 w-5" />
                Start Processing
              </Button>
            </Link>
            <Link href="/exceptions">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                View Exceptions Queue
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-card border-y">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="text-primary mb-2 text-4xl font-bold">80%+</div>
              <div className="text-muted-foreground text-sm">Extraction Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-primary mb-2 text-4xl font-bold">10x</div>
              <div className="text-muted-foreground text-sm">Faster Processing</div>
            </div>
            <div className="text-center">
              <div className="text-primary mb-2 text-4xl font-bold">100%</div>
              <div className="text-muted-foreground text-sm">Audit Trail</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, Powerful Workflow
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            From upload to export in minutes, not hours
          </p>
        </div>
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-2 transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="bg-primary/10 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg">
                <Upload className="text-primary h-6 w-6" />
              </div>
              <CardTitle>1. Upload</CardTitle>
              <CardDescription>
                Drag & drop single or batch PDF invoices. Instant upload with progress tracking.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-2 transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="bg-primary/10 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg">
                <FileSearch className="text-primary h-6 w-6" />
              </div>
              <CardTitle>2. Extract</CardTitle>
              <CardDescription>
                AI-powered OCR extracts vendor, amounts, dates, and PO numbers with confidence
                scores.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-2 transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="bg-primary/10 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg">
                <CheckCircle2 className="text-primary h-6 w-6" />
              </div>
              <CardTitle>3. Validate</CardTitle>
              <CardDescription>
                Smart validation catches errors, duplicates, and exceptions before they reach your
                ERP.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-2 transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="bg-primary/10 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg">
                <Download className="text-primary h-6 w-6" />
              </div>
              <CardTitle>4. Export</CardTitle>
              <CardDescription>
                One-click CSV export ready for your ERP system. Full audit trail included.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-secondary/20 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Enterprise-Grade Features
            </h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Everything you need to automate your AP workflow
            </p>
          </div>
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <Shield className="text-primary mb-2 h-8 w-8" />
                <CardTitle className="text-lg">Smart Validation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Automatic duplicate detection, total verification, and missing field alerts.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <BarChart3 className="text-primary mb-2 h-8 w-8" />
                <CardTitle className="text-lg">Confidence Scoring</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Know which fields need review with High/Med/Low confidence indicators.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CheckCircle2 className="text-primary mb-2 h-8 w-8" />
                <CardTitle className="text-lg">Exception Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Review, edit, and approve exceptions with a streamlined workflow.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="border-primary/20 from-primary/5 mx-auto max-w-3xl border-2 bg-gradient-to-br to-transparent">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Ready to Get Started?</CardTitle>
            <CardDescription className="text-lg">
              Join forward-thinking teams who have automated their invoice processing
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-4">
            <Link href="/upload">
              <Button size="lg">
                <Upload className="mr-2 h-5 w-5" />
                Upload Your First Invoice
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-muted-foreground text-sm">
              © 2026 The Shades Invoice Automation. Built with Next.js, TypeScript, and AI
              intelligence.
            </p>
            <div className="flex gap-4">
              <Link href="/upload">
                <Button variant="ghost" size="sm">
                  Upload
                </Button>
              </Link>
              <Link href="/exceptions">
                <Button variant="ghost" size="sm">
                  Exceptions
                </Button>
              </Link>
              <Link href="/export">
                <Button variant="ghost" size="sm">
                  Export
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
