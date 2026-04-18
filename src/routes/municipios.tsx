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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/municipios")({
  component: () => (
    <ProtectedLayout>
      <MunicipiosModule />
    </ProtectedLayout>
  ),
});

type Municipio = {
  id: string;
  nome: string;
  uf: string;
  codigo_ibge: string | null;
  ativo: boolean;
  created_at: string;
};

const schema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(120),
  uf: z.string().trim().length(2, "UF deve ter 2 letras").toUpperCase(),
  codigo_ibge: z.string().trim().max(20).optional().or(z.literal("")),
  ativo: z.boolean(),
});

function MunicipiosModule() {
  const { hasAnyRole, hasRole } = useAuth();
  const isMaster = hasRole("master");
  const canManage = hasAnyRole(["master"]);

  const [items, setItems] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Municipio | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", uf: "BR", codigo_ibge: "", ativo: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("municipios")
      .select("*")
      .order("nome");
    if (error) toast.error("Erro ao carregar municípios");
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ nome: "", uf: "BR", codigo_ibge: "", ativo: true });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (m: Municipio) => {
    setEditing(m);
    setForm({ nome: m.nome, uf: m.uf, codigo_ibge: m.codigo_ibge ?? "", ativo: m.ativo });
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
      uf: parsed.data.uf,
      codigo_ibge: parsed.data.codigo_ibge || null,
      ativo: parsed.data.ativo,
    };
    const { error } = editing
      ? await supabase.from("municipios").update(payload).eq("id", editing.id)
      : await supabase.from("municipios").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Município atualizado" : "Município criado");
    setOpen(false);
    void load();
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("municipios").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Município removido"); void load(); }
    setDeleteId(null);
  };

  const filtered = items.filter((m) =>
    `${m.nome} ${m.uf} ${m.codigo_ibge ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Municípios</h1>
          <p className="text-sm text-muted-foreground">Gestão dos municípios da Secretaria</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo Município</Button>
        )}
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
                    <TableHead>UF</TableHead>
                    <TableHead>Código IBGE</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="w-[120px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum município</TableCell></TableRow>
                  ) : filtered.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.nome}</TableCell>
                      <TableCell>{m.uf}</TableCell>
                      <TableCell>{m.codigo_ibge ?? "—"}</TableCell>
                      <TableCell><Badge variant={m.ativo ? "default" : "secondary"}>{m.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                            {isMaster && (
                              <Button size="icon" variant="ghost" onClick={() => setDeleteId(m.id)}><Trash2 className="h-4 w-4" /></Button>
                            )}
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Município</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>UF *</Label>
                <Input maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} />
                {errors.uf && <p className="text-xs text-destructive mt-1">{errors.uf}</p>}
              </div>
              <div>
                <Label>Código IBGE</Label>
                <Input value={form.codigo_ibge} onChange={(e) => setForm({ ...form, codigo_ibge: e.target.value })} />
              </div>
            </div>
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

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir município?</AlertDialogTitle>
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
