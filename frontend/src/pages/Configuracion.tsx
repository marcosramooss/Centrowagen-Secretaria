import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import SecretariaAvatar from "@/components/SecretariaAvatar";
import { DemoPill, PageHeader } from "@/components/bits";
import { useMode } from "@/components/ModeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, apiPut, apiPost } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { useMe } from "@/lib/session";
import type { SalesSettings, Stats, User } from "@/lib/types";

const SOURCES = [
  "Documentación interna de Centrowagen",
  "Volkswagen España",
  "Volkswagen Financial Services",
  "Tarifas oficiales",
  "Catálogos oficiales",
  "Fichas técnicas oficiales",
  "Campañas oficiales",
  "Bases de datos internas",
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-800/60 py-2 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-right text-sm font-medium text-slate-100">{value}</span>
    </div>
  );
}

export default function Configuracion() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { mode, setMode } = useMode();
  const isAdmin = me?.role === "admin";

  const stats = useQuery({ queryKey: ["stats"], queryFn: () => apiGet<Stats>("/stats"), retry: false });
  const users = useQuery({ queryKey: ["users"], queryFn: () => apiGet<User[]>("/auth/users"), retry: false });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => apiGet<SalesSettings>("/settings"), retry: false });

  const [rate, setRate] = useState("");
  const [target, setTarget] = useState("");

  useEffect(() => {
    if (settings.data) {
      setRate(String(settings.data.commission_rate));
      setTarget(String(settings.data.monthly_target));
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (body: { commission_rate: number; monthly_target: number }) => apiPut<SalesSettings>("/settings", body),
    onSuccess: () => {
      toast.success("Configuración guardada");
      void qc.invalidateQueries({ queryKey: ["settings"] });
      void qc.invalidateQueries({ queryKey: ["sales-summary"] });
    },
    onError: () => toast.error("No se pudo guardar (requiere perfil ADMIN)"),
  });

  const s = stats.data;
  const promote = useMutation({
    mutationFn: (id: string) => apiPost<User>(`/auth/users/${id}/promote`),
    onSuccess: () => { toast.success("Permisos de administrador actualizados"); void qc.invalidateQueries({ queryKey: ["users"] }); void qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: () => toast.error("No se pudieron actualizar los permisos"),
  });

  return (
    <div data-testid="configuracion-page">
      <PageHeader title="⚙️ Configuración" subtitle="Perfil, empresa, fuentes, base de datos, usuarios y apariencia." right={<DemoPill />} />

      <Tabs defaultValue="perfil" data-testid="configuracion-tabs">
        <TabsList variant="line" className="flex-wrap">
          <TabsTrigger value="perfil" data-testid="config-tab-perfil">Perfil</TabsTrigger>
          <TabsTrigger value="empresa" data-testid="config-tab-empresa">Empresa</TabsTrigger>
          <TabsTrigger value="comisiones" data-testid="config-tab-comisiones">Comisiones</TabsTrigger>
          <TabsTrigger value="fuentes" data-testid="config-tab-fuentes">Fuentes</TabsTrigger>
          <TabsTrigger value="datos" data-testid="config-tab-datos">Base de datos</TabsTrigger>
          <TabsTrigger value="usuarios" data-testid="config-tab-usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="integraciones" data-testid="config-tab-integraciones">Integraciones</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-4">
          <div className="glass-panel rounded-2xl p-5" data-testid="config-perfil">
            <div className="mb-4 flex items-center gap-4">
              <SecretariaAvatar size={64} />
              <div>
                <p className="text-base font-semibold text-white">{me?.name}</p>
                <p className="text-xs text-muted-foreground">{me?.email}</p>
                <span className="mt-1 inline-flex rounded-full border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                  {me?.role}
                </span>
              </div>
            </div>
            <Row label="Modo de respuesta activo" value={mode === "cliente" ? "👤 Modo cliente" : "👨‍💼 Modo vendedor"} />
            <div className="mt-4 flex gap-2">
              <Button
                variant={mode === "vendedor" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("vendedor")}
                data-testid="config-mode-vendedor"
              >
                👨‍💼 Modo vendedor
              </Button>
              <Button
                variant={mode === "cliente" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("cliente")}
                data-testid="config-mode-cliente"
              >
                👤 Modo cliente
              </Button>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              En modo cliente, SecretarIA redacta las respuestas para poder enviarse directamente al cliente, sin
              información interna ni notas privadas.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="empresa" className="mt-4">
          <div className="glass-panel rounded-2xl p-5" data-testid="config-empresa">
            <Row label="Concesionario" value="Centrowagen Don Benito" />
            <Row label="Marca" value="Volkswagen (concesionario oficial)" />
            <Row label="Ubicación" value="Don Benito (Badajoz), España" />
            <Row label="Puntos de venta en el sistema" value="Don Benito · Villanueva de la Serena" />
            <Row label="Asistente" value="SecretarIA — Tu asistente comercial Volkswagen" />
          </div>
        </TabsContent>

        <TabsContent value="comisiones" className="mt-4">
          <form
            className="glass-panel rounded-2xl p-5"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({ commission_rate: Number(rate || 0), monthly_target: Number(target || 0) });
            }}
            data-testid="config-comisiones"
          >
            <h3 className="mb-4 text-base font-semibold text-white">Comisiones y objetivos</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Comisión por venta (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  disabled={!isAdmin}
                  data-testid="config-commission-rate-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Objetivo mensual de facturación (€)</Label>
                <Input
                  type="number"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  disabled={!isAdmin}
                  data-testid="config-monthly-target-input"
                />
              </div>
            </div>
            <Button type="submit" className="mt-4" disabled={!isAdmin || save.isPending} data-testid="config-save-button">
              {save.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
            {!isAdmin && (
              <p className="mt-2 text-[11px] text-amber-300">
                Solo un perfil ADMIN puede modificar la tasa de comisión y los objetivos.
              </p>
            )}
          </form>
        </TabsContent>

        <TabsContent value="fuentes" className="mt-4">
          <div className="glass-panel rounded-2xl p-5" data-testid="config-fuentes">
            <h3 className="mb-1 text-base font-semibold text-white">Prioridad de fuentes</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              SecretarIA consulta las fuentes en este orden y siempre muestra la procedencia y la fecha del dato.
            </p>
            <ol className="space-y-2">
              {SOURCES.map((src, i) => (
                <li key={src} className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600/30 text-xs font-bold text-sky-300">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-200">{src}</span>
                </li>
              ))}
            </ol>
          </div>
        </TabsContent>

        <TabsContent value="datos" className="mt-4">
          <div className="glass-panel rounded-2xl p-5" data-testid="config-datos">
            <h3 className="mb-4 text-base font-semibold text-white">Estado de la base de datos</h3>
            <Row label="Vehículos" value={s?.vehicles ?? "—"} />
            <Row label="Unidades de stock" value={s?.stock_units ?? "—"} />
            <Row label="Tarifas" value={s?.prices ?? "—"} />
            <Row label="Planes de financiación" value={s?.financing_offers ?? "—"} />
            <Row label="Promociones vigentes" value={s?.active_promotions ?? "—"} />
            <Row label="Documentos" value={s?.documents ?? "—"} />
            <Row label="FAQ" value={s?.faq_items ?? "—"} />
            <Row label="Registros en memoria" value={s?.memory_items ?? "—"} />
            <Row label="Ventas registradas" value={s?.sales ?? "—"} />
            <Row label="Última sinc. de stock" value={s?.last_sync?.stock ? fmtDateTime(s.last_sync.stock) : "—"} />
            <Row label="Última sinc. de precios" value={s?.last_sync?.prices ? fmtDateTime(s.last_sync.prices) : "—"} />
            <Row
              label="Origen de los datos"
              value={<span className="text-slate-300" data-testid="config-data-origin">Fuentes oficiales y archivos del concesionario; revisión por registro</span>}
            />
          </div>
        </TabsContent>

        <TabsContent value="usuarios" className="mt-4">
          <div className="glass-panel rounded-2xl p-5" data-testid="config-usuarios">
            <h3 className="mb-4 text-base font-semibold text-white">Usuarios y permisos</h3>
            <div className="space-y-2">
              {(users.data ?? []).map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3"
                  data-testid={`config-user-${u.id}`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-100">{u.name}</p>
                    <p className="text-[11px] text-muted-foreground">{u.email}</p>
                  </div>
                  <span
                    data-testid={`config-user-role-${u.id}`}
                    className={
                      u.role === "admin"
                        ? "rounded-full border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300"
                        : "rounded-full border border-slate-500/40 bg-slate-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300"
                    }
                  >
                    {u.role}
                  </span>
                  {isAdmin && u.role !== "admin" && <Button variant="outline" size="sm" disabled={promote.isPending} onClick={() => { if (window.confirm(`¿Dar permisos de ADMIN a ${u.email}?`)) promote.mutate(u.id); }} data-testid={`config-user-promote-${u.id}`}>Hacer administrador</Button>}
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
                <p className="font-semibold text-sky-300">ADMIN puede</p>
                <ul className="mt-1.5 space-y-1 text-slate-300">
                  <li>• Subir documentos y gestionar fuentes</li>
                  <li>• Modificar vehículos, stock, precios y promociones</li>
                  <li>• Gestionar memoria y usuarios</li>
                  <li>• Configurar comisiones y objetivos</li>
                </ul>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
                <p className="font-semibold text-slate-300">VENDEDOR puede</p>
                <ul className="mt-1.5 space-y-1 text-slate-300">
                  <li>• Consultar y buscar toda la información</li>
                  <li>• Usar el asistente IA y el comparador</li>
                  <li>• Generar mensajes para clientes</li>
                  <li>• Registrar sus propias ventas</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="integraciones" className="mt-4">
          <div className="glass-panel rounded-2xl p-5" data-testid="config-integraciones">
            <h3 className="mb-4 text-base font-semibold text-white">Integraciones activas</h3>
            <div className="space-y-2">
              <Integration name="Consulta local" detail="Búsqueda en catálogo y archivos del proyecto, sin IA generativa ni créditos de IA" ok />
              <Integration name="Chats externos" detail="Enlaces a Copilot, Gemini y ChatGPT cuando faltan datos. Sin API ni transferencia automática; sujetos a límites del proveedor" ok />
              <Integration name="IA generativa integrada" detail="Desactivada por elección: no se usan claves de Google, Anthropic, OpenAI ni Emergent para el chat" />
              <Integration name="Resend (email gestionado)" detail="Pendiente de recuperar su configuración. El envío de mensajes no está activado" />
              <Integration name="Google Sign-In (Emergent)" detail="Acceso con cuenta de Google — los nuevos accesos entran con perfil VENDEDOR" ok />
              <Integration name="Almacenamiento de archivos y medios" detail="Documentos y archivos guardados en almacenamiento duradero (sobrevive a los despliegues)" ok />
              <Integration name="Importación de tarifas Excel/CSV" detail="Sube la tarifa oficial y actualiza precios y stock con confirmación previa" ok />
              <Integration name="Lectura de PDF para el RAG" detail="El texto de catálogos y circulares en PDF se indexa para poder citarlo" ok />
              <Integration name="Sincronización de stock VW" detail="Pendiente de conectar con la fuente oficial del concesionario" />
              <Integration name="Tarifas oficiales automáticas" detail="Pendiente de conectar con Volkswagen España" />
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground">
              La arquitectura está preparada para añadir nuevas fuentes de datos, concesionarios y usuarios sin
              reconstruir el proyecto.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Integration({ name, detail, ok = false }: { name: string; detail: string; ok?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-100">{name}</p>
        <p className="text-[11px] text-muted-foreground">{detail}</p>
      </div>
      <span
        className={
          ok
            ? "rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
            : "rounded-full border border-slate-500/40 bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-400"
        }
      >
        {ok ? "🟢 Conectada" : "⚪ Pendiente"}
      </span>
    </div>
  );
}
