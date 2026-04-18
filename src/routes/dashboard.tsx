import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FolderOpen, CalendarClock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <ProtectedLayout>
      <Dashboard />
    </ProtectedLayout>
  ),
});

function Dashboard() {
  const { roles, nomeCompleto } = useAuth();
  const [stats, setStats] = useState({ mulheres: 0, casos: 0, atendimentos: 0, criticos: 0 });

  useEffect(() => {
    void (async () => {
      const [m, c, a, cr] = await Promise.all([
        supabase.from("mulheres").select("*", { count: "exact", head: true }),
        supabase.from("casos").select("*", { count: "exact", head: true }),
        supabase.from("atendimentos").select("*", { count: "exact", head: true }),
        supabase.from("casos").select("*", { count: "exact", head: true }).eq("grau_risco", "critico"),
      ]);
      setStats({
        mulheres: m.count ?? 0,
        casos: c.count ?? 0,
        atendimentos: a.count ?? 0,
        criticos: cr.count ?? 0,
      });
    })();
  }, []);

  const cards = [
    { title: "Mulheres cadastradas", value: stats.mulheres, icon: Users, color: "text-blue-600" },
    { title: "Casos ativos", value: stats.casos, icon: FolderOpen, color: "text-amber-600" },
    { title: "Atendimentos", value: stats.atendimentos, icon: CalendarClock, color: "text-emerald-600" },
    { title: "Risco crítico", value: stats.criticos, icon: AlertTriangle, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Olá, {nomeCompleto?.split(" ")[0] ?? "Usuário"} 👋</h1>
        <p className="text-muted-foreground">
          Perfil: <span className="capitalize font-medium">{roles[0] ?? "—"}</span>
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bem-vindo(a) ao SIGEM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Esta é a fundação do sistema. Os módulos a seguir estão prontos para serem expandidos:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Cadastro de Mulheres (com isolamento por município)</li>
            <li>Gestão de Casos com graus de risco</li>
            <li>Atendimentos sociais, jurídicos e psicológicos</li>
            <li>Programas e Projetos sociais</li>
            <li>Relatórios e dashboards estratégicos</li>
            <li>Gestão de Municípios e Usuários (acesso restrito)</li>
          </ul>
          {roles.length === 0 && (
            <p className="mt-4 rounded-md border border-border bg-muted p-3 text-foreground">
              Sua conta ainda não tem permissões atribuídas. Solicite a um administrador.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
