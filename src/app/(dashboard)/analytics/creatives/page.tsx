import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getCreativesByFormat } from "../actions";

const formatLabels: Record<string, string> = {
  especialista: "Especialista",
  ugc_masc: "UGC Masculino",
  ugc_fem: "UGC Feminino",
  famoso: "Famoso",
  youtuber: "YouTuber",
  autoridade: "Autoridade",
  podcast: "Podcast",
};

const platformLabels: Record<string, string> = {
  meta: "Meta Ads",
  tiktok: "TikTok",
  google: "Google",
  kwai: "Kwai",
};

export default async function CreativesAnalyticsPage() {
  const byFormat = await getCreativesByFormat();
  const totalCreatives = byFormat.reduce((sum, f) => sum + Number(f.count), 0);

  // Group by format only (aggregate across platforms)
  const formatTotals = byFormat.reduce((acc, row) => {
    const fmt = row.format;
    acc[fmt] = (acc[fmt] || 0) + Number(row.count);
    return acc;
  }, {} as Record<string, number>);

  const sortedFormats = Object.entries(formatTotals).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Análise de Criativos</h1>
      <p className="text-muted-foreground">
        Veja quais formatos de criativo estão sendo mais usados e em quais plataformas.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Criativos por Formato</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedFormats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum criativo cadastrado
              </p>
            ) : (
              <div className="space-y-3">
                {sortedFormats.map(([format, count]) => {
                  const pct = totalCreatives > 0 ? Math.round((count / totalCreatives) * 100) : 0;
                  return (
                    <div key={format} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {formatLabels[format] ?? format}
                        </span>
                        <span className="text-muted-foreground">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            {byFormat.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum dado
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Formato</TableHead>
                      <TableHead>Plataforma</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byFormat.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant="outline">
                            {formatLabels[row.format] ?? row.format}
                          </Badge>
                        </TableCell>
                        <TableCell>{platformLabels[row.platform] ?? row.platform}</TableCell>
                        <TableCell className="text-right font-medium">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
