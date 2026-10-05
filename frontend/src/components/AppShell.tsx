import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BadgePercent, BookOpen, Bot, Brain, Calculator, Car, Columns3, FileText,
  HelpCircle, LayoutDashboard, LogOut, Mail, Menu, RefreshCw, Settings, ShieldCheck,
  Sparkles, Tag, Warehouse, X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import SecretariaAvatar from "@/components/SecretariaAvatar";
import { DemoPill } from "@/components/bits";
import { useMode } from "@/components/ModeContext";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { endSession, useMe } from "@/lib/session";
import type { Stats } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Inicio", icon: LayoutDashboard },
  { to: "/asistente", label: "Asistente IA", icon: Bot, badge: "IA" },
  { to: "/vehiculos", label: "Vehículos VW", icon: Car },
  { to: "/stock", label: "Stock en vivo", icon: Warehouse },
  { to: "/precios", label: "Precios & Tarifas", icon: Tag },
  { to: "/financiacion", label: "Financiación", icon: Calculator },
  { to: "/promociones", label: "Promociones", icon: Sparkles },
  { to: "/comparador", label: "Comparador", icon: Columns3 },
  { to: "/documentos", label: "Documentos", icon: FileText },
  { to: "/faq", label: "FAQ", icon: HelpCircle },
  { to: "/argumentario", label: "Argumentario", icon: BookOpen },
  { to: "/memoria", label: "Memoria IA", icon: Brain },
  { to: "/auditoria", label: "Auditoría", icon: ShieldCheck },
  { to: "/cliente", label: "Respuesta a cliente", icon: Mail },
  { to: "/ventas", label: "Ventas & Comisiones", icon: BadgePercent },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];

export default function AppShell() {
  const { data: me } = useMe();
  const { mode, setMode } = useMode();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: () => apiGet<Stats>("/stats"), retry: false });

  const lastSync = stats?.last_sync?.stock ?? stats?.last_sync?.prices ?? null;

  return (
    <div className="min-h-svh">
      <div className="bg-aurora" aria-hidden />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[262px] flex-col border-r border-slate-800/60 bg-slate-950/80 backdrop-blur-2xl transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        data-testid="app-sidebar"
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <SecretariaAvatar size={44} />
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight text-white">SecretarIA</p>
            <p className="truncate text-[11px] text-muted-foreground">Centrowagen Don Benito</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto lg:hidden"
            onClick={() => setOpen(false)}
            data-testid="sidebar-close-button"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {NAV.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-200",
                  isActive
                    ? "bg-sky-600/18 font-medium text-sky-300"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100",
                )
              }
              data-testid={`nav-${to === "/" ? "inicio" : to.slice(1)}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
              {badge && (
                <span className="ml-auto rounded-full bg-sky-600/30 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-slate-300">Sistema operativo</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground" data-testid="sidebar-last-sync">
            Última sinc.: {lastSync ? fmtDateTime(lastSync) : "—"}
          </p>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      {/* Main */}
      <div className="lg:pl-[262px]">
        <header
          className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-slate-800/60 bg-slate-950/70 px-4 py-3 backdrop-blur-xl md:px-6"
          data-testid="app-header"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            data-testid="sidebar-open-button"
            aria-label="Abrir menú"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <DemoPill className="hidden sm:inline-flex" />

          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <div className="hidden items-center gap-1.5 text-xs text-slate-400 md:flex" data-testid="sync-indicator">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{lastSync ? fmtDateTime(lastSync) : "Sin sincronizar"}</span>
            </div>

            <div
              className="flex items-center gap-0.5 rounded-full border border-slate-700/60 bg-slate-900/70 p-0.5"
              data-testid="mode-toggle-switch"
            >
              <button
                type="button"
                onClick={() => setMode("vendedor")}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200",
                  mode === "vendedor" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-slate-200",
                )}
                data-testid="mode-vendedor-button"
              >
                👨‍💼 Vendedor
              </button>
              <button
                type="button"
                onClick={() => setMode("cliente")}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200",
                  mode === "cliente" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-slate-200",
                )}
                data-testid="mode-cliente-button"
              >
                👤 Cliente
              </button>
            </div>

            <div className="hidden text-right sm:block" data-testid="user-profile">
              <p className="text-xs font-medium text-slate-200">{me?.name ?? "—"}</p>
              <p className="text-[10px] uppercase tracking-wider text-sky-400">{me?.role ?? ""}</p>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void endSession().then(() => window.location.assign("/login"))}
              data-testid="logout-button"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main key={location.pathname} className="animate-fade-up px-4 py-6 md:px-6 lg:px-8" data-testid="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
