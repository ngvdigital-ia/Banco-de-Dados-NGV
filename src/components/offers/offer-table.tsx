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
  SIM: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  NAO: "bg-red-500/15 text-red-700 border-red-500/30",
  "EM ANDAMENTO": "bg-amber-500/15 text-amber-700 border-amber-500/30",
  "NÃO DEU CERTO":
    "bg-zinc-400/15 text-zinc-500 border-zinc-400/30 line-through",
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

const COPYWRITERS = ["Diogo", "Robert", "Gabriel"];
const EDITORS = ["Malu", "Luis", "Victor", "Camile"];
const LANGUAGES = ["EN", "FR", "DE", "ITA", "ES", "PT"];

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

  // Match value case-insensitively to options
  const normalizedValue = value
    ? options.find((o) => o.toLowerCase() === value.toLowerCase()) || value
    : "";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newVal = e.target.value;
    startTransition(async () => {
      await updateOfferField(offerId, field, newVal || null);
    });
  }

  // Check if value exists but doesn't match any option (imported data)
  const hasUnmatchedValue = value && !options.some((o) => o.toLowerCase() === value.toLowerCase());

  return (
    <select
      value={normalizedValue}
      onChange={handleChange}
      disabled={isPending}
      className={`w-full bg-transparent border-0 text-xs h-7 px-1 cursor-pointer outline-none focus:ring-1 focus:ring-primary/30 rounded ${isPending ? "opacity-50" : ""}`}
    >
      <option value="">-</option>
      {hasUnmatchedValue && (
        <option value={value}>{value}</option>
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
      className={`cursor-pointer truncate rounded px-1 py-0.5 text-xs hover:bg-muted/50 ${isPending ? "opacity-50" : ""}`}
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
      className={`inline-flex h-6 items-center justify-center rounded-full border px-2 text-[10px] font-medium whitespace-nowrap transition-all select-none hover:opacity-80 ${getStatusColor(display)} ${isPending ? "opacity-50" : ""}`}
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
      <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
        {count}/8
      </span>
      <div className="h-1.5 w-12 rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
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
      className={`cursor-pointer truncate rounded px-1 py-0.5 text-xs hover:bg-muted/50 ${isPending ? "opacity-50" : ""}`}
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
      <div className="absolute left-0 top-0 z-30 flex flex-col gap-1 rounded border bg-background p-2 shadow-lg">
        <label className="flex items-center gap-1 text-[10px]">
          D:
          <input
            className="h-5 w-10 rounded border px-1 text-[10px]"
            value={diogoVal}
            onChange={(e) => setDiogoVal(e.target.value)}
            type="number"
          />
        </label>
        <label className="flex items-center gap-1 text-[10px]">
          R:
          <input
            className="h-5 w-10 rounded border px-1 text-[10px]"
            value={robertVal}
            onChange={(e) => setRobertVal(e.target.value)}
            type="number"
          />
        </label>
        <label className="flex items-center gap-1 text-[10px]">
          G:
          <input
            className="h-5 w-10 rounded border px-1 text-[10px]"
            value={gabrielVal}
            onChange={(e) => setGabrielVal(e.target.value)}
            type="number"
          />
        </label>
        <button
          onClick={handleSave}
          className="mt-1 rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground"
        >
          OK
        </button>
      </div>
    );
  }

  const display =
    entries.length > 0
      ? entries.map(([k, v]) => `${k[0]}:${v}`).join(" ")
      : "-";

  return (
    <div
      onClick={() => {
        setDiogoVal(String(data.DIOGO ?? 0));
        setRobertVal(String(data.ROBERT ?? 0));
        setGabrielVal(String(data.GABRIEL ?? 0));
        setEditing(true);
      }}
      className={`relative cursor-pointer truncate rounded px-1 py-0.5 text-[10px] font-mono hover:bg-muted/50 ${isPending ? "opacity-50" : ""}`}
    >
      {display}
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
            className={`inline-flex h-5 items-center rounded px-1 text-[9px] font-medium transition-colors ${
              done
                ? "bg-emerald-500/15 text-emerald-700"
                : "bg-red-500/10 text-red-600"
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
      className={`rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive ${isPending ? "opacity-50" : ""}`}
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
    width: "w-[90px] min-w-[90px]",
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
    width: "w-[80px] min-w-[80px]",
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
  {
    key: "editorStatus",
    label: "Editores",
    width: "w-[110px] min-w-[110px]",
    render: (o) => (
      <EditorStatusDisplay value={o.editorStatus} offerId={o.id} editorAds={o.editorAds} />
    ),
  },
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
    <div className="rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-max table-fixed border-collapse text-sm">
          {/* Header */}
          <thead>
            <tr className="sticky top-0 z-20 border-b bg-muted/60">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`h-8 px-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${col.width} ${
                    col.sticky
                      ? "sticky left-0 z-30 bg-muted/60"
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
            {offers.map((offer, rowIdx) => (
              <tr
                key={offer.id}
                className={`group border-b transition-colors hover:border-l-2 hover:border-l-primary hover:bg-muted/30 ${
                  rowIdx % 2 === 0 ? "bg-background" : "bg-muted/10"
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`h-8 px-2 ${col.width} ${
                      col.sticky
                        ? `sticky left-0 z-10 ${rowIdx % 2 === 0 ? "bg-background" : "bg-muted/10"} group-hover:bg-muted/30`
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
      <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
        {offers.length} oferta(s)
      </div>
    </div>
  );
}
