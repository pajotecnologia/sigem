import { createFileRoute } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { ModuleStub } from "@/components/ModuleStub";

export const Route = createFileRoute("/programas")({
  component: () => (
    <ProtectedLayout>
      <ModuleStub
        title="Programas e Projetos"
        description="Programas sociais e participantes"
        icon={HeartHandshake}
        features={[
          "Cadastro de programas sociais",
          "Vinculação de mulheres",
          "Controle de participação",
          "Indicadores de resultados",
        ]}
      />
    </ProtectedLayout>
  ),
});
