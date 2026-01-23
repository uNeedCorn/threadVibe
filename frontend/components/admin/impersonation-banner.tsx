"use client";

import { X } from "lucide-react";
import { useAdmin } from "@/contexts/admin-context";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner() {
  const { isImpersonating, impersonationTarget, stopImpersonation } = useAdmin();

  if (!isImpersonating || !impersonationTarget) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-amber-500 px-4 py-2 text-amber-950">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>Impersonating:</span>
        <span className="font-bold">
          {impersonationTarget.workspaceName} / @{impersonationTarget.accountUsername}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={stopImpersonation}
        className="h-6 w-6 p-0 text-amber-950 hover:bg-amber-600 hover:text-amber-950"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Stop impersonation</span>
      </Button>
    </div>
  );
}
