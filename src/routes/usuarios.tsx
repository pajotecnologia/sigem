import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/usuarios")({
  component: () => (
    <ProtectedLayout>
      <UsuariosModule />
    </ProtectedLayout>
  ),
});

type Profile = {
  id: string;
  nome_completo: string;
  email: string;
  municipio_id: string | null;
  ativo: boolean;
};
type UserRole = { id: string; user_id: string; role: AppRole; municipio_id: string | null };
type Municipio = { id: string; nome: string };

const ROLES: AppRole[] = ["master", "municipal", "operacional", "visualizacao"];

function UsuariosModule() {
  const { hasRole } = useAuth();
  const isMaster = hasRole("master");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome_completo: "", municipio_id: "none", role: "visualizacao" as AppRole, ativo: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: prof, error }, { data: rls }, { data: muns }] = await Promise.all([
      supabase.from("profiles").select("*").order("nome_completo"),
      supabase.from("user_roles").select("*"),
      supabase.from("municipios").select("id, nome").order("nome"),
    ]);
    if (error) toast.error("Erro ao carregar usuários");
    setProfiles(prof ?? []);
    setRoles((rls as UserRole[]) ?? []);
    setMunicipios(muns ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const userRole = (uid: string): AppRole => {
    const r = roles.find((x) => x.user_id === uid);
    return r?.role ?? "visualizacao";
  };

  const openEdit = (p: Profile) => {
    setEditing(p);
    setForm({
      nome_completo: p.nome_completo,
      municipio_id: p.municipio_id ?? "none",
      role: userRole(p.id),
      ativo: p.ativo,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!editing) return;
    setSaving(true);
    const muniId = form.municipio_id === "none" ? null : form.municipio_id;

    const { error: pErr } = await supabase
      .from("profiles")
      .update({ nome_completo: form.nome_completo, municipio_id: muniId, ativo: form.ativo })
      .eq("id", editing.id);
    if (pErr) { toast.error(pErr.message); setSaving(false); return; }

    // Replace role
    const { error: dErr } = await supabase.from("user_roles").delete().eq("user_id", editing.id);
    if (dErr) { toast.error(dErr.message); setSaving(false); return; }
    const { error: iErr } = await supabase.from("user_roles").insert({
      user_id: editing.id, role: form.role, municipio_id: muniId,
    });
    setSaving(false);
    if (iErr) { toast.error(iErr.message); return; }
    toast.success("Usuário atualizado");
    setOpen(false);
    void load();
  };

  const toggleAtivo = async (p: Profile) => {
    const { error } = await supabase.from("profiles").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success(p.ativo ? "Desativado" : "Ativado"); void load(); }
  };

  const filtered = profiles.filter((p) =>
    `${p.nome_completo} ${p.email}`.toLowerCase().includes(search.toLowerCase())
  );

  if (!isMaster) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        Acesso restrito a administradores Master.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuários e Permissões</h1>
        <p className="text-sm text-muted-foreground">Os usuários se cadastram pelo formulário de signup. Aqui você atribui papéis e municípios.</p>
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
                    <TableHead>Email</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Município</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum usuário</TableCell></TableRow>
                  ) : filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nome_completo}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{userRole(p.id)}</Badge></TableCell>
                      <TableCell>{municipios.find((m) => m.id === p.municipio_id)?.nome ?? "—"}</TableCell>
                      <TableCell><Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => toggleAtivo(p)} title={p.ativo ? "Desativar" : "Ativar"}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome Completo</Label>
              <Input value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={editing?.email ?? ""} disabled />
            </div>
            <div>
              <Label>Papel *</Label>
              <Select value={form.role} onValueChange={(v: AppRole) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Município</Label>
              <Select value={form.municipio_id} onValueChange={(v) => setForm({ ...form, municipio_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (Estadual)</SelectItem>
                  {municipios.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
