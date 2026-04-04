import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getVslsForComparison } from "../actions";

function formatSeconds(sec: number | null) {
  if (sec == null) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function VslComparisonPage() {
  const allVsls = await getVslsForComparison();

  // Group by project
  const grouped = allVsls.reduce((acc, vsl) => {
    const key = vsl.projectName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(vsl);
    return acc;
  }, {} as Record<string, typeof allVsls>);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Comparação de VSLs</h1>
      <p className="text-muted-foreground">
        Compare versões de VSL dentro do mesmo projeto para identificar qual performa melhor.
      </p>

      {Object.keys(grouped).length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Nenhuma VSL cadastrada ainda. Cadastre VSLs nos projetos para comparar.
        </p>
      ) : (
        Object.entries(grouped).map(([projectName, vsls]) => (
          <Card key={projectName}>
            <CardHeader>
              <CardTitle>{projectName}</CardTitle>
            </CardHeader>
            <CardContent>
              {vsls.length < 2 ? (
                <p className="text-sm text-muted-foreground">
                  Apenas 1 VSL. Cadastre mais versões para comparar.
                </p>
              ) : null}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Versão</TableHead>
                      <TableHead>Copywriter</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Revelação Preço</TableHead>
                      <TableHead>Botão Aparece</TableHead>
                      <TableHead>% até Preço</TableHead>
                      <TableHead>Back Redirect</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vsls.map((vsl) => {
                      const pctToPrice =
                        vsl.duration && vsl.priceRevealSecond
                          ? Math.round((vsl.priceRevealSecond / vsl.duration) * 100)
                          : null;

                      return (
                        <TableRow key={vsl.id}>
                          <TableCell className="font-bold">{vsl.version}</TableCell>
                          <TableCell>{vsl.copywriterName ?? "-"}</TableCell>
                          <TableCell>{formatSeconds(vsl.duration)}</TableCell>
                          <TableCell>{formatSeconds(vsl.priceRevealSecond)}</TableCell>
                          <TableCell>{formatSeconds(vsl.buttonAppearSecond)}</TableCell>
                          <TableCell>
                            {pctToPrice != null ? (
                              <Badge variant={pctToPrice > 60 ? "default" : "secondary"}>
                                {pctToPrice}%
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={vsl.backRedirectActive ? "default" : "outline"}>
                              {vsl.backRedirectActive ? "Sim" : "Não"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
