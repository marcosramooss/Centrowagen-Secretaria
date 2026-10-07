import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileDown } from "lucide-react";

import { AvailabilityBadge, DemoPill, PromoBadge, StaleWarning } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet } from "@/lib/api";
import { eur, eur2, fmtDate } from "@/lib/format";
import type { VehicleDetail } from "@/lib/types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-800/60 py-2 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-right text-sm font-medium text-slate-100">{value}</span>
    </div>
  );
}

export default function VehiculoDetalle() {
  const { id } = useParams<{ id: string }>();
  const [offerClient, setOfferClient] = useState("");
  const { data, isError, isPending } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => apiGet<VehicleDetail>(`/vehicles/${id}`),
    retry: false,
    enabled: Boolean(id),
  });

  const v = data?.vehicle;
  const price = data?.price ?? null;
  const shown = price?.promotional_price ?? price?.base_price ?? null;
  const bestFin = (data?.financing ?? []).slice().sort((a, b) => a.monthly_payment - b.monthly_payment)[0] ?? null;
  const livePromos = (data?.promotions ?? []).filter((p) => p.status !== "finalizada");

  return (
    <div data-testid="vehiculo-detalle-page">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/vehiculos">
          <Button variant="ghost" size="sm" className="gap-2" data-testid="vehicle-back-button">
            <ArrowLeft className="h-4 w-4" /> Volver al catálogo
          </Button>
        </Link>
        <DemoPill />
      </div>

      {isError ? (
        <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
          No se ha podido cargar la ficha de este vehículo.
        </div>
      ) : isPending ? (
        <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">Cargando ficha…</div>
      ) : !v ? null : (
        <>
          {/* Hero */}
          {v.verification_status !== "verified" && <p className="mb-4 rounded-xl border border-amber-800/60 bg-amber-950/20 p-4 text-sm text-amber-200" data-testid="vehicle-pending-verification">Datos del concesionario pendientes de verificación comercial. No presentar como oferta confirmada.</p>}
          <section className="glass-panel overflow-hidden rounded-3xl" data-testid="vehicle-hero">
            <div className="grid lg:grid-cols-[1.25fr_1fr]">
              <div className="relative aspect-[16/10] bg-slate-900 lg:aspect-auto lg:min-h-[320px]">
                {v.image && <img src={v.image} alt={`${v.model} ${v.trim}`} className="h-full w-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-950/70" aria-hidden />
              </div>
              <div className="p-6 md:p-8">
                <p className="text-[11px] uppercase tracking-wider text-sky-400">{v.brand} · {v.body_type}</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">{v.model}</h1>
                <p className="text-base text-slate-300">{v.trim} · {v.engine}</p>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-300">
                  <span>🚗 {v.power_cv ?? "—"} CV</span>
                  <span>⚙️ {v.transmission ?? "—"}</span>
                  <span>⛽ {v.fuel}</span>
                  {v.electric_range_km && <span>🔋 {v.electric_range_km} km</span>}
                  {v.trunk_l && <span>🧳 {v.trunk_l} l</span>}
                </div>

                <div className="mt-6 flex flex-wrap items-end gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">
                      {price?.promotional_price ? "Precio promocional" : "PVP"}
                    </p>
                    <p className="text-price text-3xl" data-testid="vehicle-price">{eur(shown)}</p>
                  </div>
                  {price?.promotional_price && price.base_price > price.promotional_price && (
                    <p className="pb-1 text-sm text-slate-500 line-through">{eur(price.base_price)}</p>
                  )}
                  {bestFin && (
                    <div className="pb-0.5">
                      <p className="text-[11px] uppercase tracking-wider text-slate-500">Financiación desde</p>
                      <p className="text-lg font-semibold text-sky-300" data-testid="vehicle-monthly">
                        {eur2(bestFin.monthly_payment)}/mes
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="truncate text-[11px] text-slate-500">
                    📚 {price?.source ?? v.source} · 📅 {fmtDate(price?.last_updated ?? v.last_updated)}
                  </span>
                  <StaleWarning lastUpdated={price?.last_updated ?? v.last_updated} />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to={`/cliente?model=${encodeURIComponent(`${v.model} ${v.trim}`)}`}>
                    <Button className="glow-accent gap-2" data-testid="vehicle-client-message-button">
                      ✉️ Crear respuesta para cliente
                    </Button>
                  </Link>
                  <a
                    href={`/api/offers/${v.id}/pdf?client_name=${encodeURIComponent(offerClient)}${
                      data?.stock[0]?.stock_number ? `&stock_number=${encodeURIComponent(data.stock[0].stock_number)}` : ""
                    }`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="gap-2" data-testid="vehicle-offer-pdf-button">
                      <FileDown className="h-4 w-4" /> Oferta en PDF
                    </Button>
                  </a>
                  <Link to="/comparador">
                    <Button variant="outline" data-testid="vehicle-compare-button">📊 Comparar</Button>
                  </Link>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input
                    value={offerClient}
                    onChange={(e) => setOfferClient(e.target.value)}
                    placeholder="Nombre del cliente para la oferta PDF"
                    className="h-9 max-w-xs text-sm"
                    data-testid="vehicle-offer-client-input"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Se imprime con tu nombre, la fecha y el aviso de condiciones.
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Detail tabs */}
          <Tabs defaultValue="resumen" className="mt-6" data-testid="vehicle-tabs">
            <TabsList variant="line" className="flex-wrap">
              <TabsTrigger value="resumen" data-testid="vehicle-tab-resumen">Resumen</TabsTrigger>
              <TabsTrigger value="equipamiento" data-testid="vehicle-tab-equipamiento">Equipamiento</TabsTrigger>
              <TabsTrigger value="tecnico" data-testid="vehicle-tab-tecnico">Datos técnicos</TabsTrigger>
              <TabsTrigger value="stock" data-testid="vehicle-tab-stock">Stock ({data?.stock.length ?? 0})</TabsTrigger>
              <TabsTrigger value="financiacion" data-testid="vehicle-tab-financiacion">Financiación</TabsTrigger>
              <TabsTrigger value="argumentario" data-testid="vehicle-tab-argumentario">Argumentario</TabsTrigger>
              <TabsTrigger value="faq" data-testid="vehicle-tab-faq">FAQ</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="mt-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="glass-panel rounded-2xl p-5">
                  <h3 className="mb-3 text-base font-semibold text-white">Resumen y precio</h3>
                  <Row label="Modelo" value={`${v.brand} ${v.model} ${v.trim}`} />
                  <Row label="Generación" value={v.generation ?? "—"} />
                  <Row label="Carrocería" value={v.body_type} />
                  <Row label="Motor" value={v.engine ?? "—"} />
                  <Row label="PVP" value={<span className="text-price">{eur(price?.base_price)}</span>} />
                  <Row label="Precio promocional" value={price?.promotional_price ? <span className="text-price">{eur(price.promotional_price)}</span> : "⚠️ No disponible"} />
                  <Row label="Precio con financiación" value={price?.financing_price ? <span className="text-price">{eur(price.financing_price)}</span> : "⚠️ No disponible"} />
                  <Row label="Campaña" value={price?.campaign ?? "—"} />
                  <Row label="Vigencia tarifa" value={price ? `${fmtDate(price.valid_from)} → ${fmtDate(price.valid_until)}` : "—"} />
                </div>

                <div className="glass-panel rounded-2xl p-5">
                  <h3 className="mb-3 text-base font-semibold text-white">🔥 Promociones aplicables</h3>
                  {livePromos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      ⚠️ No tengo promociones vigentes confirmadas para este modelo.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {livePromos.map((p) => (
                        <div key={p.id} className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3" data-testid={`vehicle-promo-${p.id}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-slate-100">{p.name}</p>
                            <PromoBadge status={p.status} />
                          </div>
                          <p className="mt-1 text-xs text-slate-300">{p.description}</p>
                          <p className="mt-1.5 text-xs text-emerald-300">Descuento: {p.discount ?? "—"}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Hasta {fmtDate(p.valid_until)} · {p.financing_required ? "Requiere financiación" : "Sin financiación obligatoria"}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">📚 {p.source} · 📅 {fmtDate(p.last_updated)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="equipamiento" className="mt-4">
              <div className="glass-panel rounded-2xl p-5">
                <h3 className="mb-3 text-base font-semibold text-white">Equipamiento de esta versión</h3>
                {v.equipment.length === 0 ? (
                  <p className="text-sm text-muted-foreground">⚠️ No tengo el equipamiento confirmado para esta versión.</p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {v.equipment.map((e) => (
                      <li key={e} className="flex items-start gap-2 text-sm text-slate-200">
                        <span className="mt-0.5 text-emerald-400">✓</span> {e}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tecnico" className="mt-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="glass-panel rounded-2xl p-5">
                  <h3 className="mb-3 text-base font-semibold text-white">Motor y prestaciones</h3>
                  <Row label="Motor" value={v.engine ?? "—"} />
                  <Row label="Potencia" value={v.power_cv ? `${v.power_cv} CV` : "—"} />
                  <Row label="Cambio" value={v.transmission ?? "—"} />
                  <Row label="Tracción" value={v.drivetrain ?? "—"} />
                  <Row
                    label="Consumo"
                    value={v.consumption ? `${v.consumption} ${v.fuel === "Eléctrico" ? "kWh/100 km" : "l/100 km"}` : "—"}
                  />
                  <Row label="Emisiones CO₂" value={v.co2_g != null ? `${v.co2_g} g/km` : "—"} />
                  {v.electric_range_km && <Row label="Autonomía eléctrica" value={`${v.electric_range_km} km`} />}
                  {Object.entries(v.technical_data).map(([k, val]) => (
                    <Row key={k} label={k} value={String(val)} />
                  ))}
                </div>
                <div className="glass-panel rounded-2xl p-5">
                  <h3 className="mb-3 text-base font-semibold text-white">Dimensiones y capacidad</h3>
                  <Row label="Largo" value={v.dimensions?.length_mm ? `${v.dimensions.length_mm} mm` : "—"} />
                  <Row label="Ancho" value={v.dimensions?.width_mm ? `${v.dimensions.width_mm} mm` : "—"} />
                  <Row label="Alto" value={v.dimensions?.height_mm ? `${v.dimensions.height_mm} mm` : "—"} />
                  <Row label="Distancia entre ejes" value={v.dimensions?.wheelbase_mm ? `${v.dimensions.wheelbase_mm} mm` : "—"} />
                  <Row label="Maletero" value={v.trunk_l ? `${v.trunk_l} l` : "—"} />
                  <Row label="Plazas" value={v.seats ?? "—"} />
                  <Row label="Fuente" value={v.source} />
                  <Row label="Actualizado" value={fmtDate(v.last_updated)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="stock" className="mt-4">
              <div className="glass-panel rounded-2xl p-5">
                <h3 className="mb-3 text-base font-semibold text-white">📦 Unidades de esta versión</h3>
                {(data?.stock ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    ⚠️ No hay unidades registradas de esta versión en el stock actual.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data?.stock.map((u) => (
                      <div
                        key={u.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3"
                        data-testid={`vehicle-stock-${u.stock_number}`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-100">Nº {u.stock_number} · {u.exterior_color}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {u.transmission} · {u.location} · Entrega: {u.delivery_estimate ?? "—"}
                            {u.options.length > 0 && ` · ${u.options.join(", ")}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-price text-sm">{eur(u.promotional_price ?? u.pvp)}</p>
                          <AvailabilityBadge value={u.availability} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="financiacion" className="mt-4">
              <div className="glass-panel rounded-2xl p-5">
                <h3 className="mb-1 text-base font-semibold text-white">💳 Planes de financiación</h3>
                <p className="mb-4 text-xs text-amber-300">
                  ⚠️ Las condiciones mostradas corresponden a la información disponible y deben verificarse antes de
                  presentarlas como oferta definitiva al cliente.
                </p>
                {(data?.financing ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">⚠️ No tengo planes de financiación confirmados.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {data?.financing.map((f) => (
                      <div key={f.id} className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4" data-testid={`vehicle-financing-${f.id}`}>
                        <p className="text-sm font-semibold text-slate-100">{f.campaign}</p>
                        <p className="mt-2 text-2xl font-semibold text-sky-300">{eur2(f.monthly_payment)}<span className="text-sm text-slate-400">/mes</span></p>
                        <div className="mt-2">
                          <Row label="Entrada" value={eur(f.entry_payment)} />
                          <Row label="Nº de cuotas" value={f.number_of_payments} />
                          <Row label="Última cuota" value={f.final_payment ? eur(f.final_payment) : "—"} />
                          <Row label="TIN / TAE" value={`${f.tin}% / ${f.tae}%`} />
                          <Row label="Importe financiado" value={f.financed_amount ? eur(f.financed_amount) : "—"} />
                          <Row label="Total adeudado" value={f.total_amount ? eur(f.total_amount) : "—"} />
                          <Row label="Vigencia" value={`${fmtDate(f.valid_from)} → ${fmtDate(f.valid_until)}`} />
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">{f.conditions}</p>
                        <p className="mt-1 text-[10px] text-slate-500">📚 {f.source} · 📅 {fmtDate(f.last_updated)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="argumentario" className="mt-4">
              <div className="glass-panel rounded-2xl p-5">
                <h3 className="mb-3 text-base font-semibold text-white">🎯 Argumentario de venta</h3>
                {!data?.argumentario ? (
                  <p className="text-sm text-muted-foreground">⚠️ No hay argumentario registrado para este modelo.</p>
                ) : (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-sky-300">Puntos fuertes</h4>
                      <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
                        {data.argumentario.strong_points.map((p) => (
                          <li key={p} className="flex gap-2"><span className="text-emerald-400">✓</span>{p}</li>
                        ))}
                      </ul>
                      <h4 className="mt-5 text-xs font-semibold uppercase tracking-wider text-sky-300">Cliente ideal</h4>
                      <p className="mt-2 text-sm text-slate-200">{data.argumentario.ideal_customer}</p>
                      <h4 className="mt-5 text-xs font-semibold uppercase tracking-wider text-sky-300">Preguntas para detectar necesidades</h4>
                      <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
                        {data.argumentario.discovery_questions.map((p) => (
                          <li key={p} className="flex gap-2"><span className="text-sky-400">?</span>{p}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-sky-300">Objeciones habituales</h4>
                      <div className="mt-2 space-y-3">
                        {data.argumentario.objections.map((o, i) => (
                          <div key={i} className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
                            <p className="text-sm font-medium text-amber-300">«{o.objection}»</p>
                            <p className="mt-1 text-sm text-slate-200">{o.response}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="faq" className="mt-4">
              <div className="glass-panel rounded-2xl p-5">
                <h3 className="mb-3 text-base font-semibold text-white">❓ Preguntas relacionadas</h3>
                {(data?.related_faq ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin preguntas relacionadas registradas.</p>
                ) : (
                  <div className="space-y-3">
                    {data?.related_faq.map((f) => (
                      <div key={f.id} className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
                        <p className="text-sm font-medium text-slate-100">{f.question}</p>
                        <p className="mt-1 text-sm text-slate-300">{f.answer}</p>
                        <p className="mt-1.5 text-[10px] text-slate-500">📚 {f.source} · 📅 {fmtDate(f.last_updated)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
