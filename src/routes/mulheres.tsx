import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { ModuleStub } from "@/components/ModuleStub";

export const Route = createFileRoute("/mulheres")({
  component: () => (
    <ProtectedLayout>
      <ModuleStub
        title="Cadastro de Mulheres"
        description="Gestão completa do cadastro com isolamento por município"
        icon={Users}
        features={[
          "Dados pessoais (nome, CPF, nascimento)",
          "Endereço com preenchimento automático por CEP",
          "Escolaridade, renda e situação social",
          "Upload de documentos",
          "Histórico completo de atendimentos",
        ]}
      />
    </ProtectedLayout>
  ),
});
