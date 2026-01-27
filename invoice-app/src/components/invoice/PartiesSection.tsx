"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Building2, User, Truck } from "lucide-react";
import type { InvoiceParties, Party } from "@/types/full-invoice";

interface PartiesSectionProps {
  parties: InvoiceParties;
}

function PartyCard({
  title,
  party,
  icon,
}: {
  title: string;
  party: Party | { name: string | null; address: string | null };
  icon: React.ReactNode;
}) {
  const hasData = party.name || party.address;

  if (!hasData) return null;

  return (
    <div className="bg-card space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-2 font-medium">
        {icon}
        <span>{title}</span>
      </div>
      {party.name && <div className="text-sm">{party.name}</div>}
      {party.address && (
        <div className="text-muted-foreground text-sm whitespace-pre-line">{party.address}</div>
      )}
      {"email" in party && party.email && (
        <div className="text-muted-foreground text-sm">{party.email}</div>
      )}
      {"phone" in party && party.phone && (
        <div className="text-muted-foreground text-sm">{party.phone}</div>
      )}
      {"tax_id" in party && party.tax_id && (
        <div className="text-muted-foreground text-sm">Tax ID: {party.tax_id}</div>
      )}
    </div>
  );
}

export function PartiesSection({ parties }: PartiesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!parties) return null;

  const hasData =
    parties.seller?.name ||
    parties.seller?.address ||
    parties.buyer?.name ||
    parties.buyer?.address ||
    parties.ship_to?.name ||
    parties.ship_to?.address;

  if (!hasData) return null;

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          )}
          <CardTitle className="text-base">Parties & Addresses</CardTitle>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <PartyCard
              title="Seller/Vendor"
              party={parties.seller}
              icon={<Building2 className="h-4 w-4" />}
            />
            <PartyCard title="Buyer" party={parties.buyer} icon={<User className="h-4 w-4" />} />
            <PartyCard
              title="Ship To"
              party={parties.ship_to}
              icon={<Truck className="h-4 w-4" />}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
