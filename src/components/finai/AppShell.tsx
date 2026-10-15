import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bot, CreditCard, FileUp, LayoutDashboard, ListOrdered, Settings, Tags, Wallet } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useData } from "@/hooks/use-data";
import { setCurrency } from "@/lib/format";
import { UNLOCK_KEY } from "@/lib/security";
import { LockScreen } from "./LockScreen";
import { cn } from "@/lib/utils";

const NAV = [
  { title: "Painel", url: "/", icon: LayoutDashboard },
  { title: "Lançamentos", url: "/lancamentos", icon: ListOrdered },
  { title: "Assistente IA", url: "/assistente", icon: Bot },
  { title: "Contas e cartões", url: "/contas", icon: Wallet },
  { title: "Categorias", url: "/categorias", icon: Tags },
  { title: "Importar e conciliar", url: "/importar", icon: FileUp },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
] as const;

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
        <CreditCard className="h-4 w-4" />
      </div>
      <span className="font-display text-lg font-bold tracking-tight">
        Fin<span className="text-ai">AI</span>
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const data = useData();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setMounted(true);
    setUnlocked(sessionStorage.getItem(UNLOCK_KEY) === "1");
  }, []);

  const settings = data?.settings;
  useEffect(() => {
    const dark = (settings?.theme ?? "dark") === "dark";
    document.documentElement.classList.toggle("dark", dark);
    if (settings?.currency) setCurrency(settings.currency);
  }, [settings?.theme, settings?.currency]);

  useEffect(() => {
    if (!data) return;
    if (!data.settings?.onboarded && path !== "/onboarding") navigate({ to: "/onboarding" });
  }, [data, path, navigate]);

  if (!mounted || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Logo className="animate-pulse" />
      </div>
    );
  }
  if (path === "/onboarding" || !data.settings?.onboarded) return <>{children}</>;
  if (data.settings.pin_hash && !unlocked)
    return (
      <LockScreen
        settings={data.settings}
        onUnlock={() => {
          sessionStorage.setItem(UNLOCK_KEY, "1");
          setUnlocked(true);
        }}
      />
    );

  const isActive = (u: string) => (u === "/" ? path === "/" : path.startsWith(u));

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon" className="hidden md:flex">
          <SidebarHeader className="px-3 py-4">
            <Logo />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                        <Link to={item.url}>
                          <item.icon className={item.url === "/assistente" ? "text-ai" : undefined} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger className="hidden md:inline-flex" />
            <Logo className="md:hidden" />
            <div className="ml-auto flex items-center gap-1 md:hidden">
              <Link to="/categorias" className="rounded-lg p-2 text-muted-foreground" aria-label="Categorias">
                <Tags className="h-5 w-5" />
              </Link>
              <Link to="/importar" className="rounded-lg p-2 text-muted-foreground" aria-label="Importar">
                <FileUp className="h-5 w-5" />
              </Link>
            </div>
          </header>
          <main className="pb-safe mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:px-8 md:pb-10">{children}</main>
        </div>
        <BottomNav isActive={isActive} />
      </div>
    </SidebarProvider>
  );
}

function BottomNav({ isActive }: { isActive: (u: string) => boolean }) {
  const items = [
    { title: "Painel", url: "/", icon: LayoutDashboard },
    { title: "Lançamentos", url: "/lancamentos", icon: ListOrdered },
    { title: "IA", url: "/assistente", icon: Bot, center: true },
    { title: "Contas", url: "/contas", icon: Wallet },
    { title: "Ajustes", url: "/configuracoes", icon: Settings },
  ] as const;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
        {items.map((it) =>
          "center" in it ? (
            <Link key={it.url} to={it.url} className="flex flex-col items-center pb-2" aria-label="Assistente IA">
              <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-ai-gradient text-ai-foreground shadow-glow ring-4 ring-background">
                <it.icon className="h-6 w-6" />
              </span>
              <span className={cn("mt-1 text-[11px] font-medium", isActive(it.url) ? "text-ai" : "text-muted-foreground")}>{it.title}</span>
            </Link>
          ) : (
            <Link
              key={it.url}
              to={it.url}
              className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", isActive(it.url) ? "text-primary" : "text-muted-foreground")}
            >
              <it.icon className="h-5 w-5" />
              {it.title}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
