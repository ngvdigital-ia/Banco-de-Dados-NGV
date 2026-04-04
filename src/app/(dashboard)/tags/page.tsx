import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTags, createTag, deleteTag } from "./actions";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const typeLabels: Record<string, string> = {
  nicho: "Nicho",
  mercado: "Mercado",
  formato: "Formato",
  custom: "Custom",
};

const typeBadgeVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  nicho: "default",
  mercado: "secondary",
  formato: "outline",
  custom: "destructive",
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tags</h1>
      </div>

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
        <div className="flex-1 space-y-1">
          <label className="text-sm font-medium">Nome da Tag</label>
          <Input name="name" placeholder="Ex: Emagrecimento, EUA, UGC..." required />
        </div>
        <div className="w-[180px] space-y-1">
          <label className="text-sm font-medium">Tipo</label>
          <Select name="type" defaultValue="custom">
            <SelectTrigger>
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
        <Button type="submit">
          <Plus className="mr-2 h-4 w-4" />
          Criar Tag
        </Button>
      </form>

      {allTags.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Nenhuma tag ainda</h2>
          <p className="text-sm text-muted-foreground">
            Crie tags para filtrar por nicho, mercado, formato de criativo, etc.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTags).map(([type, typeTags]) => (
            <div key={type}>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase">
                {typeLabels[type] ?? type}
              </h3>
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
                      className="flex items-center gap-1 pr-1"
                    >
                      {tag.name}
                      <button
                        type="submit"
                        className="ml-1 rounded-full hover:bg-black/10 p-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
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
