"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Prints the menu. The @media print rules in globals.css strip the chrome. */
export function PrintButton({ label = "Print this menu" }: { label?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="no-print"
      onClick={() => window.print()}
    >
      <Printer className="size-4" />
      {label}
    </Button>
  );
}
