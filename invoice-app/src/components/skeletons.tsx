import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function InvoiceSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
          <div className="bg-muted h-5 w-5 animate-pulse rounded"></div>
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-4 w-1/3 animate-pulse rounded"></div>
            <div className="flex gap-4">
              <div className="bg-muted h-3 w-16 animate-pulse rounded"></div>
              <div className="bg-muted h-3 w-16 animate-pulse rounded"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function JobsSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center justify-between border-b pb-4">
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-4 w-2/3 animate-pulse rounded"></div>
            <div className="bg-muted h-3 w-1/3 animate-pulse rounded"></div>
          </div>
          <div className="bg-muted h-6 w-16 animate-pulse rounded"></div>
        </div>
      ))}
    </div>
  );
}

export function InvoiceDetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left - PDF Viewer */}
      <Card>
        <CardHeader>
          <div className="bg-muted mb-2 h-6 w-32 animate-pulse rounded"></div>
          <div className="bg-muted h-4 w-48 animate-pulse rounded"></div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted aspect-[8.5/11] w-full animate-pulse rounded-lg"></div>
        </CardContent>
      </Card>

      {/* Right - Fields */}
      <div className="space-y-6">
        {/* Validation Card */}
        <Card>
          <CardHeader>
            <div className="bg-muted h-5 w-40 animate-pulse rounded"></div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-muted h-16 animate-pulse rounded"></div>
            ))}
          </CardContent>
        </Card>

        {/* Data Card */}
        <Card>
          <CardHeader>
            <div className="bg-muted h-6 w-32 animate-pulse rounded"></div>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="bg-muted h-4 w-24 animate-pulse rounded"></div>
                <div className="bg-muted h-10 w-full animate-pulse rounded"></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ExportSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
            <div className="bg-muted h-5 w-5 animate-pulse rounded"></div>
            <div className="flex-1 space-y-2">
              <div className="bg-muted h-4 w-2/3 animate-pulse rounded"></div>
              <div className="bg-muted h-3 w-1/3 animate-pulse rounded"></div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-muted h-64 animate-pulse rounded-lg border"></div>
    </div>
  );
}
