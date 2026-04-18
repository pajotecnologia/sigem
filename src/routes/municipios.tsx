import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { ModuleStub } from "@/components/ModuleStub";

export const Route = createFileRoute("/municipios")({
  component: () => (
    <ProtectedLayout>
      <ModuleStub
        title="Municípios"
        description="Gestão de municípios da Secretaria"
        icon={Building2}
        features={[
          "Cadastro e edição de municípios",
          "Associação de usuários",
          "Relatórios por município",
        ]}
      />
    </ProtectedLayout>
  ),
});
