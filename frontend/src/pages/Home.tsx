import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BadgePercent, Brain, Calculator, Car, FileText, HelpCircle, Sparkles, Tag, Warehouse,
} from "lucide-react";

import SecretariaAvatar from "@/components/SecretariaAvatar";
import { DemoPill, PageHeader, PromoBadge } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { eur, fmtDate, fmtDateTime } from "@/lib/format";
import { useMe } from "@/lib/session";
import type { Promotion, Stats, StockUnit } from "@/lib/types";
import type { TaskSummary } from "@/lib/types2";

const CHIPS = [
  "Busca T-Roc en stock",
  "Precio Tiguan R-Line",
  "Compara Golf y T-Roc",
  "Promociones actuales",
  "Prepárame un WhatsApp",
];

export default function Home() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => apiGet<Stats>("/stats"), retry: false });
  const stock = useQuery({
    queryKey: ["stock", { availability: "Entrega inmediata" }],
    queryFn: () => apiGet<StockUnit[]>("/stock?availability=Entrega%20inmediata"),
    retry: false,
  });
  const promos = useQuery({ queryKey: ["promotions"], queryFn: () => apiGet<Promotion[]>("/promotions"), retry: false });
  const tasks = useQuery({ queryKey: ["tasks-summary"], queryFn: () => apiGet<TaskSummary>("/tasks/summary"), retry: false });

  const s = stats.data;
  const cards = [
    { to: "/vehiculos", icon: Car, title: "Vehículos", metric: s ? `${s.vehicles} versiones` : "—", sub: "Catálogo gama Volkswagen" },
    { to: "/stock", icon: Warehouse, title: "Stock", metric: s ? `${s.stock_units} unidades` : "—", sub: s ? `${s.stock_immediate} con entrega inmediata` : "Unidades del punto de venta" },
    { to: "/precios", icon: Tag, title: "Precios", metric: s ? `${s.prices} tarifas` : "—", sub: "PVP, promocional y financiado" },
    { to: "/financiacion", icon: Calculator, title: "Financiación", metric: s ? `${s.financing_offers} planes` : "—", sub: "Volkswagen Financial Services" },
    { to: "/promociones", icon: Sparkles, title: "Promociones", metric: s ? `${s.active_promotions} vigentes` : "—", sub: "Campañas oficiales y de concesionario" },
    { to: "/documentos", icon: FileText, title: "Documentos", metric: s ? `${s.documents} archivos` : "—", sub: "Base documental para el RAG" },
    { to: "/memoria", icon: Brain, title: "Memoria", metric: s ? `${s.memory_items} registros` : "—", sub: "Lo que SecretarIA ha aprendido" },
    { to: "/faq", icon: HelpCircle, title: "FAQ", metric: s ? `${s.faq_items} respuestas` : "—", sub: "Base de conocimiento comercial" },
  ];

  function ask(text: string) {
    navigate(`/asistente?q=${encodeURIComponent(text)}`);
  }

  const activePromos = (promos.data ?? []).filter((p) => p.status === "activa" || p.status === "proxima").slice(0, 3);

  return (
    <div data-testid="home-page">
      <PageHeader
        title={`Hola, ${me?.name ?? "equipo"} 👋`}
        subtitle="Centro de información comercial de Centrowagen Don Benito — todos los datos con fuente y fecha."
        right={<DemoPill />}
      />

      {/* Chat entry */}
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-8" data-testid="home-chat-hero">
        <div className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full bg-sky-600/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
          <SecretariaAvatar size={84} pulse />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight text-white md:text-2xl">¿En qué puedo ayudarte?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pregúntame por stock, precios, promociones, financiación o pídeme un mensaje para un cliente.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => ask(c)}
                  className="rounded-full border border-slate-700/60 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition-colors duration-200 hover:border-sky-500/50 hover:text-white"
                  data-testid={`home-chip-${c.split(" ")[0].toLowerCase()}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <Link to="/asistente" className="shrink-0">
            <Button className="glow-accent w-full md:w-auto" data-testid="home-open-assistant-button">
              Abrir asistente
            </Button>
          </Link>
        </div>
      </section>

      {/* System status */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="home-system-status">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <p className="text-sm font-medium text-slate-200">Sistema operativo</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Base de datos y asistente IA conectados</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Última sinc. de stock</p>
          <p className="mt-1 text-sm font-medium text-slate-100" data-testid="home-stock-sync">
            {s?.last_sync?.stock ? fmtDateTime(s.last_sync.stock) : "—"}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Última sinc. de precios</p>
          <p className="mt-1 text-sm font-medium text-slate-100" data-testid="home-price-sync">
            {s?.last_sync?.prices ? fmtDateTime(s.last_sync.prices) : "—"}
          </p>
        </div>
        <Link to="/ventas" className="glass-card rounded-2xl p-4" data-testid="home-sales-card">
          <div className="flex items-center gap-2">
            <BadgePercent className="h-4 w-4 text-sky-400" />
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Ventas registradas</p>
          </div>
          <p className="mt-1 text-lg font-semibold text-white">{s ? s.sales : "—"}</p>
        </Link>
      </section>

      {/* Reminders */}
      <section className="mt-6" data-testid="home-reminders">
        <div className="glass-panel rounded-2xl p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-white">🔔 Seguimiento del día</h3>
            <Link to="/tareas" className="text-xs text-sky-400 hover:underline" data-testid="home-view-all-tasks">
              Ver todos los recordatorios
            </Link>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                (tasks.data?.overdue ?? 0) > 0
                  ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                  : "border-slate-700/60 bg-slate-900/60 text-slate-400"
              }`}
              data-testid="home-tasks-overdue"
            >
              {tasks.data?.overdue ?? 0} vencidas
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                (tasks.data?.today ?? 0) > 0
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                  : "border-slate-700/60 bg-slate-900/60 text-slate-400"
              }`}
              data-testid="home-tasks-today"
            >
              {tasks.data?.today ?? 0} para hoy
            </span>
            <span className="rounded-full border border-slate-700/60 bg-slate-900/60 px-3 py-1 text-xs text-slate-400">
              {tasks.data?.upcoming ?? 0} próximos 7 días
            </span>
          </div>

          {(tasks.data?.next_tasks ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin recordatorios pendientes. Crea uno para no perder ningún seguimiento.
            </p>
          ) : (
            <div className="space-y-2">
              {(tasks.data?.next_tasks ?? []).map((t) => (
                <Link
                  key={t.id}
                  to="/tareas"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2 transition-colors duration-200 hover:border-sky-500/40"
                  data-testid={`home-task-${t.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{t.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {t.kind}
                      {t.client_name ? ` · ${t.client_name}` : ""}
                      {t.vehicle_model ? ` · ${t.vehicle_model}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {fmtDate(t.due_date)}
                    {t.due_time ? ` · ${t.due_time}` : ""}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Section cards */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="home-section-cards">
        {cards.map(({ to, icon: Icon, title, metric, sub }) => (
          <Link key={to} to={to} className="glass-card rounded-2xl p-5" data-testid={`home-card-${to.slice(1)}`}>
            <Icon className="h-5 w-5 text-sky-400" />
            <p className="mt-3 text-sm font-medium text-slate-300">{title}</p>
            <p className="mt-0.5 text-xl font-bold tracking-tight text-white">{metric}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </Link>
        ))}
      </section>

      {/* Immediate delivery + promos */}
      <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass-panel rounded-2xl p-5" data-testid="home-immediate-stock">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-white">📦 Entrega inmediata</h3>
            <Link to="/stock" className="text-xs text-sky-400 hover:underline" data-testid="home-view-all-stock">
              Ver todo el stock
            </Link>
          </div>
          {stock.isError ? (
            <p className="text-sm text-muted-foreground">No se ha podido cargar el stock ahora mismo.</p>
          ) : (stock.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin unidades con entrega inmediata registradas.</p>
          ) : (
            <div className="space-y-2">
              {(stock.data ?? []).slice(0, 5).map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2"
                  data-testid={`home-stock-row-${u.stock_number}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {u.model} {u.trim}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      Nº {u.stock_number} · {u.exterior_color} · {u.transmission}
                    </p>
                  </div>
                  <p className="text-price text-sm">{eur(u.promotional_price ?? u.pvp)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-5" data-testid="home-active-promos">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-white">🔥 Promociones</h3>
            <Link to="/promociones" className="text-xs text-sky-400 hover:underline" data-testid="home-view-all-promos">
              Ver todas
            </Link>
          </div>
          {activePromos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin campañas vigentes registradas.</p>
          ) : (
            <div className="space-y-2">
              {activePromos.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3" data-testid={`home-promo-${p.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-100">{p.name}</p>
                    <PromoBadge status={p.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.model} · {p.discount ?? "—"} · hasta {fmtDate(p.valid_until)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <p className="mt-6 text-xs text-muted-foreground" data-testid="home-disclaimer">
        ⚠️ Todos los importes mostrados son DATOS DE DEMOSTRACIÓN. Verifica cualquier condición con la documentación
        oficial antes de presentarla como oferta definitiva al cliente.
      </p>
    </div>
  );
}
