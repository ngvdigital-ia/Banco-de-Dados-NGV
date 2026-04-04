"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EntityFiltersProps {
  filters: {
    niches: string[];
    languages: string[];
    statuses: string[];
  };
}

const statusLabels: Record<string, string> = {
  em_teste: "Em Teste",
  rodando: "Rodando",
  pausado: "Pausado",
};

export function EntityFilters({ filters }: EntityFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentNiche = searchParams.get("niche") ?? "";
  const currentLanguage = searchParams.get("language") ?? "";
  const currentStatus = searchParams.get("status") ?? "";

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "__all__") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3">
      <Select
        value={currentNiche || "__all__"}
        onValueChange={(val) => updateParam("niche", val)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Nicho" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos os Nichos</SelectItem>
          {filters.niches.map((n) => (
            <SelectItem key={n} value={n}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentLanguage || "__all__"}
        onValueChange={(val) => updateParam("language", val)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Idioma" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos os Idiomas</SelectItem>
          {filters.languages.map((l) => (
            <SelectItem key={l} value={l}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentStatus || "__all__"}
        onValueChange={(val) => updateParam("status", val)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos os Status</SelectItem>
          {filters.statuses.map((s) => (
            <SelectItem key={s} value={s}>
              {statusLabels[s] ?? s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
