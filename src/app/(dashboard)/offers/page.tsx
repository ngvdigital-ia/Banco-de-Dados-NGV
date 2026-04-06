import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfferTable } from "@/components/offers/offer-table";
import { CsvImportDialog } from "@/components/offers/csv-import-dialog";
import { getOffers, createOffer } from "./actions";

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

  const offers = await getOffers({ language, validation, copywriter });

  // Extract unique values for filters
  const allOffers = await getOffers();
  const uniqueLanguages = [
    ...new Set(allOffers.map((o) => o.language)),
  ].sort();
  const uniqueValidations = [
    ...new Set(allOffers.map((o) => o.validation).filter(Boolean)),
  ].sort();
  const uniqueCopywriters = [
    ...new Set(allOffers.map((o) => o.copyVsl).filter(Boolean)),
  ].sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Acompanhamento de Ofertas</h1>
        <div className="flex items-center gap-2">
          <form
            action={async () => {
              "use server";
              await createOffer();
            }}
          >
            <Button type="submit">
              <Plus className="mr-1 h-4 w-4" />
              Nova Oferta
            </Button>
          </form>
          <CsvImportDialog />
        </div>
      </div>

      <OfferFilters
        languages={uniqueLanguages}
        validations={uniqueValidations as string[]}
        copywriters={uniqueCopywriters as string[]}
        currentLanguage={language}
        currentValidation={validation}
        currentCopywriter={copywriter}
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

function OfferFilters({
  languages,
  validations,
  copywriters: _copywriters,
  currentLanguage,
  currentValidation,
  currentCopywriter,
}: {
  languages: string[];
  validations: string[];
  copywriters: string[];
  currentLanguage?: string;
  currentValidation?: string;
  currentCopywriter?: string;
}) {
  function buildHref(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    const qs = sp.toString();
    return `/offers${qs ? `?${qs}` : ""}`;
  }

  const hasFilters = currentLanguage || currentValidation || currentCopywriter;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Filtros:</span>

      {languages.length > 1 && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Língua:</span>
          {languages.map((lang) => (
            <a
              key={lang}
              href={buildHref({
                language: currentLanguage === lang ? undefined : lang,
                validation: currentValidation,
                copywriter: currentCopywriter,
              })}
              className={`rounded-md border px-2 py-0.5 text-xs transition-colors hover:bg-muted ${
                currentLanguage === lang
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border"
              }`}
            >
              {lang}
            </a>
          ))}
        </div>
      )}

      {validations.length > 1 && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Validação:</span>
          {validations.map((val) => (
            <a
              key={val}
              href={buildHref({
                language: currentLanguage,
                validation: currentValidation === val ? undefined : val,
                copywriter: currentCopywriter,
              })}
              className={`rounded-md border px-2 py-0.5 text-xs transition-colors hover:bg-muted ${
                currentValidation === val
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border"
              }`}
            >
              {val}
            </a>
          ))}
        </div>
      )}

      {hasFilters && (
        <a
          href="/offers"
          className="rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
        >
          Limpar filtros
        </a>
      )}
    </div>
  );
}
