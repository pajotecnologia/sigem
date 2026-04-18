import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/programas")({
  component: () => (
    <ProtectedLayout>
      <ProgramasModule />
    </ProtectedLayout>
  ),
});

type Programa = {
  id: string;
  nome: string;
  descricao: string | null;
  municipio_id: string | null;
  ativo: boolean;
};

type Municipio = { id: string; nome: string };
type MulherOpt = { id: string; nome_completo: string; municipio_id: string };
type Participante = {
  id: string;
  mulher_id: string;
  programa_id: string;
  data_inicio: string;
  data_fim: string | null;
  status: string | null;
  mulheres?: { nome_completo: string } | null;
};

const schema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(120),
  descricao: z.string().max(2000).optional(),
  municipio_id: z.string().optional(),
  ativo: z.boolean(),
});

function ProgramasModule() {
  const { municipioId, canWrite, hasRole, hasAnyRole } = useAuth();
  const isMaster = hasRole("master");
  const writable = canWrite();
  const canDelete = hasAnyRole(["master", "municipal"]);

  const [items, setItems] = useState<Programa[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [mulheres, setMulheres] = useState<MulherOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Programa | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ nome: "", descricao: "", municipio_id: "none", ativo: true });

  // Participants modal
  const [partOpen, setPartOpen] = useState(false);
  const [partProg, setPartProg] = useState<Programa | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [novoParticipante, setNovoParticipante] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: progs, error }, { data: muns }, { data: mulh }] = await Promise.all([
      supabase.from("programas").select("*").order("nome"),
      supabase.from("municipios").select("id, nome").order("nome"),
      supabase.from("mulheres").select("id, nome_completo, municipio_id").order("nome_completo"),
    ]);
    if (error) toast.error("Erro ao carregar programas");
    setItems(progs ?? []);
    setMunicipios(muns ?? []);
    setMulheres(mulh ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ nome: "", descricao: "", municipio_id: isMaster ? "none" : (municipioId ?? "none"), ativo: true });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (p: Programa) => {
    setEditing(p);
    setForm({ nome: p.nome, descricao: p.descricao ?? "", municipio_id: p.municipio_id ?? "none", ativo: p.ativo });
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
    setSaving(true);
    const payload = {
      nome: parsed.data.nome,
      descricao: parsed.data.descricao || null,
      municipio_id: parsed.data.municipio_id && parsed.data.municipio_id !== "none" ? parsed.data.municipio_id : null,
      ativo: parsed.data.ativo,
    };
    const { error } = editing
      ? await supabase.from("programas").update(payload).eq("id", editing.id)
      : await supabase.from("programas").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Programa atualizado" : "Programa criado");
    setOpen(false);
    void load();
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("programas").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Programa removido"); void load(); }
    setDeleteId(null);
  };

  const openParticipantes = async (p: Programa) => {
    setPartProg(p);
    setNovoParticipante("");
    setPartOpen(true);
    const { data } = await supabase
      .from("programa_participantes")
      .select("*, mulheres(nome_completo)")
      .eq("programa_id", p.id);
    setParticipantes((data as Participante[]) ?? []);
  };

  const addParticipante = async () => {
    if (!partProg || !novoParticipante) return;
    const { error } = await supabase.from("programa_participantes").insert({
      programa_id: partProg.id, mulher_id: novoParticipante,
    });
    if (error) toast.error(error.message);
    else { toast.success("Participante adicionada"); void openParticipantes(partProg); }
  };

  const removeParticipante = async (id: string) => {
    const { error } = await supabase.from("programa_participantes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else if (partProg) { toast.success("Removido"); void openParticipantes(partProg); }
  };

  const filtered = items.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase()));
  const availableMulheres = isMaster ? mulheres : mulheres.filter((m) => m.municipio_id === municipioId);
  const enrolledIds = new Set(participantes.map((p) => p.mulher_id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Programas e Projetos</h1>
          <p className="text-sm text-muted-foreground">Programas sociais e participantes</p>
        </div>
        {writable && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo Programa</Button>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Município</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[200px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum programa</TableCell></TableRow>
                  ) : filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>{municipios.find((m) => m.id === p.municipio_id)?.nome ?? "Estadual"}</TableCell>
                      <TableCell><Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openParticipantes(p)} title="Participantes"><Users className="h-4 w-4" /></Button>
                          {writable && <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>}
                          {canDelete && <Button size="icon" variant="ghost" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Programa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            {isMaster && (
              <div>
                <Label>Município (vazio = estadual)</Label>
                <Select value={form.municipio_id} onValueChange={(v) => setForm({ ...form, municipio_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Estadual</SelectItem>
                    {municipios.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={partOpen} onOpenChange={setPartOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Participantes — {partProg?.nome}</DialogTitle></DialogHeader>
          {writable && (
            <div className="flex gap-2">
              <Select value={novoParticipante} onValueChange={setNovoParticipante}>
                <SelectTrigger><SelectValue placeholder="Adicionar mulher..." /></SelectTrigger>
                <SelectContent>
                  {availableMulheres.filter((m) => !enrolledIds.has(m.id)).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addParticipante} disabled={!novoParticipante}>Adicionar</Button>
            </div>
          )}
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mulher</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Status</TableHead>
                  {writable && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {participantes.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma participante</TableCell></TableRow>
                ) : participantes.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.mulheres?.nome_completo ?? "—"}</TableCell>
                    <TableCell>{new Date(p.data_inicio).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="outline">{p.status ?? "ativo"}</Badge></TableCell>
                    {writable && (
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => removeParticipante(p.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir programa?</AlertDialogTitle>
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
