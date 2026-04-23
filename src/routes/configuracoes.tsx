import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Save, TestTube2, ShieldCheck, Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/configuracoes")({
  component: () => (
    <ProtectedLayout>
      <Configuracoes />
    </ProtectedLayout>
  ),
});

type EvoConfig = {
  id?: string;
  municipio_id: string;
  api_url: string;
  api_token: string;
  instance_name: string;
  webhook_url: string | null;
  ativo: boolean;
};

function Configuracoes() {
  const { hasAnyRole, user } = useAuth();
  const canEdit = hasAnyRole(["master", "municipal"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<EvoConfig>({
    municipio_id: "",
    api_url: "",
    api_token: "",
    instance_name: "",
    webhook_url: "",
    ativo: true,
  });

  useEffect(() => {
    void (async () => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("municipio_id")
        .eq("id", user.id)
        .single();
      const munId = profile?.municipio_id;
      if (!munId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("evolution_config")
        .select("*")
        .eq("municipio_id", munId)
        .maybeSingle();
      if (data) setConfig(data as EvoConfig);
      else setConfig((c) => ({ ...c, municipio_id: munId }));
      setLoading(false);
    })();
  }, [user]);

  const salvar = async () => {
    if (!config.municipio_id) {
      toast.error("Usuário sem município vinculado");
      return;
    }
    setSaving(true);
    const payload = { ...config, updated_by: user?.id ?? null };
    const { error } = config.id
      ? await supabase.from("evolution_config").update(payload).eq("id", config.id)
      : await supabase.from("evolution_config").insert(payload).select().single();
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Configurações salvas");
  };

  const testar = async () => {
    if (!config.api_url || !config.api_token || !config.instance_name) {
      toast.error("Preencha URL, token e instância");
      return;
    }
    try {
      const res = await fetch(`${config.api_url.replace(/\/$/, "")}/instance/connectionState/${config.instance_name}`, {
        headers: { apikey: config.api_token },
      });
      if (res.ok) toast.success("Conexão com Evolution API OK");
      else toast.error(`Falha: HTTP ${res.status}`);
    } catch (e) {
      toast.error("Não foi possível conectar");
    }
  };

  if (loading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Integração Evolution API (WhatsApp)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolution API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>URL da API *</Label>
            <Input
              placeholder="https://evolution.seudominio.com"
              value={config.api_url}
              disabled={!canEdit}
              onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
            />
          </div>
          <div>
            <Label>Token da API *</Label>
            <Input
              type="password"
              value={config.api_token}
              disabled={!canEdit}
              onChange={(e) => setConfig({ ...config, api_token: e.target.value })}
            />
          </div>
          <div>
            <Label>Nome da instância *</Label>
            <Input
              value={config.instance_name}
              disabled={!canEdit}
              onChange={(e) => setConfig({ ...config, instance_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Webhook URL</Label>
            <Textarea
              rows={2}
              value={config.webhook_url ?? ""}
              disabled={!canEdit}
              onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Integração ativa</Label>
              <p className="text-xs text-muted-foreground">Habilita o envio automático de mensagens</p>
            </div>
            <Switch
              checked={config.ativo}
              disabled={!canEdit}
              onCheckedChange={(v) => setConfig({ ...config, ativo: v })}
            />
          </div>

          {canEdit && (
            <div className="flex gap-2">
              <Button onClick={() => void salvar()} disabled={saving}>
                <Save className="mr-2 h-4 w-4" /> Salvar
              </Button>
              <Button variant="outline" onClick={() => void testar()}>
                <TestTube2 className="mr-2 h-4 w-4" /> Testar conexão
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
