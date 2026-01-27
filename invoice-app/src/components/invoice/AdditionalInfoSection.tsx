"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight, CreditCard, Building, FileText } from "lucide-react";
import type { PaymentInfo, TaxDetail, Discount } from "@/types/full-invoice";
import { formatCurrency } from "@/lib/utils";

interface AdditionalInfoProps {
  payment: PaymentInfo;
  taxes: TaxDetail[];
  discounts: Discount[];
  notes: string[];
  currency: string;
}

export function AdditionalInfoSection({
  payment,
  taxes,
  discounts,
  notes,
  currency,
}: AdditionalInfoProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const hasPaymentData =
    payment?.method ||
    payment?.bank_details?.iban ||
    payment?.bank_details?.swift ||
    payment?.bank_details?.account_number ||
    payment?.bank_details?.routing_number ||
    payment?.remittance_info;

  const hasTaxes = taxes && Array.isArray(taxes) && taxes.length > 0;
  const hasDiscounts = discounts && Array.isArray(discounts) && discounts.length > 0;
  const hasNotes = notes && Array.isArray(notes) && notes.length > 0;

  const hasAnyData = hasPaymentData || hasTaxes || hasDiscounts || hasNotes;

  if (!hasAnyData) return null;

  return (
    <div className="space-y-4">
      {/* Payment Information */}
      {hasPaymentData && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => toggleSection("payment")}>
            <div className="flex items-center gap-2">
              {expandedSections.payment ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
              <CreditCard className="text-muted-foreground h-4 w-4" />
              <CardTitle className="text-base">Payment Information</CardTitle>
            </div>
          </CardHeader>
          {expandedSections.payment && (
            <CardContent className="space-y-3">
              {payment.method && (
                <div>
                  <div className="text-sm font-medium">Method</div>
                  <div className="text-muted-foreground text-sm">{payment.method}</div>
                </div>
              )}
              {(payment.bank_details.iban ||
                payment.bank_details.swift ||
                payment.bank_details.account_number ||
                payment.bank_details.routing_number) && (
                <div>
                  <div className="mb-2 text-sm font-medium">Bank Details</div>
                  <div className="text-muted-foreground space-y-1 text-sm">
                    {payment.bank_details.iban && <div>IBAN: {payment.bank_details.iban}</div>}
                    {payment.bank_details.swift && <div>SWIFT: {payment.bank_details.swift}</div>}
                    {payment.bank_details.account_number && (
                      <div>Account: {payment.bank_details.account_number}</div>
                    )}
                    {payment.bank_details.routing_number && (
                      <div>Routing: {payment.bank_details.routing_number}</div>
                    )}
                  </div>
                </div>
              )}
              {payment.remittance_info && (
                <div>
                  <div className="text-sm font-medium">Remittance Info</div>
                  <div className="text-muted-foreground text-sm whitespace-pre-line">
                    {payment.remittance_info}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Tax Breakdown */}
      {hasTaxes && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => toggleSection("taxes")}>
            <div className="flex items-center gap-2">
              {expandedSections.taxes ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
              <FileText className="text-muted-foreground h-4 w-4" />
              <CardTitle className="text-base">Tax Breakdown</CardTitle>
            </div>
          </CardHeader>
          {expandedSections.taxes && (
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Type</th>
                    <th className="py-2 text-right">Rate</th>
                    <th className="py-2 text-right">Taxable Amount</th>
                    <th className="py-2 text-right">Tax Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {taxes.map((tax, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-2">
                        {tax.type || "Tax"}
                        {tax.tax_id && (
                          <div className="text-muted-foreground text-xs">{tax.tax_id}</div>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {tax.rate !== null ? `${(tax.rate * 100).toFixed(2)}%` : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {tax.base !== null ? formatCurrency(tax.base, currency) : "—"}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {tax.amount !== null ? formatCurrency(tax.amount, currency) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          )}
        </Card>
      )}

      {/* Discounts */}
      {hasDiscounts && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => toggleSection("discounts")}>
            <div className="flex items-center gap-2">
              {expandedSections.discounts ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
              <CardTitle className="text-base">Discounts</CardTitle>
            </div>
          </CardHeader>
          {expandedSections.discounts && (
            <CardContent>
              <div className="space-y-2">
                {discounts.map((discount, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{discount.description || `Discount ${index + 1}`}</span>
                    <span className="font-medium">
                      {discount.amount !== null ? formatCurrency(discount.amount, currency) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Notes */}
      {hasNotes && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => toggleSection("notes")}>
            <div className="flex items-center gap-2">
              {expandedSections.notes ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
              <CardTitle className="text-base">Notes & Comments</CardTitle>
            </div>
          </CardHeader>
          {expandedSections.notes && (
            <CardContent>
              <div className="space-y-2">
                {notes.map((note, index) => (
                  <div key={index} className="text-muted-foreground text-sm">
                    {note}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
