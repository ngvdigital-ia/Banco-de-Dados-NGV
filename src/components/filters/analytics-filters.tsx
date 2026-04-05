"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helper: parse comma-separated URL param into an array of non-empty strings
// ---------------------------------------------------------------------------
export function parseMultiParam(
  param: string | string[] | undefined
): string[] {
  if (param === undefined || param === null) return [];
  const raw = Array.isArray(param) ? param.join(",") : param;
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AnalyticsFiltersProps = {
  options: {
    niches: string[];
    languages: string[];
    copywriters: { id: number; name: string }[];
    editors: { id: number; name: string }[];
    formats: string[];
    statuses: string[];
  };
  showFormats?: boolean;
  showEditors?: boolean;
};

type DropdownOption = { value: string; label: string };

// ---------------------------------------------------------------------------
// Multi-select dropdown (internal)
// ---------------------------------------------------------------------------
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: DropdownOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const count = selected.length;

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {label}
        {count > 0 && (
          <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {count}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 top-full z-50 mt-1 max-h-60 min-w-[180px] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Sem opcoes
            </p>
          )}
          {options.map((opt) => {
            const isChecked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                role="option"
                aria-selected={isChecked}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted",
                  isChecked && "font-medium"
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(opt.value)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <span className="truncate">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Param keys used in the URL
// ---------------------------------------------------------------------------
const PARAM_KEYS = {
  niche: "niche",
  language: "language",
  copy: "copy",
  editor: "editor",
  format: "format",
  status: "status",
} as const;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function AnalyticsFilters({
  options,
  showFormats = true,
  showEditors = true,
}: AnalyticsFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read current selections from URL
  const selected = {
    niche: parseMultiParam(searchParams.get(PARAM_KEYS.niche) ?? undefined),
    language: parseMultiParam(
      searchParams.get(PARAM_KEYS.language) ?? undefined
    ),
    copy: parseMultiParam(searchParams.get(PARAM_KEYS.copy) ?? undefined),
    editor: parseMultiParam(searchParams.get(PARAM_KEYS.editor) ?? undefined),
    format: parseMultiParam(searchParams.get(PARAM_KEYS.format) ?? undefined),
    status: parseMultiParam(searchParams.get(PARAM_KEYS.status) ?? undefined),
  };

  // Generic handler that updates one param key
  const updateParam = useCallback(
    (key: string, values: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (values.length === 0) {
        params.delete(key);
      } else {
        params.set(key, values.join(","));
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const hasAnyFilter = Object.values(selected).some((v) => v.length > 0);

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    Object.values(PARAM_KEYS).forEach((k) => params.delete(k));
    router.push(`${pathname}?${params.toString()}`);
  }

  // Build option arrays
  const nicheOpts: DropdownOption[] = options.niches.map((n) => ({
    value: n,
    label: n,
  }));
  const languageOpts: DropdownOption[] = options.languages.map((l) => ({
    value: l,
    label: l,
  }));
  const copyOpts: DropdownOption[] = options.copywriters.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));
  const editorOpts: DropdownOption[] = options.editors.map((e) => ({
    value: String(e.id),
    label: e.name,
  }));
  const formatOpts: DropdownOption[] = options.formats.map((f) => ({
    value: f,
    label: f,
  }));
  const statusOpts: DropdownOption[] = options.statuses.map((s) => ({
    value: s,
    label: s,
  }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelectDropdown
        label="Nicho"
        options={nicheOpts}
        selected={selected.niche}
        onChange={(v) => updateParam(PARAM_KEYS.niche, v)}
      />

      <MultiSelectDropdown
        label="Idioma"
        options={languageOpts}
        selected={selected.language}
        onChange={(v) => updateParam(PARAM_KEYS.language, v)}
      />

      <MultiSelectDropdown
        label="Copywriter"
        options={copyOpts}
        selected={selected.copy}
        onChange={(v) => updateParam(PARAM_KEYS.copy, v)}
      />

      {showEditors && (
        <MultiSelectDropdown
          label="Editor"
          options={editorOpts}
          selected={selected.editor}
          onChange={(v) => updateParam(PARAM_KEYS.editor, v)}
        />
      )}

      {showFormats && (
        <MultiSelectDropdown
          label="Formato"
          options={formatOpts}
          selected={selected.format}
          onChange={(v) => updateParam(PARAM_KEYS.format, v)}
        />
      )}

      <MultiSelectDropdown
        label="Status"
        options={statusOpts}
        selected={selected.status}
        onChange={(v) => updateParam(PARAM_KEYS.status, v)}
      />

      {hasAnyFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={clearAll}
        >
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
