import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/relatorios")({
  component: () => (
    <ProtectedLayout>
      <Relatorios />
    </ProtectedLayout>
  ),
});

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

type Stats = {
  totalMulheres: number;
  totalMensagens: number;
  totalCasos: number;
  totalAtendimentos: number;
  mensagensPorCategoria: { categoria: string; total: number }[];
  mulheresPorMes: { mes: string; total: number }[];
  casosPorRisco: { risco: string; total: number }[];
  engajamento: { dia: string; enviadas: number; lidas: number }[];
};

function Relatorios() {
  const hoje = new Date();
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(hoje.getDate() - 30);

  const [dataInicio, setDataInicio] = useState(trintaDiasAtras.toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(hoje.toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState<string>("todas");
  const [status, setStatus] = useState<string>("todos");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const inicio = new Date(dataInicio).toISOString();
      const fim = new Date(dataFim + "T23:59:59").toISOString();

      const [mulheres, casos, atend, msgsAll] = await Promise.all([
        supabase.from("mulheres").select("id, created_at"),
        supabase.from("casos").select("id, grau_risco"),
        supabase.from("atendimentos").select("id"),
        supabase
          .from("mensagens_enviadas")
          .select("id, categoria, status, created_at")
          .gte("created_at", inicio)
          .lte("created_at", fim),
      ]);

      const msgs = (msgsAll.data ?? []).filter((m) => {
        if (categoria !== "todas" && m.categoria !== categoria) return false;
        if (status !== "todos" && m.status !== status) return false;
        return true;
      });

      const catMap = new Map<string, number>();
      msgs.forEach((m) => catMap.set(m.categoria, (catMap.get(m.categoria) ?? 0) + 1));

      const mesMap = new Map<string, number>();
      (mulheres.data ?? []).forEach((m) => {
        const k = new Date(m.created_at).toISOString().slice(0, 7);
        mesMap.set(k, (mesMap.get(k) ?? 0) + 1);
      });

      const riscoMap = new Map<string, number>();
      (casos.data ?? []).forEach((c) => riscoMap.set(c.grau_risco, (riscoMap.get(c.grau_risco) ?? 0) + 1));

      const diaMap = new Map<string, { enviadas: number; lidas: number }>();
      msgs.forEach((m) => {
        const k = new Date(m.created_at).toISOString().slice(0, 10);
        const v = diaMap.get(k) ?? { enviadas: 0, lidas: 0 };
        if (m.status === "enviada" || m.status === "lida") v.enviadas++;
        if (m.status === "lida") v.lidas++;
        diaMap.set(k, v);
      });

      setStats({
        totalMulheres: mulheres.data?.length ?? 0,
        totalMensagens: msgs.length,
        totalCasos: casos.data?.length ?? 0,
        totalAtendimentos: atend.data?.length ?? 0,
        mensagensPorCategoria: [...catMap.entries()].map(([categoria, total]) => ({
          categoria,
          total,
        })),
        mulheresPorMes: [...mesMap.entries()]
          .sort()
          .slice(-12)
          .map(([mes, total]) => ({ mes, total })),
        casosPorRisco: [...riscoMap.entries()].map(([risco, total]) => ({ risco, total })),
        engajamento: [...diaMap.entries()]
          .sort()
          .map(([dia, v]) => ({ dia: dia.slice(5), ...v })),
      });
    } catch (e) {
      toast.error("Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportPDF = () => {
    if (!stats) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("SIGEM — Relatório Estratégico", 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: ${dataInicio} a ${dataFim}`, 14, 26);

    autoTable(doc, {
      startY: 32,
      head: [["Indicador", "Valor"]],
      body: [
        ["Mulheres cadastradas", String(stats.totalMulheres)],
        ["Mensagens no período", String(stats.totalMensagens)],
        ["Casos totais", String(stats.totalCasos)],
        ["Atendimentos", String(stats.totalAtendimentos)],
      ],
    });

    autoTable(doc, {
      head: [["Categoria de mensagem", "Total"]],
      body: stats.mensagensPorCategoria.map((r) => [r.categoria, String(r.total)]),
    });

    autoTable(doc, {
      head: [["Grau de risco", "Casos"]],
      body: stats.casosPorRisco.map((r) => [r.risco, String(r.total)]),
    });

    doc.save(`sigem-relatorio-${dataInicio}-${dataFim}.pdf`);
  };

  const exportExcel = () => {
    if (!stats) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Indicador: "Mulheres", Valor: stats.totalMulheres },
        { Indicador: "Mensagens", Valor: stats.totalMensagens },
        { Indicador: "Casos", Valor: stats.totalCasos },
        { Indicador: "Atendimentos", Valor: stats.totalAtendimentos },
      ]),
      "Resumo",
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stats.mensagensPorCategoria), "Mensagens");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stats.casosPorRisco), "Casos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stats.engajamento), "Engajamento");
    XLSX.writeFile(wb, `sigem-relatorio-${dataInicio}-${dataFim}.xlsx`);
  };

  const cards = useMemo(
    () =>
      stats
        ? [
            { label: "Mulheres", value: stats.totalMulheres },
            { label: "Mensagens (período)", value: stats.totalMensagens },
            { label: "Casos", value: stats.totalCasos },
            { label: "Atendimentos", value: stats.totalAtendimentos },
          ]
        : [],
    [stats],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Relatórios e Dashboard</h1>
          <p className="text-muted-foreground">Indicadores estratégicos com filtros e exportação</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPDF} disabled={!stats}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={!stats}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div>
            <Label>Início</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="boas_vindas">Boas-vindas</SelectItem>
                <SelectItem value="acompanhamento">Acompanhamento</SelectItem>
                <SelectItem value="lembrete">Lembrete</SelectItem>
                <SelectItem value="aniversario">Aniversário</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="agendada">Agendada</SelectItem>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="lida">Lida</SelectItem>
                <SelectItem value="falhou">Falhou</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={() => void carregar()} disabled={loading} className="w-full">
              <Download className="mr-2 h-4 w-4" /> Aplicar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Mulheres cadastradas por mês</CardTitle></CardHeader>
            <CardContent style={{ height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={stats.mulheresPorMes}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Mensagens por categoria</CardTitle></CardHeader>
            <CardContent style={{ height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={stats.mensagensPorCategoria} dataKey="total" nameKey="categoria" outerRadius={100} label>
                    {stats.mensagensPorCategoria.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Casos por grau de risco</CardTitle></CardHeader>
            <CardContent style={{ height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={stats.casosPorRisco}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="risco" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Engajamento de mensagens</CardTitle></CardHeader>
            <CardContent style={{ height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={stats.engajamento}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="enviadas" stroke="#3b82f6" />
                  <Line type="monotone" dataKey="lidas" stroke="#10b981" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
