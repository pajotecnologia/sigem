import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { ModuleStub } from "@/components/ModuleStub";

export const Route = createFileRoute("/atendimentos")({
  component: () => (
    <ProtectedLayout>
      <ModuleStub
        title="Atendimentos"
        description="Registro e agendamento de atendimentos multidisciplinares"
        icon={CalendarClock}
        features={[
          "Tipos: social, jurídico, psicológico, médico",
          "Profissional responsável",
          "Data, hora e observações",
          "Agendamento com calendário",
        ]}
      />
    </ProtectedLayout>
  ),
});
