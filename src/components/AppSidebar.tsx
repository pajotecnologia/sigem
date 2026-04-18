import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  CalendarClock,
  HeartHandshake,
  Building2,
  BarChart3,
  Bell,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Mulheres", url: "/mulheres", icon: Users },
  { title: "Casos", url: "/casos", icon: FolderOpen },
  { title: "Atendimentos", url: "/atendimentos", icon: CalendarClock },
  { title: "Programas", url: "/programas", icon: HeartHandshake },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Alertas", url: "/alertas", icon: Bell },
];

const adminItems = [
  { title: "Municípios", url: "/municipios", icon: Building2 },
  { title: "Usuários", url: "/usuarios", icon: ShieldCheck },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, nomeCompleto, roles, hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["master", "municipal"]);

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            S
          </div>
          <div>
            <h2 className="text-sm font-bold">SIGEM</h2>
            <p className="text-xs text-muted-foreground">Gestão da Mulher</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operacional</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="mb-2">
          <p className="text-sm font-medium truncate">{nomeCompleto ?? "Usuário"}</p>
          <p className="text-xs text-muted-foreground capitalize">{roles[0] ?? "—"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void signOut()} className="w-full">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
