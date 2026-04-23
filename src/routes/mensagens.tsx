import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Send, Calendar } from "lucide-react";

export const Route = createFileRoute("/mensagens")({
  component: () => (
    <ProtectedLayout>
      <Mensagens />
    </ProtectedLayout>
  ),
});

const CATEGORIAS = [
  { v: "boas_vindas", l: "Boas-vindas" },
  { v: "acompanhamento", l: "Acompanhamento" },
  { v: "lembrete", l: "Lembrete" },
  { v: "aniversario", l: "Aniversário" },
  { v: "outro", l: "Outro" },
] as const;

const VARIAVEIS = ["{{nome}}", "{{data}}", "{{municipio}}", "{{telefone}}"];

type Template = {
  id: string;
  nome: string;
  categoria: string;
  conteudo: string;
  ativo: boolean;
  municipio_id: string | null;
};

type Mulher = { id: string; nome_completo: string; telefone: string | null; municipio_id: string };

type Enviada = {
  id: string;
  mulher_id: string;
  template_id: string | null;
  categoria: string;
  conteudo: string;
  status: string;
  agendada_para: string | null;
  enviada_em: string | null;
  created_at: string;
};

function Mensagens() {
  const { hasAnyRole, user } = useAuth();
  const canWrite = hasAnyRole(["master", "municipal", "operacional"]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [enviadas, setEnviadas] = useState<Enviada[]>([]);
  const [mulheres, setMulheres] = useState<Mulher[]>([]);
  const [municipioId, setMunicipioId] = useState<string | null>(null);

  const carregar = async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("municipio_id")
      .eq("id", user.id)
      .single();
    setMunicipioId(profile?.municipio_id ?? null);

    const [{ data: t }, { data: e }, { data: m }] = await Promise.all([
      supabase.from("mensagens_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("mensagens_enviadas").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("mulheres").select("id, nome_completo, telefone, municipio_id"),
    ]);
    setTemplates((t ?? []) as Template[]);
    setEnviadas((e ?? []) as Enviada[]);
    setMulheres((m ?? []) as Mulher[]);
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mensagens</h1>
        <p className="text-muted-foreground">Templates, envio e agendamento</p>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="enviadas">Enviadas / Agendadas</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <TemplatesTab
            templates={templates}
            municipioId={municipioId}
            canWrite={canWrite}
            onChange={() => void carregar()}
            userId={user?.id ?? null}
          />
        </TabsContent>

        <TabsContent value="enviadas" className="space-y-4">
          <EnviadasTab
            enviadas={enviadas}
            mulheres={mulheres}
            templates={templates}
            municipioId={municipioId}
            canWrite={canWrite}
            onChange={() => void carregar()}
            userId={user?.id ?? null}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TemplatesTab({
  templates,
  municipioId,
  canWrite,
  onChange,
  userId,
}: {
  templates: Template[];
  municipioId: string | null;
  canWrite: boolean;
  onChange: () => void;
  userId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({
    nome: "",
    categoria: "outro",
    conteudo: "",
    ativo: true,
  });

  const abrirNovo = () => {
    setEditing(null);
    setForm({ nome: "", categoria: "outro", conteudo: "", ativo: true });
    setOpen(true);
  };
  const abrirEditar = (t: Template) => {
    setEditing(t);
    setForm({ nome: t.nome, categoria: t.categoria, conteudo: t.conteudo, ativo: t.ativo });
    setOpen(true);
  };

  const salvar = async () => {
    if (!form.nome || !form.conteudo) {
      toast.error("Nome e conteúdo são obrigatórios");
      return;
    }
    const payload = {
      ...form,
      municipio_id: municipioId,
      created_by: userId,
    };
    const { error } = editing
      ? await supabase.from("mensagens_templates").update(payload).eq("id", editing.id)
      : await supabase.from("mensagens_templates").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Template salvo");
      setOpen(false);
      onChange();
    }
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir template?")) return;
    const { error } = await supabase.from("mensagens_templates").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Excluído");
      onChange();
    }
  };

  const inserirVar = (v: string) =>
    setForm((f) => ({ ...f, conteudo: f.conteudo + " " + v }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Templates de mensagem</CardTitle>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={abrirNovo}>
                <Plus className="mr-2 h-4 w-4" /> Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar" : "Novo"} template</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Conteúdo</Label>
                  <Textarea
                    rows={5}
                    value={form.conteudo}
                    onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                    placeholder="Olá {{nome}}, ..."
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {VARIAVEIS.map((v) => (
                      <Button key={v} type="button" size="sm" variant="outline" onClick={() => inserirVar(v)}>
                        {v}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => void salvar()}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Conteúdo</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.nome}</TableCell>
                <TableCell><Badge variant="secondary">{t.categoria}</Badge></TableCell>
                <TableCell className="max-w-xs truncate">{t.conteudo}</TableCell>
                <TableCell>{t.ativo ? "Sim" : "Não"}</TableCell>
                <TableCell className="text-right">
                  {canWrite && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => abrirEditar(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => void excluir(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {templates.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum template cadastrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EnviadasTab({
  enviadas,
  mulheres,
  templates,
  municipioId,
  canWrite,
  onChange,
  userId,
}: {
  enviadas: Enviada[];
  mulheres: Mulher[];
  templates: Template[];
  municipioId: string | null;
  canWrite: boolean;
  onChange: () => void;
  userId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    mulher_id: "",
    template_id: "",
    categoria: "outro",
    conteudo: "",
    agendada_para: "",
  });

  const aplicarTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setForm((f) => ({ ...f, template_id: id, categoria: t.categoria, conteudo: t.conteudo }));
  };

  const salvar = async () => {
    if (!form.mulher_id || !form.conteudo) {
      toast.error("Mulher e conteúdo são obrigatórios");
      return;
    }
    const mulher = mulheres.find((m) => m.id === form.mulher_id);
    if (!mulher) return;
    const conteudoFinal = form.conteudo
      .replaceAll("{{nome}}", mulher.nome_completo)
      .replaceAll("{{telefone}}", mulher.telefone ?? "")
      .replaceAll("{{data}}", new Date().toLocaleDateString("pt-BR"));

    const agendada = form.agendada_para ? new Date(form.agendada_para).toISOString() : null;
    const payload = {
      mulher_id: form.mulher_id,
      municipio_id: mulher.municipio_id,
      template_id: form.template_id || null,
      categoria: form.categoria,
      conteudo: conteudoFinal,
      status: agendada ? "agendada" : "pendente",
      agendada_para: agendada,
      created_by: userId,
    };
    const { error } = await supabase.from("mensagens_enviadas").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success(agendada ? "Mensagem agendada" : "Mensagem registrada");
      setOpen(false);
      setForm({ mulher_id: "", template_id: "", categoria: "outro", conteudo: "", agendada_para: "" });
      onChange();
    }
  };

  const marcarEnviada = async (id: string) => {
    const { error } = await supabase
      .from("mensagens_enviadas")
      .update({ status: "enviada", enviada_em: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Marcada como enviada");
      onChange();
    }
  };

  const nomeMulher = (id: string) => mulheres.find((m) => m.id === id)?.nome_completo ?? "—";

  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "enviada" || s === "lida") return "default";
    if (s === "falhou") return "destructive";
    if (s === "agendada") return "secondary";
    return "outline";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Mensagens enviadas e agendadas</CardTitle>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Send className="mr-2 h-4 w-4" /> Nova mensagem
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova mensagem</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Destinatária</Label>
                  <Select value={form.mulher_id} onValueChange={(v) => setForm({ ...form, mulher_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {mulheres.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.nome_completo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Template (opcional)</Label>
                  <Select value={form.template_id} onValueChange={aplicarTemplate}>
                    <SelectTrigger><SelectValue placeholder="Sem template" /></SelectTrigger>
                    <SelectContent>
                      {templates.filter((t) => t.ativo).map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Conteúdo</Label>
                  <Textarea rows={5} value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Variáveis serão substituídas: {VARIAVEIS.join(", ")}
                  </p>
                </div>
                <div>
                  <Label>Agendar para (opcional)</Label>
                  <Input
                    type="datetime-local"
                    value={form.agendada_para}
                    onChange={(e) => setForm({ ...form, agendada_para: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => void salvar()}>
                  {form.agendada_para ? <><Calendar className="mr-2 h-4 w-4" />Agendar</> : <><Send className="mr-2 h-4 w-4" />Registrar</>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinatária</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Agendada</TableHead>
              <TableHead>Criada</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enviadas.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{nomeMulher(e.mulher_id)}</TableCell>
                <TableCell><Badge variant="secondary">{e.categoria}</Badge></TableCell>
                <TableCell><Badge variant={statusVariant(e.status)}>{e.status}</Badge></TableCell>
                <TableCell>{e.agendada_para ? new Date(e.agendada_para).toLocaleString("pt-BR") : "—"}</TableCell>
                <TableCell>{new Date(e.created_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-right">
                  {canWrite && (e.status === "pendente" || e.status === "agendada") && (
                    <Button size="sm" variant="outline" onClick={() => void marcarEnviada(e.id)}>
                      <Send className="mr-1 h-3 w-3" /> Enviada
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {enviadas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhuma mensagem registrada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
