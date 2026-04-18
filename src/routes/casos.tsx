import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/casos")({
  component: () => (
    <ProtectedLayout>
      <CasosModule />
    </ProtectedLayout>
  ),
});

type Caso = {
  id: string;
  mulher_id: string;
  municipio_id: string;
  tipo_ocorrencia: string;
  grau_risco: "baixo" | "medio" | "alto" | "critico";
  status: "aberto" | "em_acompanhamento" | "encerrado";
  data_ocorrencia: string | null;
  descricao: string | null;
  created_at: string;
  mulheres?: { nome_completo: string } | null;
};

type MulherOpt = { id: string; nome_completo: string; municipio_id: string };

const schema = z.object({
  mulher_id: z.string().uuid("Selecione a mulher"),
  tipo_ocorrencia: z.string().trim().min(2, "Informe o tipo").max(120),
  grau_risco: z.enum(["baixo", "medio", "alto", "critico"]),
  status: z.enum(["aberto", "em_acompanhamento", "encerrado"]),
  data_ocorrencia: z.string().optional(),
  descricao: z.string().max(2000).optional(),
});

const riskColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  baixo: "secondary", medio: "outline", alto: "default", critico: "destructive",
};

function CasosModule() {
  const { user, municipioId, canWrite, hasRole, hasAnyRole } = useAuth();
  const isMaster = hasRole("master");
  const writable = canWrite();
  const canDelete = hasAnyRole(["master", "municipal"]);

  const [items, setItems] = useState<Caso[]>([]);
  const [mulheres, setMulheres] = useState<MulherOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Caso | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    mulher_id: "", tipo_ocorrencia: "", grau_risco: "baixo" as const,
    status: "aberto" as const, data_ocorrencia: "", descricao: "",
  });

  const load = async () => {
    setLoading(true);
    const [{ data: casosData, error }, { data: mulhData }] = await Promise.all([
      supabase.from("casos").select("*, mulheres(nome_completo)").order("created_at", { ascending: false }),
      supabase.from("mulheres").select("id, nome_completo, municipio_id").order("nome_completo"),
    ]);
    if (error) toast.error("Erro ao carregar casos");
    setItems((casosData as Caso[]) ?? []);
    setMulheres(mulhData ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ mulher_id: "", tipo_ocorrencia: "", grau_risco: "baixo", status: "aberto", data_ocorrencia: "", descricao: "" });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (c: Caso) => {
    setEditing(c);
    setForm({
      mulher_id: c.mulher_id, tipo_ocorrencia: c.tipo_ocorrencia,
      grau_risco: c.grau_risco, status: c.status,
      data_ocorrencia: c.data_ocorrencia ?? "", descricao: c.descricao ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((e) => { errs[e.path[0] as string] = e.message; });
      setErrors(errs);
      return;
    }
    const mulher = mulheres.find((m) => m.id === parsed.data.mulher_id);
    if (!mulher) { toast.error("Mulher não encontrada"); return; }
    setSaving(true);
    const payload = {
      mulher_id: parsed.data.mulher_id,
      municipio_id: mulher.municipio_id,
      tipo_ocorrencia: parsed.data.tipo_ocorrencia,
      grau_risco: parsed.data.grau_risco,
      status: parsed.data.status,
      data_ocorrencia: parsed.data.data_ocorrencia || null,
      descricao: parsed.data.descricao || null,
      ...(editing ? {} : { created_by: user?.id }),
    };
    const { error } = editing
      ? await supabase.from("casos").update(payload).eq("id", editing.id)
      : await supabase.from("casos").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Caso atualizado" : "Caso criado");
    setOpen(false);
    void load();
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("casos").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Caso removido"); void load(); }
    setDeleteId(null);
  };

  const filtered = items.filter((c) => {
    const matchSearch = `${c.tipo_ocorrencia} ${c.mulheres?.nome_completo ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const availableMulheres = isMaster ? mulheres : mulheres.filter((m) => m.municipio_id === municipioId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Casos</h1>
          <p className="text-sm text-muted-foreground">Acompanhamento de ocorrências e níveis de risco</p>
        </div>
        {writable && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo Caso</Button>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar tipo ou mulher..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="em_acompanhamento">Em acompanhamento</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mulher</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    {writable && <TableHead className="w-[120px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum caso</TableCell></TableRow>
                  ) : filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.mulheres?.nome_completo ?? "—"}</TableCell>
                      <TableCell>{c.tipo_ocorrencia}</TableCell>
                      <TableCell><Badge variant={riskColor[c.grau_risco]}>{c.grau_risco}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{c.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell>{c.data_ocorrencia ? new Date(c.data_ocorrencia).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      {writable && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                            {canDelete && <Button size="icon" variant="ghost" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4" /></Button>}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Caso</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mulher *</Label>
              <Select value={form.mulher_id} onValueChange={(v) => setForm({ ...form, mulher_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {availableMulheres.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.mulher_id && <p className="text-xs text-destructive mt-1">{errors.mulher_id}</p>}
            </div>
            <div>
              <Label>Tipo de Ocorrência *</Label>
              <Input value={form.tipo_ocorrencia} onChange={(e) => setForm({ ...form, tipo_ocorrencia: e.target.value })}
                placeholder="Ex: Violência doméstica, vulnerabilidade social..." />
              {errors.tipo_ocorrencia && <p className="text-xs text-destructive mt-1">{errors.tipo_ocorrencia}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Grau de Risco *</Label>
                <Select value={form.grau_risco} onValueChange={(v: any) => setForm({ ...form, grau_risco: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixo">Baixo</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="critico">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status *</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="em_acompanhamento">Em acompanhamento</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data Ocorrência</Label>
                <Input type="date" value={form.data_ocorrencia} onChange={(e) => setForm({ ...form, data_ocorrencia: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={4} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir caso?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
