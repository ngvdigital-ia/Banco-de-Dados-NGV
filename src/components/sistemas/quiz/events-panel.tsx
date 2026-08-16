import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEventValue, formatTimestamp } from "./format";
import type { QuizModuleAnalyticsData } from "./types";

export function EventsPanel({ events }: { events: QuizModuleAnalyticsData["recentEvents"] }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b p-4">
        <h2 className="text-sm font-semibold">Eventos recentes</h2>
        <p className="mt-1 text-xs text-muted-foreground">Log técnico das últimas ações capturadas dentro do período selecionado.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hora</TableHead>
            <TableHead>Sessão</TableHead>
            <TableHead>Evento</TableHead>
            <TableHead>Tela</TableHead>
            <TableHead>Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                Nenhum evento nesse período.
              </TableCell>
            </TableRow>
          ) : (
            events.map((event, index) => (
              <TableRow key={`${event.sessionShort}-${event.createdAt}-${index}`}>
                <TableCell className="font-mono text-xs">{formatTimestamp(event.createdAt)}</TableCell>
                <TableCell className="font-mono text-xs">{event.sessionShort}</TableCell>
                <TableCell>{event.eventName}</TableCell>
                <TableCell>{event.screenId ?? "—"}</TableCell>
                <TableCell className="max-w-64 truncate text-xs text-muted-foreground" title={formatEventValue(event.value)}>
                  {formatEventValue(event.value)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
