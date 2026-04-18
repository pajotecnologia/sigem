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

export const Route = createFileRoute("/atendimentos")({
  component: () => (
    <ProtectedLayout>
      <AtendimentosModule />
    </ProtectedLayout>
  ),
});

type TipoAtendimento = "social" | "juridico" | "psicologico" | "medico" | "outro";

type Atendimento = {
  id: string;
  mulher_id: string;
  caso_id: string | null;
  municipio_id: string;
  tipo: TipoAtendimento;
  data_hora: string;
  observacoes: string | null;
  mulheres?: { nome_completo: string } | null;
};

type MulherOpt = { id: string; nome_completo: string; municipio_id: string };
type CasoOpt = { id: string; mulher_id: string; tipo_ocorrencia: string };

const schema = z.object({
  mulher_id: z.string().uuid("Selecione a mulher"),
  caso_id: z.string().optional(),
  tipo: z.enum(["social", "juridico", "psicologico", "medico", "outro"]),
  data_hora: z.string().min(1, "Informe data e hora"),
  observacoes: z.string().max(2000).optional(),
});

function AtendimentosModule() {
  const { user, municipioId, canWrite, hasRole, hasAnyRole } = useAuth();
  const isMaster = hasRole("master");
  const writable = canWrite();
  const canDelete = hasAnyRole(["master", "municipal"]);

  const [items, setItems] = useState<Atendimento[]>([]);
  const [mulheres, setMulheres] = useState<MulherOpt[]>([]);
  const [casos, setCasos] = useState<CasoOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Atendimento | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    mulher_id: "", caso_id: "none", tipo: "social" as TipoAtendimento,
    data_hora: "", observacoes: "",
  });

  const load = async () => {
    setLoading(true);
    const [{ data: atend, error }, { data: mulh }, { data: cs }] = await Promise.all([
      supabase.from("atendimentos").select("*, mulheres(nome_completo)").order("data_hora", { ascending: false }),
      supabase.from("mulheres").select("id, nome_completo, municipio_id").order("nome_completo"),
      supabase.from("casos").select("id, mulher_id, tipo_ocorrencia"),
    ]);
    if (error) toast.error("Erro ao carregar atendimentos");
    setItems((atend as Atendimento[]) ?? []);
    setMulheres(mulh ?? []);
    setCasos(cs ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setEditing(null);
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setForm({
      mulher_id: "", caso_id: "none", tipo: "social",
      data_hora: now.toISOString().slice(0, 16), observacoes: "",
    });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (a: Atendimento) => {
    setEditing(a);
    const dt = new Date(a.data_hora);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    setForm({
      mulher_id: a.mulher_id, caso_id: a.caso_id ?? "none",
      tipo: a.tipo, data_hora: dt.toISOString().slice(0, 16),
      observacoes: a.observacoes ?? "",
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
      caso_id: parsed.data.caso_id && parsed.data.caso_id !== "none" ? parsed.data.caso_id : null,
      municipio_id: mulher.municipio_id,
      tipo: parsed.data.tipo,
      data_hora: new Date(parsed.data.data_hora).toISOString(),
      observacoes: parsed.data.observacoes || null,
      profissional_id: user?.id ?? null,
      ...(editing ? {} : { created_by: user?.id }),
    };
    const { error } = editing
      ? await supabase.from("atendimentos").update(payload).eq("id", editing.id)
      : await supabase.from("atendimentos").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Atendimento atualizado" : "Atendimento registrado");
    setOpen(false);
    void load();
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("atendimentos").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Atendimento removido"); void load(); }
    setDeleteId(null);
  };

  const filtered = items.filter((a) => {
    const matchSearch = `${a.mulheres?.nome_completo ?? ""} ${a.tipo}`.toLowerCase().includes(search.toLowerCase());
    const matchTipo = tipoFilter === "all" || a.tipo === tipoFilter;
    return matchSearch && matchTipo;
  });

  const availableMulheres = isMaster ? mulheres : mulheres.filter((m) => m.municipio_id === municipioId);
  const availableCasos = casos.filter((c) => c.mulher_id === form.mulher_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Atendimentos</h1>
          <p className="text-sm text-muted-foreground">Registro multidisciplinar e agendamento</p>
        </div>
        {writable && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo Atendimento</Button>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="social">Social</SelectItem>
                <SelectItem value="juridico">Jurídico</SelectItem>
                <SelectItem value="psicologico">Psicológico</SelectItem>
                <SelectItem value="medico">Médico</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
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
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Observações</TableHead>
                    {writable && <TableHead className="w-[120px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum atendimento</TableCell></TableRow>
                  ) : filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.mulheres?.nome_completo ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{a.tipo}</Badge></TableCell>
                      <TableCell>{new Date(a.data_hora).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="max-w-xs truncate">{a.observacoes ?? "—"}</TableCell>
                      {writable && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                            {canDelete && <Button size="icon" variant="ghost" onClick={() => setDeleteId(a.id)}><Trash2 className="h-4 w-4" /></Button>}
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
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Atendimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mulher *</Label>
              <Select value={form.mulher_id} onValueChange={(v) => setForm({ ...form, mulher_id: v, caso_id: "none" })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {availableMulheres.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.mulher_id && <p className="text-xs text-destructive mt-1">{errors.mulher_id}</p>}
            </div>
            {availableCasos.length > 0 && (
              <div>
                <Label>Caso vinculado (opcional)</Label>
                <Select value={form.caso_id} onValueChange={(v) => setForm({ ...form, caso_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {availableCasos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.tipo_ocorrencia}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="juridico">Jurídico</SelectItem>
                    <SelectItem value="psicologico">Psicológico</SelectItem>
                    <SelectItem value="medico">Médico</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data e Hora *</Label>
                <Input type="datetime-local" value={form.data_hora} onChange={(e) => setForm({ ...form, data_hora: e.target.value })} />
                {errors.data_hora && <p className="text-xs text-destructive mt-1">{errors.data_hora}</p>}
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={4} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
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
            <AlertDialogTitle>Excluir atendimento?</AlertDialogTitle>
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
