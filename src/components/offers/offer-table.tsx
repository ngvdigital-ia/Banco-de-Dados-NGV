"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { updateOfferField, deleteOffer } from "@/app/(dashboard)/offers/actions";

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
  copyVslStatus: string | null;
  copyCriativosStatus: string | null;
  vslInVturb: string | null;
  adsCopyByPerson: unknown;
  adsEditedCount: number | null;
  adsRejectedCount: number | null;
  editorStatus: unknown;
  campaignsActive: string | null;
  validation: string | null;
  preScale: string | null;
  scale: string | null;
  productCreated: string | null;
  productApproved: string | null;
  siteCreated: string | null;
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
  SIM: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  NAO: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
  "EM ANDAMENTO": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  "NÃO DEU CERTO":
    "bg-zinc-100 text-zinc-500 border-zinc-200 line-through dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-700",
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

// Siglas: DG=Diogo, GA=Gabriel, RO=Robert, MALU=Malu, VA=Victor Andrade, CA=Camile, LF=Luis Felipe
const COPYWRITERS = ["DG", "GA", "RO", "MALU", "VA", "CA", "LF"];
const EDITORS = ["DG", "GA", "RO", "MALU", "VA", "CA", "LF"];
const LANGUAGES = ["EN", "FR", "DE", "ITA", "ES", "PT"];

const SIGLA_TO_NAME: Record<string, string> = {
  DG: "Diogo", GA: "Gabriel", RO: "Robert",
  MALU: "Malu", VA: "Victor Andrade", CA: "Camile", LF: "Luis Felipe",
};
// Map ALL known name variations to siglas
const NAME_TO_SIGLA: Record<string, string> = {
  dg: "DG", ga: "GA", ro: "RO", malu: "MALU", va: "VA", ca: "CA", lf: "LF",
  diogo: "DG", gabriel: "GA", robert: "RO",
  camile: "CA", camille: "CA",
  luis: "LF", "luis felipe": "LF",
  victor: "VA", "victor andrade": "VA",
  "maria luisa": "MALU", "maria luísa": "MALU",
  // ICARO e LUIZA não estão na lista de siglas — ficam como valor custom no select
};

function parseEditors(editorAds: string | null): string[] {
  if (!editorAds) return [];
  return editorAds
    .split(/[&,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => {
      const known = EDITORS.find((e) => e.toLowerCase() === name.toLowerCase());
      return known || name;
    });
}

// ---------- SelectCell ----------

function SelectCell({
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
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
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

  // Sync local value when prop changes (after server revalidation)
  useEffect(() => {
    if (!editing) {
      setLocalValue(String(value ?? ""));
    }
  }, [value, editing]);

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
      className={`cursor-pointer rounded px-1 py-0.5 text-xs hover:border-b hover:border-dashed hover:border-zinc-300 dark:hover:border-zinc-600 ${isPending ? "opacity-50" : ""}`}
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
      ? "bg-emerald-500"
      : pct >= 50
        ? "bg-amber-500"
        : pct >= 25
          ? "bg-orange-500"
          : "bg-red-500";

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700">
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

  // Sync when prop changes
  useEffect(() => {
    if (!editing) {
      setLocalValue(value ?? "");
    }
  }, [value, editing]);

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

  // Sync when prop changes
  useEffect(() => {
    if (!editing) {
      const d = (value as Record<string, number> | null) ?? {};
      setDiogoVal(String(d.DIOGO ?? 0));
      setRobertVal(String(d.ROBERT ?? 0));
      setGabrielVal(String(d.GABRIEL ?? 0));
    }
  }, [value, editing]);

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
    DIOGO: "DG", ROBERT: "RO", GABRIEL: "GA",
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
                <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{v}</span>
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

function EditorStatusDisplay({
  value,
  offerId,
  editorAds,
}: {
  value: unknown;
  offerId: number;
  editorAds: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const data = (value as Record<string, string> | null) ?? {};

  const editors = parseEditors(editorAds);

  function toggleEditor(name: string) {
    const current = (data[name] || "NAO").toUpperCase().trim();
    const next = current === "SIM" ? "NAO" : "SIM";
    const newData = { ...data, [name]: next };
    startTransition(async () => {
      await updateOfferField(
        offerId,
        "editorStatus",
        JSON.stringify(newData) as unknown as string
      );
    });
  }

  if (editors.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  return (
    <div
      className={`flex gap-0.5 ${isPending ? "opacity-50" : ""}`}
    >
      {editors.map((name) => {
        const status = (data[name] || "NAO").toUpperCase().trim();
        const done = status === "SIM";
        return (
          <button
            key={name}
            type="button"
            onClick={() => toggleEditor(name)}
            className={`inline-flex h-6 items-center rounded px-1.5 text-[10px] font-medium transition-all duration-150 ${
              done
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
            }`}
            title={`${name}: ${status}`}
          >
            {name[0]}
            {done ? "\u2713" : "\u2717"}
          </button>
        );
      })}
    </div>
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
    render: (o) => <EditableCell value={o.name} offerId={o.id} field="name" />,
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
    width: "w-[100px] min-w-[100px]",
    render: (o) => (
      <SelectCell value={o.copyAds} offerId={o.id} field="copyAds" options={COPYWRITERS} />
    ),
  },
  {
    key: "editorAds",
    label: "Editor Ads",
    width: "w-[100px] min-w-[100px]",
    render: (o) => (
      <SelectCell value={o.editorAds} offerId={o.id} field="editorAds" options={EDITORS} />
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
      <EditableCell value={o.ticket} offerId={o.id} field="ticket" />
    ),
  },
  {
    key: "copyVslStatus",
    label: "Copy VSL",
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
    key: "adsEditedCount",
    label: "Ads Edit",
    width: "w-[60px] min-w-[60px]",
    render: (o) => (
      <EditableCell value={o.adsEditedCount} offerId={o.id} field="adsEditedCount" type="number" />
    ),
  },
  {
    key: "adsRejectedCount",
    label: "Ads Rej",
    width: "w-[60px] min-w-[60px]",
    render: (o) => (
      <EditableCell
        value={o.adsRejectedCount}
        offerId={o.id}
        field="adsRejectedCount"
        type="number"
      />
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
    key: "observations",
    label: "Observações",
    width: "w-[200px] min-w-[200px]",
    render: (o) => <ObservationsCell value={o.observations} offerId={o.id} />,
  },
  {
    key: "actions",
    label: "",
    width: "w-[40px] min-w-[40px]",
    render: (o) => <DeleteButton offerId={o.id} />,
  },
];

// ---------- Main component ----------

export function OfferTable({ offers }: { offers: Offer[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="overflow-x-auto">
        <table className="w-max table-fixed border-collapse text-sm">
          {/* Header */}
          <thead>
            <tr className="sticky top-0 z-20 border-b-2 border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`h-9 px-3 text-left text-[11px] font-semibold font-mono tracking-wide text-zinc-500 dark:text-zinc-400 ${col.width} ${
                    col.sticky
                      ? "sticky left-0 z-30 bg-zinc-50 dark:bg-zinc-900/50"
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
                className="group border-b border-zinc-100 border-l-2 border-l-transparent bg-background transition-all hover:border-l-emerald-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/30"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`h-10 px-3 ${col.width} ${
                      col.sticky
                        ? "sticky left-0 z-10 bg-background group-hover:bg-zinc-50 dark:group-hover:bg-zinc-900/30"
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
      <div className="border-t border-zinc-200 px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span className="font-mono font-medium">{offers.length}</span> ofertas <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">&middot;</span> Última atualização: agora
      </div>
    </div>
  );
}
