"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { Trash2, ExternalLink, Pencil, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { updateOfferField, deleteOffer, duplicateOffer } from "@/app/(dashboard)/offers/actions";
import { type SiteUrls, primaryUrl, totalLinks } from "@/lib/site-urls-types";
import { SiteUrlsDialog } from "@/components/offers/site-urls-dialog";

// ---------- Types ----------

type Offer = {
  id: number;
  name: string;
  copyVsl: string | null;
  copyAds: string | null;
  editorAds: string | null;
  editorVsl: string | null;
  ticket: string | null;
  language: string;
  gender: string | null;
  copyVslStatus: string | null;
  copyCriativosStatus: string | null;
  vslInVturb: string | null;
  adsCopyByPerson: unknown;
  adsEditedCount: number | null;
  adsEditedByPerson: unknown;
  adsRejectedCount: number | null;
  editorStatus: unknown;
  campaignsActive: string | null;
  validation: string | null;
  preScale: string | null;
  scale: string | null;
  productCreated: string | null;
  productApproved: string | null;
  siteCreated: string | null;
  siteUrl: string | null;
  siteUrls: unknown;
  adFormat: string | null;
  observations: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ---------- Status helpers ----------

const STATUS_CYCLE = ["SIM", "NAO", "EM ANDAMENTO", "NÃO DEU CERTO"] as const;

type StatusValue = (typeof STATUS_CYCLE)[number];

function nextStatus(current: string | null): StatusValue {
  const upper = (current || "NAO").toUpperCase().trim();
  const idx = STATUS_CYCLE.findIndex((s) => s === upper);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

const statusColors: Record<string, string> = {
  SIM: "bg-success-muted text-success-muted-foreground border-success",
  NAO: "bg-danger-muted text-danger-muted-foreground border-danger",
  "EM ANDAMENTO": "bg-warning-muted text-warning-muted-foreground border-warning",
  "NÃO DEU CERTO":
    "bg-muted text-muted-foreground border-border line-through",
};

function getStatusColor(val: string | null) {
  const upper = (val || "NAO").toUpperCase().trim();
  return statusColors[upper] || statusColors["NAO"];
}

// ---------- Progress calculation ----------

const PROGRESS_FIELDS = [
  "copyVslStatus",
  "copyCriativosStatus",
  "vslInVturb",
  "productCreated",
  "productApproved",
  "siteCreated",
  "validation",
  "scale",
] as const;

function calcProgress(offer: Offer): number {
  return PROGRESS_FIELDS.filter((f) => {
    const val = (offer[f] || "").toUpperCase().trim();
    return val === "SIM";
  }).length;
}

// ---------- Fixed options ----------

// Siglas: DG=Diogo, GF=Gabriel Fischer, GL=Gabriel Lima, RO=Robert, MALU=Malu, VA=Victor Andrade, CA=Camile, LF=Luis Felipe
import { COPYWRITERS, EDITORS, LANGUAGES, NAME_TO_SIGLA, AD_FORMATS, FORMAT_LABELS } from "@/lib/team-utils";


// ---------- SelectCell ----------

function SelectCell({
  value,
  offerId,
  field,
  options,
  labels,
}: {
  value: string | null;
  offerId: number;
  field: string;
  options: string[];
  labels?: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();

  // Match value: try sigla first, then name→sigla conversion, then case-insensitive
  const normalizedValue = (() => {
    if (!value) return "";
    // Direct match
    const direct = options.find((o) => o.toLowerCase() === value.toLowerCase());
    if (direct) return direct;
    // Name→sigla conversion (e.g., "Diogo" → "DG")
    const sigla = NAME_TO_SIGLA[value.toLowerCase()];
    if (sigla) return sigla;
    return value;
  })();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newVal = e.target.value;
    startTransition(async () => {
      await updateOfferField(offerId, field, newVal || null);
    });
  }

  // Check if normalized value matches any option — if not, show as extra option
  const hasUnmatchedValue = normalizedValue && !options.includes(normalizedValue);

  return (
    <select
      value={normalizedValue}
      onChange={handleChange}
      disabled={isPending}
      className={`w-full bg-transparent border-0 text-[13px] h-7 px-1 cursor-pointer outline-none focus:ring-1 focus:ring-primary/30 rounded ${isPending ? "opacity-50" : ""}`}
    >
      <option value="">-</option>
      {hasUnmatchedValue && normalizedValue && (
        <option value={normalizedValue}>{normalizedValue}</option>
      )}
      {options.map((opt) => (
        <option key={opt} value={opt}>{labels?.[opt] || opt}</option>
      ))}
    </select>
  );
}

// ---------- MultiSelectCell (for multi-person fields like editorAds, copyAds) ----------

function MultiSelectCell({
  value,
  offerId,
  field,
  options,
}: {
  value: string | null;
  offerId: number;
  field: string;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Parse current value into selected options
  const selected = (value ?? "")
    .split(/\s*[&,]\s*/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  function toggle(opt: string) {
    const upper = opt.toUpperCase();
    let newSelected: string[];
    if (selected.includes(upper)) {
      newSelected = selected.filter((s) => s !== upper);
    } else {
      newSelected = [...selected, upper];
    }
    const newValue = newSelected.join(" & ");
    startTransition(async () => {
      await updateOfferField(offerId, field, newValue || null);
    });
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const display = selected.length > 0 ? selected.join(" & ") : "-";

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(!open)}
        className={`cursor-pointer truncate rounded px-1 py-0.5 text-xs font-medium hover:bg-muted ${isPending ? "opacity-50" : ""}`}
        title={value ?? ""}
      >
        {display}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-28 rounded-md border bg-background shadow-lg">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.toUpperCase())}
                onChange={() => toggle(opt)}
                className="h-3 w-3"
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Sub-components ----------

function EditableCell({
  value,
  offerId,
  field,
  type = "text",
}: {
  value: string | number | null;
  offerId: number;
  field: string;
  type?: "text" | "number";
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value ?? ""));
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function handleSave() {
    setEditing(false);
    const newValue =
      type === "number" ? parseInt(localValue, 10) || 0 : localValue;
    const oldValue = type === "number" ? (value ?? 0) : (value ?? "");
    if (String(newValue) !== String(oldValue)) {
      startTransition(async () => {
        await updateOfferField(
          offerId,
          field,
          localValue === "" ? null : newValue
        );
      });
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs outline-none focus:border-ring"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setLocalValue(String(value ?? ""));
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div
      onClick={() => {
        setLocalValue(String(value ?? ""));
        setEditing(true);
      }}
      className={`cursor-pointer rounded px-1 py-0.5 text-xs transition-colors duration-150 hover:border-b hover:border-dashed hover:border-zinc-300 dark:hover:border-zinc-600 ${isPending ? "opacity-50" : ""}`}
      title={String(value ?? "")}
    >
      {value !== null && value !== undefined && value !== "" && value !== 0 ? value : "-"}
    </div>
  );
}

function StatusBadge({
  value,
  offerId,
  field,
}: {
  value: string | null;
  offerId: number;
  field: string;
}) {
  const [isPending, startTransition] = useTransition();
  const display = (value || "NAO").toUpperCase().trim();

  function handleClick() {
    const next = nextStatus(value);
    startTransition(async () => {
      await updateOfferField(offerId, field, next);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex h-7 items-center justify-center rounded-full border px-2.5 text-[11px] font-medium whitespace-nowrap transition-all duration-150 select-none hover:scale-105 hover:opacity-90 ${getStatusColor(display)} ${isPending ? "opacity-50" : ""}`}
    >
      {display === "NÃO DEU CERTO"
        ? "N/CERTO"
        : display === "EM ANDAMENTO"
          ? "ANDAMENTO"
          : display}
    </button>
  );
}

function ProgressBar({ offer }: { offer: Offer }) {
  const count = calcProgress(offer);
  const pct = Math.round((count / 8) * 100);

  const color =
    pct >= 75
      ? "bg-success"
      : pct >= 50
        ? "bg-warning"
        : pct >= 25
          ? "bg-warning"
          : "bg-danger";

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-16 rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono font-medium tabular-nums text-muted-foreground">
        {count}/8
      </span>
    </div>
  );
}

function ObservationsCell({
  value,
  offerId,
}: {
  value: string | null;
  offerId: number;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value ?? "");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editing]);

  function handleSave() {
    setEditing(false);
    if (localValue !== (value ?? "")) {
      startTransition(async () => {
        await updateOfferField(
          offerId,
          "observations",
          localValue || null
        );
      });
    }
  }

  if (editing) {
    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          className="absolute left-0 top-0 z-30 h-24 w-64 rounded border border-input bg-background p-2 text-xs shadow-lg outline-none focus:border-ring"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setLocalValue(value ?? "");
              setEditing(false);
            }
          }}
        />
        <span className="text-xs opacity-0">placeholder</span>
      </div>
    );
  }

  const display = value
    ? value.length > 30
      ? value.slice(0, 30) + "..."
      : value
    : "-";

  return (
    <div
      onClick={() => {
        setLocalValue(value ?? "");
        setEditing(true);
      }}
      className={`cursor-pointer truncate rounded px-1 py-0.5 text-xs hover:border-b hover:border-dashed hover:border-zinc-300 dark:hover:border-zinc-600 ${isPending ? "opacity-50" : ""}`}
      title={value ?? ""}
    >
      {display}
    </div>
  );
}

function AdsCopyDisplay({
  value,
  offerId,
}: {
  value: unknown;
  offerId: number;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const data = (value as Record<string, number> | null) ?? {};
  const entries = Object.entries(data);

  const [diogoVal, setDiogoVal] = useState(String(data.DIOGO ?? 0));
  const [robertVal, setRobertVal] = useState(String(data.ROBERT ?? 0));
  const [gabrielVal, setGabrielVal] = useState(String(data.GABRIEL ?? 0));

  function handleSave() {
    setEditing(false);
    const newData: Record<string, number> = {};
    const d = parseInt(diogoVal, 10) || 0;
    const r = parseInt(robertVal, 10) || 0;
    const g = parseInt(gabrielVal, 10) || 0;
    if (d) newData.DIOGO = d;
    if (r) newData.ROBERT = r;
    if (g) newData.GABRIEL = g;
    startTransition(async () => {
      await updateOfferField(
        offerId,
        "adsCopyByPerson",
        JSON.stringify(newData) as unknown as string
      );
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <label className="flex items-center gap-0.5 text-[10px]">
          <span className="text-orange-600 font-semibold">DG</span>:
          <input
            className="h-5 w-8 rounded border px-0.5 text-[10px] text-center"
            value={diogoVal}
            onChange={(e) => setDiogoVal(e.target.value)}
            type="number"
          />
        </label>
        <label className="flex items-center gap-0.5 text-[10px]">
          <span className="text-blue-600 font-semibold">RO</span>:
          <input
            className="h-5 w-8 rounded border px-0.5 text-[10px] text-center"
            value={robertVal}
            onChange={(e) => setRobertVal(e.target.value)}
            type="number"
          />
        </label>
        <label className="flex items-center gap-0.5 text-[10px]">
          <span className="text-purple-600 font-semibold">GA</span>:
          <input
            className="h-5 w-8 rounded border px-0.5 text-[10px] text-center"
            value={gabrielVal}
            onChange={(e) => setGabrielVal(e.target.value)}
            type="number"
          />
        </label>
        <button
          onClick={handleSave}
          className="rounded bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground"
        >
          OK
        </button>
      </div>
    );
  }

  const keyToSigla: Record<string, string> = {
    DIOGO: "DG", ROBERT: "RO", GABRIEL: "GF", "GABRIEL FISCHER": "GF", "GABRIEL LIMA": "GL",
  };
  const siglaColors: Record<string, string> = {
    DG: "text-orange-600 dark:text-orange-400",
    RO: "text-blue-600 dark:text-blue-400",
    GA: "text-purple-600 dark:text-purple-400",
  };

  return (
    <div
      onClick={() => {
        setDiogoVal(String(data.DIOGO ?? 0));
        setRobertVal(String(data.ROBERT ?? 0));
        setGabrielVal(String(data.GABRIEL ?? 0));
        setEditing(true);
      }}
      className={`relative cursor-pointer truncate rounded px-1 py-0.5 text-[10px] hover:border-b hover:border-dashed hover:border-zinc-300 dark:hover:border-zinc-600 ${isPending ? "opacity-50" : ""}`}
    >
      {entries.length > 0 ? (
        <span className="flex items-center gap-1.5">
          {entries.map(([k, v]) => {
            const sigla = keyToSigla[k] || k[0];
            return (
              <span key={k} className="inline-flex items-center">
                <span className={`font-semibold ${siglaColors[sigla] || "text-zinc-600 dark:text-zinc-400"}`}>{sigla}</span>
                <span className="text-zinc-400 dark:text-zinc-500">:</span>
                <span className="tabular-nums font-mono font-medium text-zinc-700 dark:text-zinc-300">{v}</span>
              </span>
            );
          })}
        </span>
      ) : (
        "-"
      )}
    </div>
  );
}

// Pessoas EDITÁVEIS no popup de "ads por pessoa" — mudança de equipe = mexer SÓ aqui.
// 2026-06-12: saem VA (Victor) e CA (Camile); entra RO (Romulo). Keys históricas fora
// desta lista (VA/CA de ofertas antigas) são PRESERVADAS no save e seguem no display.
const ADS_PEOPLE: { key: string; sigla: string; color: string }[] = [
  { key: "MALU", sigla: "MA", color: "text-pink-600" },
  { key: "RO", sigla: "RO", color: "text-violet-600" },
  { key: "LF", sigla: "LF", color: "text-teal-600" },
];

function AdsEditDisplay({
  value,
  offerId,
}: {
  value: unknown;
  offerId: number;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const data = (value as Record<string, number> | null) ?? {};
  const entries = Object.entries(data).filter(([, v]) => Number(v) > 0);

  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(ADS_PEOPLE.map((p) => [p.key, String(data[p.key] ?? 0)])),
  );

  function handleSave() {
    setEditing(false);
    const newData: Record<string, number> = {};
    // Preserva keys históricas que o popup não gerencia (ex: VA/CA de quem saiu).
    const managed = new Set(ADS_PEOPLE.map((p) => p.key));
    for (const [k, v] of Object.entries(data)) {
      if (!managed.has(k) && Number(v) > 0) newData[k] = Number(v);
    }
    for (const p of ADS_PEOPLE) {
      const n = parseInt(vals[p.key], 10) || 0;
      if (n) newData[p.key] = n;
    }
    startTransition(async () => {
      await updateOfferField(
        offerId,
        "adsEditedByPerson",
        JSON.stringify(newData) as unknown as string
      );
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        {ADS_PEOPLE.map((p) => (
          <label key={p.key} className="flex items-center gap-0.5 text-[10px]">
            <span className={`${p.color} font-semibold`}>{p.sigla}</span>:
            <input
              className="h-5 w-8 rounded border px-0.5 text-[10px] text-center"
              value={vals[p.key]}
              onChange={(e) => setVals((prev) => ({ ...prev, [p.key]: e.target.value }))}
              type="number"
            />
          </label>
        ))}
        <button
          onClick={handleSave}
          className="rounded bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground"
        >
          OK
        </button>
      </div>
    );
  }

  const siglaColors: Record<string, string> = {
    MALU: "text-pink-600 dark:text-pink-400",
    MA: "text-pink-600 dark:text-pink-400",
    RO: "text-violet-600 dark:text-violet-400",
    VA: "text-cyan-600 dark:text-cyan-400",
    CA: "text-amber-600 dark:text-amber-400",
    LF: "text-teal-600 dark:text-teal-400",
  };

  return (
    <div
      onClick={() => {
        setVals(Object.fromEntries(ADS_PEOPLE.map((p) => [p.key, String(data[p.key] ?? 0)])));
        setEditing(true);
      }}
      className={`relative cursor-pointer truncate rounded px-1 py-0.5 text-[10px] hover:border-b hover:border-dashed hover:border-zinc-300 dark:hover:border-zinc-600 ${isPending ? "opacity-50" : ""}`}
    >
      {entries.length > 0 ? (
        <span className="flex items-center gap-1.5">
          {entries.map(([k, v]) => {
            const sigla = k === "MALU" ? "MA" : k;
            return (
              <span key={k} className="inline-flex items-center">
                <span className={`font-semibold ${siglaColors[k] || siglaColors[sigla] || "text-zinc-600 dark:text-zinc-400"}`}>{sigla}</span>
                <span className="text-zinc-400 dark:text-zinc-500">:</span>
                <span className="tabular-nums font-mono font-medium text-zinc-700 dark:text-zinc-300">{v}</span>
              </span>
            );
          })}
        </span>
      ) : (
        "-"
      )}
    </div>
  );
}


type LinkRow = { type: "VSL" | "White" | "Quiz" | "Outros"; label?: string; url: string };

function listAllLinks(d: SiteUrls | null): LinkRow[] {
  if (!d) return [];
  const out: LinkRow[] = [];
  if (d.vsl) out.push({ type: "VSL", url: d.vsl });
  d.whites?.forEach((u) => out.push({ type: "White", url: u }));
  if (d.quiz) out.push({ type: "Quiz", url: d.quiz });
  d.custom?.forEach((c) => out.push({ type: "Outros", label: c.label, url: c.url }));
  return out;
}

const TYPE_STYLES: Record<LinkRow["type"], string> = {
  VSL: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  White: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  Quiz: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  Outros: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function SiteUrlsCell({
  value,
  offerId,
  offerName,
}: {
  value: unknown;
  offerId: number;
  offerName: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [peekOpen, setPeekOpen] = useState(false);
  const peekRef = useRef<HTMLDivElement>(null);
  const data = (value as SiteUrls | null) ?? null;
  const main = primaryUrl(data);
  const total = totalLinks(data);
  const extra = main ? total - 1 : 0;
  const allLinks = listAllLinks(data);

  // Fecha popover ao clicar fora
  useEffect(() => {
    if (!peekOpen) return;
    function handler(e: MouseEvent) {
      if (peekRef.current && !peekRef.current.contains(e.target as Node)) {
        setPeekOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [peekOpen]);

  if (!main) {
    return (
      <>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="w-full rounded px-1 py-0.5 text-left text-xs text-muted-foreground hover:text-foreground hover:border-b hover:border-dashed hover:border-zinc-300 dark:hover:border-zinc-600"
        >
          + adicionar
        </button>
        <SiteUrlsDialog
          key={String(editOpen)}
          open={editOpen}
          onOpenChange={setEditOpen}
          offerId={offerId}
          offerName={offerName}
          initial={data}
        />
      </>
    );
  }

  const href = /^https?:\/\//i.test(main) ? main : `https://${main}`;
  const display = main.replace(/^https?:\/\//i, "").replace(/\/$/, "");

  return (
    <>
      <div className="relative flex items-center gap-1">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-1 truncate rounded px-1 py-0.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
          title={main}
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{display}</span>
        </a>
        {extra > 0 && (
          <button
            type="button"
            onClick={() => setPeekOpen((v) => !v)}
            className="flex-shrink-0 inline-flex items-center gap-0.5 rounded bg-zinc-100 px-1 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            title={`Ver ${extra} link${extra > 1 ? "s" : ""} extra${extra > 1 ? "s" : ""}`}
            aria-expanded={peekOpen}
          >
            +{extra}
            <ChevronDown
              className={`h-3 w-3 transition-transform ${peekOpen ? "rotate-180" : ""}`}
            />
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="flex-shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Editar domínios"
        >
          <Pencil className="h-3 w-3" />
        </button>

        {peekOpen && (
          <div
            ref={peekRef}
            className="absolute left-0 top-full z-50 mt-1 w-[320px] rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md"
          >
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                {total} link{total > 1 ? "s" : ""}{data?.domain ? ` · ${data.domain}` : ""}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPeekOpen(false);
                  setEditOpen(true);
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Editar"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
            <ul className="space-y-1">
              {allLinks.map((l, i) => {
                const linkHref = /^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}`;
                const linkDisplay = l.url
                  .replace(/^https?:\/\//i, "")
                  .replace(/\/$/, "");
                return (
                  <li key={i} className="flex items-center gap-1.5">
                    <span
                      className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${TYPE_STYLES[l.type]}`}
                    >
                      {l.type}
                    </span>
                    <a
                      href={linkHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
                      title={l.label ? `${l.label}: ${l.url}` : l.url}
                    >
                      {l.label && (
                        <span className="font-medium text-foreground">{l.label}: </span>
                      )}
                      {linkDisplay}
                    </a>
                    <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      <SiteUrlsDialog
        key={String(editOpen)}
        open={editOpen}
        onOpenChange={setEditOpen}
        offerId={offerId}
        offerName={offerName}
        initial={data}
      />
    </>
  );
}

function DeleteButton({ offerId }: { offerId: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => {
        if (confirm("Tem certeza que deseja excluir esta oferta?")) {
          startTransition(async () => {
            await deleteOffer(offerId);
          });
        }
      }}
      disabled={isPending}
      className={`rounded p-1 text-muted-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive ${isPending ? "opacity-50" : ""}`}
      title="Excluir oferta"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function CopyButton({ offerId }: { offerId: number }) {
  const [isPending, startTransition] = useTransition();

  function handleCopy() {
    startTransition(async () => {
      try {
        await duplicateOffer(offerId);
        toast.success("Oferta duplicada com sucesso");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao duplicar oferta");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={isPending}
      className={`rounded p-1 text-muted-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-accent hover:text-foreground ${isPending ? "opacity-50" : ""}`}
      title="Duplicar oferta"
      aria-label="Duplicar oferta"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

// ---------- Column definitions ----------

type ColumnDef = {
  key: string;
  label: string;
  width: string;
  sticky?: boolean;
  render: (offer: Offer) => React.ReactNode;
};

const columns: ColumnDef[] = [
  {
    key: "name",
    label: "Oferta",
    width: "w-[160px] min-w-[160px]",
    sticky: true,
    render: (o) => (
      <div className="flex items-center gap-1 min-w-0">
        <div className="flex-1 min-w-0">
          <EditableCell value={o.name} offerId={o.id} field="name" />
        </div>
        <Link
          href={`/offers/${o.id}`}
          className="flex-shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-accent hover:text-foreground"
          title={`Ver detalhes: ${o.name}`}
          aria-label={`Ver detalhes da oferta ${o.name}`}
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    ),
  },
  {
    key: "progress",
    label: "Progresso",
    width: "w-[110px] min-w-[110px]",
    render: (o) => <ProgressBar offer={o} />,
  },
  {
    key: "language",
    label: "Língua",
    width: "w-[70px] min-w-[70px]",
    render: (o) => (
      <SelectCell value={o.language} offerId={o.id} field="language" options={LANGUAGES} />
    ),
  },
  {
    key: "gender",
    label: "Gênero",
    width: "w-[100px] min-w-[100px]",
    render: (o) => (
      <SelectCell value={o.gender} offerId={o.id} field="gender" options={["Homens", "Mulheres", "Todos"]} />
    ),
  },
  {
    key: "copyVsl",
    label: "Copy VSL",
    width: "w-[100px] min-w-[100px]",
    render: (o) => (
      <SelectCell value={o.copyVsl} offerId={o.id} field="copyVsl" options={COPYWRITERS} />
    ),
  },
  {
    key: "copyAds",
    label: "Copy ADS",
    width: "w-[120px] min-w-[120px]",
    render: (o) => (
      <MultiSelectCell value={o.copyAds} offerId={o.id} field="copyAds" options={COPYWRITERS} />
    ),
  },
  {
    key: "editorAds",
    label: "Editor Ads",
    width: "w-[130px] min-w-[130px]",
    render: (o) => (
      <MultiSelectCell value={o.editorAds} offerId={o.id} field="editorAds" options={EDITORS} />
    ),
  },
  {
    key: "editorVsl",
    label: "Editor VSL",
    width: "w-[100px] min-w-[100px]",
    render: (o) => (
      <SelectCell value={o.editorVsl} offerId={o.id} field="editorVsl" options={EDITORS} />
    ),
  },
  {
    key: "ticket",
    label: "Ticket",
    width: "w-[70px] min-w-[70px]",
    render: (o) => (
      <span className="tabular-nums">
        <EditableCell value={o.ticket} offerId={o.id} field="ticket" />
      </span>
    ),
  },
  {
    key: "copyVslStatus",
    label: "Status VSL",
    width: "w-[80px] min-w-[80px]",
    render: (o) => (
      <StatusBadge
        value={o.copyVslStatus}
        offerId={o.id}
        field="copyVslStatus"
      />
    ),
  },
  {
    key: "copyCriativosStatus",
    label: "Copy Criativos",
    width: "w-[80px] min-w-[80px]",
    render: (o) => (
      <StatusBadge
        value={o.copyCriativosStatus}
        offerId={o.id}
        field="copyCriativosStatus"
      />
    ),
  },
  {
    key: "vslInVturb",
    label: "VSL Vturb",
    width: "w-[80px] min-w-[80px]",
    render: (o) => (
      <StatusBadge value={o.vslInVturb} offerId={o.id} field="vslInVturb" />
    ),
  },
  {
    key: "adsCopyByPerson",
    label: "Ads Copy",
    width: "w-[160px] min-w-[160px]",
    render: (o) => (
      <AdsCopyDisplay value={o.adsCopyByPerson} offerId={o.id} />
    ),
  },
  {
    key: "adsEditedByPerson",
    label: "Ads Edit",
    width: "w-[190px] min-w-[190px]",
    render: (o) => (
      <AdsEditDisplay value={o.adsEditedByPerson} offerId={o.id} />
    ),
  },
  {
    key: "adsRejectedCount",
    label: "Ads Rej",
    width: "w-[60px] min-w-[60px]",
    render: (o) => (
      <span className="tabular-nums">
        <EditableCell
          value={o.adsRejectedCount}
          offerId={o.id}
          field="adsRejectedCount"
          type="number"
        />
      </span>
    ),
  },
  // Coluna "Editores" removida a pedido do Diogo (confunde)
  {
    key: "campaignsActive",
    label: "Campanhas",
    width: "w-[80px] min-w-[80px]",
    render: (o) => (
      <StatusBadge
        value={o.campaignsActive}
        offerId={o.id}
        field="campaignsActive"
      />
    ),
  },
  {
    key: "validation",
    label: "Validação",
    width: "w-[80px] min-w-[80px]",
    render: (o) => (
      <StatusBadge value={o.validation} offerId={o.id} field="validation" />
    ),
  },
  {
    key: "preScale",
    label: "Pré Escala",
    width: "w-[80px] min-w-[80px]",
    render: (o) => (
      <StatusBadge value={o.preScale} offerId={o.id} field="preScale" />
    ),
  },
  {
    key: "scale",
    label: "Escala",
    width: "w-[80px] min-w-[80px]",
    render: (o) => (
      <StatusBadge value={o.scale} offerId={o.id} field="scale" />
    ),
  },
  {
    key: "productCreated",
    label: "Produto",
    width: "w-[80px] min-w-[80px]",
    render: (o) => (
      <StatusBadge
        value={o.productCreated}
        offerId={o.id}
        field="productCreated"
      />
    ),
  },
  {
    key: "productApproved",
    label: "Aprovado",
    width: "w-[80px] min-w-[80px]",
    render: (o) => (
      <StatusBadge
        value={o.productApproved}
        offerId={o.id}
        field="productApproved"
      />
    ),
  },
  {
    key: "siteCreated",
    label: "Site",
    width: "w-[80px] min-w-[80px]",
    render: (o) => (
      <StatusBadge value={o.siteCreated} offerId={o.id} field="siteCreated" />
    ),
  },
  {
    key: "siteUrls",
    label: "Domínio",
    width: "w-[220px] min-w-[220px]",
    render: (o) => (
      <SiteUrlsCell value={o.siteUrls} offerId={o.id} offerName={o.name} />
    ),
  },
  {
    key: "adFormat",
    label: "Formato",
    width: "w-[120px] min-w-[120px]",
    render: (o) => (
      <SelectCell
        value={o.adFormat}
        offerId={o.id}
        field="adFormat"
        options={[...AD_FORMATS]}
        labels={FORMAT_LABELS}
      />
    ),
  },
  {
    key: "observations",
    label: "Observações",
    width: "w-[200px] min-w-[200px]",
    render: (o) => <ObservationsCell value={o.observations} offerId={o.id} />,
  },
  {
    key: "actions",
    label: "",
    width: "w-[68px] min-w-[68px]",
    render: (o) => (
      <div className="flex items-center gap-0.5">
        <CopyButton offerId={o.id} />
        <DeleteButton offerId={o.id} />
      </div>
    ),
  },
];

// ---------- Main component ----------

export function OfferTable({ offers }: { offers: Offer[] }) {
  return (
    <div className="rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-max table-fixed border-collapse text-sm">
          {/* Header */}
          <thead>
            <tr className="sticky top-0 z-20 border-b border-border bg-muted/60 backdrop-blur-sm dark:bg-zinc-900/80">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`h-8 px-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground ${col.width} ${
                    col.sticky
                      ? "sticky left-0 z-30 bg-muted/60 dark:bg-zinc-900/80 border-r border-border/50"
                      : ""
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {offers.map((offer) => (
              <tr
                key={offer.id}
                className="group border-b border-border/60 border-l-2 border-l-transparent bg-background transition-colors duration-150 odd:bg-muted/30 hover:border-l-primary hover:bg-accent/40 dark:odd:bg-muted/20 dark:hover:bg-accent/20"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`h-10 px-3 transition-colors duration-150 ${col.width} ${
                      col.sticky
                        ? "sticky left-0 z-10 border-r border-border/50 bg-background group-hover:bg-accent/40 dark:group-hover:bg-accent/20"
                        : ""
                    }`}
                  >
                    {col.render(offer)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Row count footer */}
      <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span className="tabular-nums font-mono font-medium">{offers.length}</span> ofertas <span className="mx-1.5 text-border">&middot;</span> Última atualização: agora
      </div>
    </div>
  );
}
