"use client";

import { useTransition } from "react";
import { deleteEstimate } from "@/lib/actions/estimates";
import { Button } from "@/components/ui/button";

export function DeleteEstimateButton({ estimateId, eventName }: { estimateId: string; eventName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="danger"
      className="px-2.5 py-1 text-xs"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Delete "${eventName}"? This can't be undone.`)) return;
        startTransition(() => deleteEstimate(estimateId));
      }}
    >
      {isPending ? "Deleting…" : "Delete"}
    </Button>
  );
}
