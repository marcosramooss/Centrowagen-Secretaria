import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";

import MarkdownLite from "@/components/MarkdownLite";
import SecretariaAvatar from "@/components/SecretariaAvatar";
import { DemoPill, PageHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiPost, apiStream } from "@/lib/api";

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email formal" },
  { value: "corto", label: "Mensaje corto" },
];
const TONES = [
  { value: "profesional", label: "Profesional / asesor" },
  { value: "entusiasta", label: "Entusiasta" },
  { value: "urgente", label: "Urgente / últimos días" },
];

interface SavedRecord {
  id: string;
}

export default function ClienteMensaje() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [channel, setChannel] = useState("whatsapp");
  const [tone, setTone] = useState("profesional");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  // Prefilled when arriving from a vehicle detail page (/cliente?model=...).
  const [model, setModel] = useState(() => params.get("model") ?? "");
  const [question, setQuestion] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setContent("");
    setRecordId(null);
    try {
      await apiStream(
        "/client-message",
        { channel, tone, client_name: clientName || null, model: model || null, question },
        (ev) => {
          if (ev.type === "delta" && ev.content) setContent((c) => c + ev.content);
        },
      );
    } catch {
      toast.error("No se pudo generar el mensaje. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const save = useMutation({
    mutationFn: () =>
      apiPost<SavedRecord>("/client-messages", {
        client_name: clientName || "Cliente",
        client_email: clientEmail || null,
        model: model || null,
        channel,
        tone,
        question,
        content,
      }),
    onSuccess: (rec) => {
      setRecordId(rec.id);
      toast.success("Mensaje guardado");
      void qc.invalidateQueries({ queryKey: ["client-messages"] });
    },
    onError: () => toast.error("No se pudo guardar el mensaje"),
  });

  const sendEmail = useMutation({
    mutationFn: async () => {
      let id = recordId;
      if (!id) {
        const rec = await save.mutateAsync();
        id = rec.id;
      }
      return apiPost<{ ok: boolean }>(`/client-messages/${id}/send`, {});
    },
    onSuccess: () => toast.success(`Email enviado a ${clientEmail}`),
    onError: () => toast.error("No se pudo enviar el email. Revisa la dirección del cliente."),
  });

  return (
    <div data-testid="cliente-page">
      <PageHeader
        title="✉️ Respuesta para cliente"
        subtitle="SecretarIA redacta en modo cliente: solo datos confirmados, sin información interna. Puedes copiarlo o enviarlo por email."
        right={<DemoPill />}
      />

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <form
          className="glass-panel rounded-2xl p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
          data-testid="client-message-form"
        >
          <h2 className="mb-4 text-base font-semibold text-white">Datos del mensaje</h2>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Canal</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger data-testid="client-channel-select">
                    <SelectValue>{(v) => CHANNELS.find((c) => c.value === v)?.label ?? String(v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tono</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger data-testid="client-tone-select">
                    <SelectValue>{(v) => TONES.find((t) => t.value === v)?.label ?? String(v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nombre del cliente</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="María López" data-testid="client-name-input" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Email del cliente (para enviar por correo)</Label>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="cliente@email.com"
                data-testid="client-email-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Modelo de interés</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="T-Roc R-Line" data-testid="client-model-input" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Consulta del cliente / contexto</Label>
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                placeholder="¿Cuánto me sale el T-Roc? Le interesa financiarlo a 48 meses."
                data-testid="client-question-input"
              />
            </div>

            <Button type="submit" className="glow-accent w-full gap-2" disabled={busy} data-testid="client-generate-button">
              <Sparkles className="h-4 w-4" /> {busy ? "Redactando…" : "Generar mensaje"}
            </Button>
          </div>
        </form>

        <div className="glass-panel rounded-2xl p-5" data-testid="client-message-result">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">Mensaje generado</h2>
            {content && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    void navigator.clipboard.writeText(content);
                    toast.success("Mensaje copiado");
                  }}
                  data-testid="client-copy-button"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!clientEmail || sendEmail.isPending}
                  onClick={() => sendEmail.mutate()}
                  data-testid="client-send-email-button"
                >
                  <Mail className="h-3.5 w-3.5" /> {sendEmail.isPending ? "Enviando…" : "Enviar por email"}
                </Button>
              </div>
            )}
          </div>

          {busy && !content ? (
            <div className="flex items-center gap-3 text-sm text-sky-300">
              <SecretariaAvatar size={34} pulse />
              <span className="flex gap-1">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sky-400" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sky-400" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sky-400" />
              </span>
              SecretarIA está redactando…
            </div>
          ) : content ? (
            <>
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
                <MarkdownLite content={content} />
              </div>
              <p className="mt-3 text-[11px] text-amber-300">
                ⚠️ Revisa el mensaje antes de enviarlo. Cualquier dato marcado como pendiente debe confirmarse con
                jefatura.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Completa los datos y pulsa «Generar mensaje». SecretarIA usará solo precios, promociones y financiación
              confirmados; si falta algún dato escribirá [DATO PENDIENTE DE CONFIRMACIÓN].
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
