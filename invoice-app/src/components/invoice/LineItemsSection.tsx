"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Edit2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { FullInvoice, LineItem } from "@/types/full-invoice";

interface LineItemsProps {
  lineItems: LineItem[];
  currency: string;
  onEdit?: () => void;
}

export function LineItemsSection({ lineItems, currency, onEdit }: LineItemsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            )}
            <CardTitle className="text-base">Line Items</CardTitle>
            <Badge variant="secondary">{lineItems.length}</Badge>
          </div>
          {onEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left">Description</th>
                  <th className="px-2 py-2 text-left">SKU</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-left">UOM</th>
                  <th className="px-2 py-2 text-right">Unit Price</th>
                  <th className="px-2 py-2 text-right">Tax %</th>
                  <th className="px-2 py-2 text-right">Discount</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="px-2 py-2">{item.description || "—"}</td>
                    <td className="text-muted-foreground px-2 py-2">{item.sku || "—"}</td>
                    <td className="px-2 py-2 text-right">
                      {item.quantity !== null ? item.quantity : "—"}
                    </td>
                    <td className="px-2 py-2">{item.uom || "—"}</td>
                    <td className="px-2 py-2 text-right">
                      {item.unit_price !== null ? formatCurrency(item.unit_price, currency) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {item.tax_rate !== null ? `${(item.tax_rate * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {item.discount !== null ? formatCurrency(item.discount, currency) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right font-medium">
                      {item.line_total !== null ? formatCurrency(item.line_total, currency) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td colSpan={7} className="px-2 py-2 text-right">
                    Subtotal:
                  </td>
                  <td className="px-2 py-2 text-right">
                    {formatCurrency(
                      lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0),
                      currency
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
