import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Plus, Pencil, Trash2, FileText, Search, Upload, Download, X } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/mulheres")({
  component: () => (
    <ProtectedLayout>
      <MulheresModule />
    </ProtectedLayout>
  ),
});

type Mulher = {
  id: string;
  municipio_id: string;
  nome_completo: string;
  cpf: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  cep: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  escolaridade: string | null;
  renda: number | null;
  situacao_social: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

type Municipio = { id: string; nome: string; uf: string };

const mulherSchema = z.object({
  nome_completo: z.string().trim().min(2, "Nome obrigatório").max(200),
  municipio_id: z.string().uuid("Selecione o município"),
  cpf: z.string().trim().max(14).optional().or(z.literal("")),
  data_nascimento: z.string().optional().or(z.literal("")),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  cep: z.string().trim().max(9).optional().or(z.literal("")),
  endereco: z.string().trim().max(255).optional().or(z.literal("")),
  bairro: z.string().trim().max(100).optional().or(z.literal("")),
  cidade: z.string().trim().max(100).optional().or(z.literal("")),
  uf: z.string().trim().max(2).optional().or(z.literal("")),
  escolaridade: z.string().trim().max(100).optional().or(z.literal("")),
  renda: z.string().optional().or(z.literal("")),
  situacao_social: z.string().trim().max(255).optional().or(z.literal("")),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
});

const ESCOLARIDADES = [
  "Sem instrução",
  "Fundamental incompleto",
  "Fundamental completo",
  "Médio incompleto",
  "Médio completo",
  "Superior incompleto",
  "Superior completo",
  "Pós-graduação",
];

const emptyForm = {
  nome_completo: "",
  municipio_id: "",
  cpf: "",
  data_nascimento: "",
  telefone: "",
  cep: "",
  endereco: "",
  bairro: "",
  cidade: "",
  uf: "",
  escolaridade: "",
  renda: "",
  situacao_social: "",
  observacoes: "",
};

function MulheresModule() {
  const { canWrite, hasAnyRole, municipioId, hasRole } = useAuth();
  const [list, setList] = useState<Mulher[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Mulher | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Mulher | null>(null);
  const [docsOf, setDocsOf] = useState<Mulher | null>(null);

  const isMaster = hasRole("master");
  const writable = canWrite();
  const canDelete = hasAnyRole(["master", "municipal"]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: mData, error: mErr }, { data: munData }] = await Promise.all([
      supabase.from("mulheres").select("*").order("created_at", { ascending: false }),
      supabase.from("municipios").select("id, nome, uf").eq("ativo", true).order("nome"),
    ]);
    if (mErr) toast.error("Erro ao carregar: " + mErr.message);
    setList((mData ?? []) as Mulher[]);
    setMunicipios((munData ?? []) as Municipio[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.nome_completo.toLowerCase().includes(q) ||
        (m.cpf ?? "").toLowerCase().includes(q) ||
        (m.cidade ?? "").toLowerCase().includes(q)
    );
  }, [list, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, municipio_id: municipioId ?? "" });
    setOpen(true);
  };

  const openEdit = (m: Mulher) => {
    setEditing(m);
    setForm({
      nome_completo: m.nome_completo ?? "",
      municipio_id: m.municipio_id ?? "",
      cpf: m.cpf ?? "",
      data_nascimento: m.data_nascimento ?? "",
      telefone: m.telefone ?? "",
      cep: m.cep ?? "",
      endereco: m.endereco ?? "",
      bairro: m.bairro ?? "",
      cidade: m.cidade ?? "",
      uf: m.uf ?? "",
      escolaridade: m.escolaridade ?? "",
      renda: m.renda != null ? String(m.renda) : "",
      situacao_social: m.situacao_social ?? "",
      observacoes: m.observacoes ?? "",
    });
    setOpen(true);
  };

  const handleCepBlur = async () => {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      setForm((f) => ({
        ...f,
        endereco: data.logradouro || f.endereco,
        bairro: data.bairro || f.bairro,
        cidade: data.localidade || f.cidade,
        uf: data.uf || f.uf,
      }));
    } catch {
      toast.error("Falha ao consultar CEP");
    }
  };

  const handleSave = async () => {
    const parsed = mulherSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const payload = {
      nome_completo: form.nome_completo.trim(),
      municipio_id: form.municipio_id,
      cpf: form.cpf || null,
      data_nascimento: form.data_nascimento || null,
      telefone: form.telefone || null,
      cep: form.cep || null,
      endereco: form.endereco || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      uf: form.uf || null,
      escolaridade: form.escolaridade || null,
      renda: form.renda ? Number(form.renda) : null,
      situacao_social: form.situacao_social || null,
      observacoes: form.observacoes || null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("mulheres").update(payload).eq("id", editing.id));
    } else {
      const { data: u } = await supabase.auth.getUser();
      ({ error } = await supabase
        .from("mulheres")
        .insert({ ...payload, created_by: u.user?.id ?? null }));
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Cadastro atualizado" : "Cadastro criado");
    setOpen(false);
    void loadAll();
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    const { error } = await supabase.from("mulheres").delete().eq("id", confirmDel.id);
    if (error) toast.error(error.message);
    else toast.success("Cadastro removido");
    setConfirmDel(null);
    void loadAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Cadastro de Mulheres</h1>
          <p className="text-muted-foreground">Gestão completa com isolamento por município</p>
        </div>
        {writable && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nova mulher
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Lista ({filtered.length})</CardTitle>
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou cidade..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Nenhum cadastro encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Escolaridade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.nome_completo}</TableCell>
                      <TableCell>{m.cpf ?? "—"}</TableCell>
                      <TableCell>{m.telefone ?? "—"}</TableCell>
                      <TableCell>
                        {m.cidade ? `${m.cidade}/${m.uf ?? ""}` : "—"}
                      </TableCell>
                      <TableCell>
                        {m.escolaridade ? <Badge variant="secondary">{m.escolaridade}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setDocsOf(m)} title="Documentos">
                            <FileText className="h-4 w-4" />
                          </Button>
                          {writable && (
                            <Button size="icon" variant="ghost" onClick={() => openEdit(m)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setConfirmDel(m)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
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

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar mulher" : "Novo cadastro"}</DialogTitle>
            <DialogDescription>
              Preencha os dados. Campos com * são obrigatórios.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label>Nome completo *</Label>
              <Input
                value={form.nome_completo}
                onChange={(e) => setForm({ ...form, nome_completo: e.target.value })}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label>Município *</Label>
              <Select
                value={form.municipio_id}
                onValueChange={(v) => setForm({ ...form, municipio_id: v })}
                disabled={!isMaster && !!municipioId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {municipios.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} / {m.uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>CPF</Label>
              <Input
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                maxLength={14}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-2">
              <Label>Data de nascimento</Label>
              <Input
                type="date"
                value={form.data_nascimento}
                onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                maxLength={20}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label>CEP</Label>
              <Input
                value={form.cep}
                onChange={(e) => setForm({ ...form, cep: e.target.value })}
                onBlur={handleCepBlur}
                maxLength={9}
                placeholder="00000-000"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Endereço</Label>
              <Input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input
                value={form.bairro}
                onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>UF</Label>
              <Input
                value={form.uf}
                onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                maxLength={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Escolaridade</Label>
              <Select
                value={form.escolaridade}
                onValueChange={(v) => setForm({ ...form, escolaridade: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ESCOLARIDADES.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Renda (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.renda}
                onChange={(e) => setForm({ ...form, renda: e.target.value })}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Situação social</Label>
              <Input
                value={form.situacao_social}
                onChange={(e) => setForm({ ...form, situacao_social: e.target.value })}
                maxLength={255}
                placeholder="Ex.: vulnerabilidade, desemprego, beneficiária de programa..."
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                maxLength={2000}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cadastro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá <strong>{confirmDel?.nome_completo}</strong> permanentemente. Casos
              e atendimentos vinculados podem ser afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Documents drawer/dialog */}
      {docsOf && (
        <DocsDialog
          mulher={docsOf}
          canWrite={writable}
          canDelete={canDelete}
          onClose={() => setDocsOf(null)}
        />
      )}
    </div>
  );
}

function DocsDialog({
  mulher,
  canWrite,
  canDelete,
  onClose,
}: {
  mulher: Mulher;
  canWrite: boolean;
  canDelete: boolean;
  onClose: () => void;
}) {
  const folder = `${mulher.municipio_id}/${mulher.id}`;
  const [files, setFiles] = useState<{ name: string; size: number; created_at?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.storage.from("mulheres-docs").list(folder, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) toast.error(error.message);
    setFiles(
      (data ?? []).filter((f) => f.name !== ".emptyFolderPlaceholder").map((f) => ({
        name: f.name,
        size: (f.metadata as { size?: number } | null)?.size ?? 0,
        created_at: f.created_at,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [mulher.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo deve ter no máximo 10MB");
      return;
    }
    setUploading(true);
    const safeName = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage
      .from("mulheres-docs")
      .upload(`${folder}/${safeName}`, file, { upsert: false });
    setUploading(false);
    e.target.value = "";
    if (error) toast.error(error.message);
    else {
      toast.success("Arquivo enviado");
      void load();
    }
  };

  const handleDownload = async (name: string) => {
    const { data, error } = await supabase.storage
      .from("mulheres-docs")
      .createSignedUrl(`${folder}/${name}`, 60);
    if (error || !data) {
      toast.error("Falha ao gerar link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Remover ${name}?`)) return;
    const { error } = await supabase.storage.from("mulheres-docs").remove([`${folder}/${name}`]);
    if (error) toast.error(error.message);
    else {
      toast.success("Removido");
      void load();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Documentos — {mulher.nome_completo}</DialogTitle>
          <DialogDescription>Arquivos privados, isolados por município.</DialogDescription>
        </DialogHeader>

        {canWrite && (
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
              <div className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted">
                <Upload className="h-4 w-4" />
                {uploading ? "Enviando..." : "Clique para enviar (máx 10MB)"}
              </div>
            </label>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto rounded-md border">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : files.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Nenhum documento.</div>
          ) : (
            <ul className="divide-y">
              {files.map((f) => (
                <li key={f.name} className="flex items-center justify-between p-3 text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(f.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleDownload(f.name)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(f.name)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
