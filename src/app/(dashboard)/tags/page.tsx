import { Plus, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTags, createTag, deleteTag } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

const typeLabels: Record<string, string> = {
  nicho: "Nicho",
  mercado: "Mercado",
  formato: "Formato",
  custom: "Custom",
};

const typeBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  nicho: "default",
  mercado: "secondary",
  formato: "outline",
  custom: "secondary",
};

/** Ponto de cor indigo por tipo — accent sutil na label do grupo */
const typeAccentColor: Record<string, string> = {
  nicho: "text-primary",
  mercado: "text-info-muted-foreground",
  formato: "text-muted-foreground",
  custom: "text-muted-foreground",
};

export default async function TagsPage() {
  const allTags = await getTags();

  const groupedTags = allTags.reduce(
    (acc, tag) => {
      const type = tag.type || "custom";
      if (!acc[type]) acc[type] = [];
      acc[type].push(tag);
      return acc;
    },
    {} as Record<string, typeof allTags>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tags"
        description="Organize ofertas e criativos por nicho, mercado e formato."
      />

      {/* Formulário de criação */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2.5">
              <Tag className="size-4 text-primary" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">Nova Tag</CardTitle>
              <CardDescription>
                Ex: Emagrecimento (nicho), EUA (mercado), UGC (formato).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <form
            action={async (formData: FormData) => {
              "use server";
              await createTag({
                name: formData.get("name") as string,
                type: formData.get("type") as string,
              });
            }}
            className="flex items-end gap-3"
          >
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Nome da Tag
              </Label>
              <Input name="name" placeholder="Ex: Emagrecimento, EUA, UGC…" required />
            </div>
            <div className="w-[180px] space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Tipo
              </Label>
              <Select name="type" defaultValue="custom">
                <SelectTrigger aria-label="Selecionar tipo de tag">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="self-end">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Criar Tag
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Grid de tags agrupadas */}
      {allTags.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-4">
          <EmptyState
            icon={Tag}
            title="Nenhuma tag ainda"
            description="Crie tags para filtrar por nicho, mercado, formato de criativo, etc."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTags).map(([type, typeTags]) => (
            <div key={type} className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold uppercase tracking-wider ${typeAccentColor[type] ?? "text-muted-foreground"}`}
                >
                  {typeLabels[type] ?? type}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground/60">
                  ({typeTags.length})
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
              <div className="flex flex-wrap gap-2">
                {typeTags.map((tag) => (
                  <form
                    key={tag.id}
                    action={async () => {
                      "use server";
                      await deleteTag(tag.id);
                    }}
                    className="inline-flex"
                  >
                    <Badge
                      variant={typeBadgeVariant[type] ?? "default"}
                      className="flex items-center gap-1 pr-1 transition-all duration-150 hover:pr-1.5"
                    >
                      {tag.name}
                      <button
                        type="submit"
                        className="ml-1 rounded-full p-0.5 hover:bg-foreground/10 transition-colors duration-150"
                        aria-label={`Remover tag ${tag.name}`}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </Badge>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
