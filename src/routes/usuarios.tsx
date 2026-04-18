import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { ModuleStub } from "@/components/ModuleStub";

export const Route = createFileRoute("/usuarios")({
  component: () => (
    <ProtectedLayout>
      <ModuleStub
        title="Usuários e Permissões"
        description="Controle hierárquico de acesso"
        icon={ShieldCheck}
        features={[
          "Master, Municipal, Operacional, Visualização",
          "Atribuição de município ao usuário",
          "Controle de acesso por módulo",
          "Logs de acesso e ações",
        ]}
      />
    </ProtectedLayout>
  ),
});
