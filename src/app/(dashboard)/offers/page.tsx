import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfferTable } from "@/components/offers/offer-table";
import { CsvImportDialog } from "@/components/offers/csv-import-dialog";
import { getOffers, getOfferMonths, getOfferFilterOptions, createOffer } from "./actions";

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const language =
    typeof params.language === "string" ? params.language : undefined;
  const validation =
    typeof params.validation === "string" ? params.validation : undefined;
  const copywriter =
    typeof params.copywriter === "string" ? params.copywriter : undefined;
  const month =
    typeof params.month === "string" ? params.month : undefined;

  // Default: last 2 months if no month filter set
  const now = new Date();
  const defaultMonthFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defaultFrom = `${defaultMonthFrom.getFullYear()}-${String(defaultMonthFrom.getMonth() + 1).padStart(2, "0")}`;
  const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let monthFrom: string | undefined;
  let monthTo: string | undefined;

  if (month === "all") {
    // No month filter
    monthFrom = undefined;
    monthTo = undefined;
  } else if (month) {
    // Specific month
    monthFrom = month;
    monthTo = month;
  } else {
    // Default: last 2 months
    monthFrom = defaultFrom;
    monthTo = defaultTo;
  }

  const [offers, allMonths, filterOptions] = await Promise.all([
    getOffers({ language, validation, copywriter, monthFrom, monthTo }),
    getOfferMonths(),
    getOfferFilterOptions(),
  ]);

  const uniqueLanguages = filterOptions.languages;
  const uniqueValidations = filterOptions.validations;
  const uniqueCopywriters = filterOptions.copywriters;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Acompanhamento de Ofertas</h1>
            <p className="text-[13px] text-muted-foreground">Tracking de ofertas da operação</p>
          </div>
          <span className="inline-flex h-6 items-center rounded-md border border-zinc-200 bg-zinc-100 px-2 text-[11px] font-mono font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            {offers.length} ofertas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CsvImportDialog />
          <form
            action={async () => {
              "use server";
              await createOffer();
            }}
          >
            <Button type="submit" size="sm" className="h-8 gap-1.5 px-3 text-xs font-medium">
              <Plus className="h-3.5 w-3.5" />
              Nova Oferta
            </Button>
          </form>
        </div>
      </div>

      <OfferFilters
        languages={uniqueLanguages}
        validations={uniqueValidations as string[]}
        copywriters={uniqueCopywriters as string[]}
        months={allMonths}
        currentLanguage={language}
        currentValidation={validation}
        currentCopywriter={copywriter}
        currentMonth={month}
      />

      {offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Nenhuma oferta encontrada</h2>
          <p className="text-sm text-muted-foreground">
            Crie uma nova oferta ou importe um CSV para começar.
          </p>
        </div>
      ) : (
        <OfferTable offers={offers} />
      )}
    </div>
  );
}

const MONTH_NAMES: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[m] || m}/${y}`;
}

function OfferFilters({
  languages,
  validations,
  copywriters: _copywriters,
  months,
  currentLanguage,
  currentValidation,
  currentCopywriter,
  currentMonth,
}: {
  languages: string[];
  validations: string[];
  copywriters: string[];
  months: string[];
  currentLanguage?: string;
  currentValidation?: string;
  currentCopywriter?: string;
  currentMonth?: string;
}) {
  function buildHref(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    const qs = sp.toString();
    return `/offers${qs ? `?${qs}` : ""}`;
  }

  const hasFilters = currentLanguage || currentValidation || currentCopywriter || currentMonth;

  // Active month style
  const monthBtnActive = "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";
  const monthBtnInactive = "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800";

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      {/* Month filter */}
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mr-1">Mês:</span>
      <a
        href={buildHref({
          language: currentLanguage,
          validation: currentValidation,
          copywriter: currentCopywriter,
          month: undefined, // default: last 2 months
        })}
        className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
          !currentMonth ? monthBtnActive : monthBtnInactive
        }`}
      >
        Últimos 2 meses
      </a>
      {months.map((m) => (
        <a
          key={m}
          href={buildHref({
            language: currentLanguage,
            validation: currentValidation,
            copywriter: currentCopywriter,
            month: currentMonth === m ? undefined : m,
          })}
          className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
            currentMonth === m ? monthBtnActive : monthBtnInactive
          }`}
        >
          {formatMonth(m)}
        </a>
      ))}
      <a
        href={buildHref({
          language: currentLanguage,
          validation: currentValidation,
          copywriter: currentCopywriter,
          month: "all",
        })}
        className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
          currentMonth === "all" ? monthBtnActive : monthBtnInactive
        }`}
      >
        Todos
      </a>

      <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

      {/* Language filter */}
      {languages.length > 1 && (
        <div className="flex items-center gap-1">
          {languages.map((lang) => (
            <a
              key={lang}
              href={buildHref({
                language: currentLanguage === lang ? undefined : lang,
                validation: currentValidation,
                copywriter: currentCopywriter,
                month: currentMonth,
              })}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
                currentLanguage === lang ? monthBtnActive : monthBtnInactive
              }`}
            >
              {lang}
            </a>
          ))}
        </div>
      )}

      {validations.length > 1 && (
        <>
          <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-1">
            {validations.map((val) => (
              <a
                key={val}
                href={buildHref({
                  language: currentLanguage,
                  validation: currentValidation === val ? undefined : val,
                  copywriter: currentCopywriter,
                  month: currentMonth,
                })}
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
                  currentValidation === val ? monthBtnActive : monthBtnInactive
                }`}
              >
                {val}
              </a>
            ))}
          </div>
        </>
      )}

      {hasFilters && (
        <>
          <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <a
            href="/offers"
            className="rounded-md border border-dashed border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-500 transition-all hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
          >
            Limpar tudo
          </a>
        </>
      )}
    </div>
  );
}
