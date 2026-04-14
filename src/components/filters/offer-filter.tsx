"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OfferFilter({ offers }: { offers: string[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const current = searchParams.get("offer") ?? "";

  function handleSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete("offer");
    } else {
      params.set("offer", value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-sm text-muted-foreground mr-1">Oferta:</span>
      <Button
        variant={!current ? "default" : "outline"}
        size="sm"
        className="text-xs"
        onClick={() => handleSelect("")}
      >
        Todas
      </Button>
      {offers.map((name) => (
        <Button
          key={name}
          variant={current === name ? "default" : "outline"}
          size="sm"
          className={cn("text-xs")}
          onClick={() => handleSelect(name)}
        >
          {name}
        </Button>
      ))}
    </div>
  );
}
