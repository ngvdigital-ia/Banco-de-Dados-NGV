"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getTags,
  getEntityTags,
  addTagToEntity,
  removeTagFromEntity,
} from "@/app/(dashboard)/tags/actions";

type Tag = Awaited<ReturnType<typeof getTags>>[number];
type EntityTag = Awaited<ReturnType<typeof getEntityTags>>[number];

export function EntityTags({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: number;
}) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [linked, setLinked] = useState<EntityTag[]>([]);
  const [isPending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const [t, et] = await Promise.all([
        getTags(),
        getEntityTags(entityType, entityId),
      ]);
      setAllTags(t);
      setLinked(et);
    });
  }

  useEffect(() => {
    load();
  }, [entityType, entityId]);

  const linkedTagIds = new Set(linked.map((l) => l.tagId));
  const available = allTags.filter((t) => !linkedTagIds.has(t.id));

  function handleAdd(tagId: string | null) {
    if (!tagId || tagId === "none") return;
    startTransition(async () => {
      await addTagToEntity(Number(tagId), entityType, entityId);
      load();
    });
  }

  function handleRemove(id: number) {
    startTransition(async () => {
      await removeTagFromEntity(id);
      load();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {linked.map((et) => (
        <Badge key={et.id} variant="secondary" className="flex items-center gap-1 pr-1">
          {et.tagName}
          <button
            onClick={() => handleRemove(et.id)}
            className="ml-0.5 rounded-full hover:bg-black/10 p-0.5"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}
      {available.length > 0 && (
        <Select onValueChange={handleAdd} value="">
          <SelectTrigger className="h-6 w-[120px] text-xs">
            <Plus className="h-3 w-3 mr-1" />
            <span>Tag</span>
          </SelectTrigger>
          <SelectContent>
            {available.map((t) => (
              <SelectItem key={t.id} value={t.id.toString()}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
