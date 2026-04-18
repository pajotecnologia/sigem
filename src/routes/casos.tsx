import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen } from "lucide-react";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { ModuleStub } from "@/components/ModuleStub";

export const Route = createFileRoute("/casos")({
  component: () => (
    <ProtectedLayout>
      <ModuleStub
        title="Gestão de Casos"
        description="Acompanhamento de ocorrências e níveis de risco"
        icon={FolderOpen}
        features={[
          "Tipos: violência doméstica, vulnerabilidade etc.",
          "Grau de risco (baixo, médio, alto, crítico)",
          "Status: aberto, em acompanhamento, encerrado",
          "Linha do tempo do caso",
          "Vínculo com a mulher cadastrada",
        ]}
      />
    </ProtectedLayout>
  ),
});
