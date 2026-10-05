import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";

import { DemoPill, PageHeader, SourcePill } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiPost } from "@/lib/api";
import type { AuditResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const KINDS: { value: string; label: string }[] = [
  { value: "precio", label: "Precio" },
  { value: "promocion", label: "Promoción" },
  { value: "dato", label: "Otro dato" },
];

const STYLES: Record<string, string> = {
  confirmado: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  verificar: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  incorrecto: "border-rose-500/40 bg-rose-500/10 text-rose-200",
};

export default function Auditoria() {
  const [kind, setKind] = useState("precio");
  const [model, setModel] = useState("");
  const [value, setValue] = useState("");
  const [claim, setClaim] = useState("");

  const audit = useMutation({
    mutationFn: (body: { kind: string; model: string | null; value: number | null; claim: string }) =>
      apiPost<AuditResult>("/audit", body),
  });

  const result = audit.data;

  return (
    <div data-testid="auditoria-page">
      <PageHeader
        title="🔎 Auditoría de información"
        subtitle="Comprueba un precio, promoción o dato contra la información oficial registrada antes de presentarlo al cliente."
        right={<DemoPill />}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <form
          className="glass-panel rounded-2xl p-5"
          onSubmit={(e) => {
            e.preventDefault();
            audit.mutate({
              kind,
              model: model.trim() || null,
              value: value ? Number(value) : null,
              claim: claim.trim(),
            });
          }}
          data-testid="audit-form"
        >
          <h2 className="mb-4 text-base font-semibold text-white">Dato a verificar</h2>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de dato</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger data-testid="audit-kind-select">
                  <SelectValue>{(v) => KINDS.find((k) => k.value === v)?.label ?? String(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Modelo (opcional)</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="T-Roc, Tiguan, ID.4…"
                data-testid="audit-model-input"
              />
            </div>

            {kind !== "dato" && (
              <div className="space-y-1.5">
                <Label className="text-xs">{kind === "precio" ? "Precio indicado (€)" : "Importe del descuento (€)"}</Label>
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="31520"
                  data-testid="audit-value-input"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Afirmación a comprobar</Label>
              <Textarea
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                rows={3}
                placeholder="Ej.: El T-Roc R-Line de stock sale por 31.520 € con la campaña vigente."
                data-testid="audit-claim-input"
              />
            </div>

            <Button type="submit" className="glow-accent w-full gap-2" disabled={audit.isPending} data-testid="audit-submit-button">
              <ShieldCheck className="h-4 w-4" /> {audit.isPending ? "Comprobando…" : "Auditar información"}
            </Button>
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            La verificación es determinista: se compara contra tarifas, stock, promociones, FAQ y documentos
            registrados. No interviene ninguna estimación de la IA.
          </p>
        </form>

        <div className="glass-panel rounded-2xl p-5" data-testid="audit-result-panel">
          <h2 className="mb-4 text-base font-semibold text-white">Resultado</h2>

          {audit.isError ? (
            <p className="text-sm text-rose-300">No se ha podido completar la auditoría. Inténtalo de nuevo.</p>
          ) : !result ? (
            <p className="text-sm text-muted-foreground">
              Introduce un dato y pulsa «Auditar información» para ver si está confirmado, necesita verificación o está
              desactualizado.
            </p>
          ) : (
            <>
              <div className={cn("rounded-xl border p-4", STYLES[result.estado])} data-testid="audit-result-estado">
                <p className="text-sm font-medium">{result.mensaje}</p>
              </div>

              {result.coincidencias.length > 0 && (
                <div className="mt-4" data-testid="audit-matches">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-300">Coincidencias</h3>
                  <div className="space-y-2">
                    {result.coincidencias.map((c, i) => (
                      <div key={i} className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3 text-xs">
                        {Object.entries(c).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-3 py-0.5">
                            <span className="text-slate-400">{k}</span>
                            <span className="text-right font-medium text-slate-200">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.fuentes.length > 0 && (
                <div className="mt-4" data-testid="audit-sources">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-300">Fuentes</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {result.fuentes.map((s, i) => (
                      <SourcePill key={i} source={s} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
