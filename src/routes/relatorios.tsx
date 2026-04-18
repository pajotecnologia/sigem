import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { ModuleStub } from "@/components/ModuleStub";

export const Route = createFileRoute("/relatorios")({
  component: () => (
    <ProtectedLayout>
      <ModuleStub
        title="Relatórios e Dashboard"
        description="Indicadores estratégicos e exportação"
        icon={BarChart3}
        features={[
          "Casos ativos por período",
          "Tipos de ocorrência",
          "Dados por município",
          "Filtros avançados",
          "Exportação PDF e Excel",
        ]}
      />
    </ProtectedLayout>
  ),
});
