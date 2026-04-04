import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getOffersRanking } from "../actions";

const statusLabels: Record<string, string> = {
  em_teste: "Em Teste",
  rodando: "Rodando",
  pausado: "Pausado",
};

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  em_teste: "outline",
  rodando: "default",
  pausado: "secondary",
};

export default async function OffersRankingPage() {
  const offers = await getOffersRanking();

  const total = offers.length;
  const testing = offers.filter((o) => o.status === "em_teste").length;
  const running = offers.filter((o) => o.status === "rodando").length;
  const paused = offers.filter((o) => o.status === "pausado").length;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Ranking de Ofertas</h1>
      <p className="text-muted-foreground">
        Visão geral de todas as ofertas: quantas foram lançadas, quais estão rodando, quais escalaram.
      </p>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Lançadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Em Teste</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{testing}</div>
            <p className="text-xs text-muted-foreground">
              {total > 0 ? Math.round((testing / total) * 100) : 0}% do total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Rodando (Validadas)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{running}</div>
            <p className="text-xs text-muted-foreground">
              {total > 0 ? Math.round((running / total) * 100) : 0}% taxa de validação
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pausadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paused}</div>
          </CardContent>
        </Card>
      </div>

      {offers.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Nenhuma oferta cadastrada.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Todas as Ofertas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Nicho</TableHead>
                    <TableHead>Idioma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">VSLs</TableHead>
                    <TableHead className="text-center">Criativos</TableHead>
                    <TableHead className="text-center">Campanhas</TableHead>
                    <TableHead>Lançado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offers.map((offer) => (
                    <TableRow key={offer.id}>
                      <TableCell>
                        <Link
                          href={`/projects/${offer.id}`}
                          className="font-medium hover:underline"
                        >
                          {offer.name}
                        </Link>
                      </TableCell>
                      <TableCell>{offer.niche}</TableCell>
                      <TableCell>{offer.language}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[offer.status] ?? "outline"}>
                          {statusLabels[offer.status] ?? offer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{offer.vslCount}</TableCell>
                      <TableCell className="text-center">{offer.creativeCount}</TableCell>
                      <TableCell className="text-center">{offer.campaignCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {offer.createdAt
                          ? new Date(offer.createdAt).toLocaleDateString("pt-BR")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
