import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { ModuleStub } from "@/components/ModuleStub";

export const Route = createFileRoute("/alertas")({
  component: () => (
    <ProtectedLayout>
      <ModuleStub
        title="Alertas e Notificações"
        description="Casos urgentes, prazos e reincidência"
        icon={Bell}
        features={["Casos urgentes (risco crítico)", "Prazos vencidos", "Detecção de reincidência"]}
      />
    </ProtectedLayout>
  ),
});
