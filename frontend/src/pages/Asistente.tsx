import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Square, Database, ExternalLink, Copy, Plus } from "lucide-react";
import { toast } from "sonner";

import MarkdownLite from "@/components/MarkdownLite";
import SecretariaAvatar from "@/components/SecretariaAvatar";
import { useMode } from "@/components/ModeContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiStream } from "@/lib/api";
import type { SourceRef } from "@/lib/types";

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
  engine?: string;
  external_help?: boolean;
}

const EXTERNAL_CHATS = [
  { name: "Copilot", url: "https://copilot.microsoft.com/", id: "copilot" },
  { name: "Gemini", url: "https://gemini.google.com/app", id: "gemini" },
  { name: "ChatGPT", url: "https://chatgpt.com/", id: "chatgpt" },
];

function safeSource(url?: string | null): boolean {
  return !!url && ((url.startsWith("/") && !url.startsWith("//")) || /^https:\/\/www\.volkswagen(?:-comerciales)?\.es\//.test(url));
}

const COMMANDS = [
  { cmd: "/stock", hint: "Unidades disponibles" },
  { cmd: "/precio", hint: "PVP y descuentos" },
  { cmd: "/financiacion", hint: "Cuotas y TAE" },
  { cmd: "/promociones", hint: "Campañas vigentes" },
  { cmd: "/comparar", hint: "Comparar modelos" },
  { cmd: "/vehiculo", hint: "Ficha técnica" },
  { cmd: "/faq", hint: "Base de conocimiento" },
  { cmd: "/cliente", hint: "Mensaje para cliente" },
  { cmd: "/auditar", hint: "Verificar un dato" },
  { cmd: "/investigar", hint: "Buscar en documentos" },
  { cmd: "/memoria", hint: "Qué recuerdo" },
];

const EXAMPLES = [
  "¿Qué motorizaciones tiene el Volkswagen Golf?",
  "Muéstrame la gama eléctrica",
  "¿Qué T-Roc tenemos en stock?",
  "Busca garantía de batería en documentos",
];

export default function Asistente() {
  const [params, setParams] = useSearchParams();
  const { mode } = useMode();
  const qc = useQueryClient();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const chatId = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);
  const request = useMutation({ mutationFn: (message: string) => processMessage(message) });

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function send(text: string) {
    if (!text.trim() || busy || request.isPending) return;
    await request.mutateAsync(text);
  }

  async function processMessage(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setTurns((t) => [...t, { role: "user", content: message }, { role: "assistant", content: "" }]);
    try {
      await apiStream("/chat", { message, chat_id: chatId.current, mode, model: "local" }, (ev) => {
        if (ev.type === "meta") {
          if (ev.chat_id) chatId.current = ev.chat_id;
          setTurns((t) => {
            const next = [...t];
            next[next.length - 1] = {
              ...next[next.length - 1],
              sources: ev.sources ?? [],
              engine: ev.engine,
              external_help: ev.external_help,
            };
            return next;
          });
        } else if (ev.type === "delta" && ev.content) {
          setTurns((t) => {
            const next = [...t];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + ev.content };
            return next;
          });
        }
      });
      void qc.invalidateQueries({ queryKey: ["chats"] });
    } catch {
      toast.error("No se pudo contactar con SecretarIA. Inténtalo de nuevo.");
      setTurns((t) => {
        const next = [...t];
        const last = next[next.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          next[next.length - 1] = {
            ...last,
            content: "⚠️ No he podido responder ahora mismo. Revisa la conexión con el servidor e inténtalo de nuevo.",
          };
        }
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  // Deep link from the dashboard chips: /asistente?q=...
  useEffect(() => {
    const q = params.get("q");
    if (q && !sentInitial.current) {
      sentInitial.current = true;
      setParams({}, { replace: true });
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="flex min-h-[calc(100svh-140px)] flex-col" data-testid="asistente-page">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SecretariaAvatar size={52} pulse={busy} />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl" data-testid="local-chat-title">Consulta tu información</h1>
            <p className="text-xs text-muted-foreground">
              Modo {mode === "cliente" ? "👤 cliente — respuesta lista para enviar" : "👨‍💼 vendedor — información comercial completa"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300" data-testid="local-chat-engine"><Database size={14} />Local · sin créditos de IA</span>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => { setTurns([]); setInput(""); chatId.current = null; }} data-testid="chat-new-button"><Plus size={14} />Nueva consulta</Button>
        </div>
      </div>
      <p className="mb-4 text-xs leading-5 text-slate-400" data-testid="local-chat-notice">Búsqueda local, no IA generativa. Consulta el catálogo y los archivos sin enviarlos a terceros. Si no basta, podrás abrir un chat externo gratuito sujeto a sus límites.</p>

      {/* Conversation */}
      <div className="glass-panel flex-1 overflow-y-auto rounded-3xl p-4 md:p-6" data-testid="chat-thread">
        {turns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 py-8 text-center">
            <SecretariaAvatar size={96} />
            <div>
              <p className="text-base font-medium text-slate-200" data-testid="local-chat-welcome">Tus fuentes, antes que cualquier suposición.</p>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                Busco en la gama Volkswagen, los datos del concesionario y los documentos cargados. Muestro las fuentes y
                distingo los extractos pendientes de revisión. No completo los datos que faltan con cifras inventadas.
              </p>
            </div>
            <div className="flex max-w-3xl flex-wrap justify-center gap-2">
              {EXAMPLES.map((e, i) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => void send(e)}
                  className="rounded-full border border-slate-700/60 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition-colors duration-200 hover:border-sky-500/50 hover:text-white"
                  data-testid={`chat-example-${i}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {turns.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="flex justify-end" data-testid={`chat-message-user-${i}`}>
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-sky-600 px-4 py-2.5 text-sm text-white">
                    {t.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-3" data-testid={`chat-message-assistant-${i}`}>
                  <SecretariaAvatar size={34} pulse={busy && i === turns.length - 1} />
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-slate-700/60 bg-slate-900/80 px-4 py-3 backdrop-blur-xl">
                    {t.content ? (
                      <MarkdownLite content={t.content} testId={`chat-response-${i}`} />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-sky-300" data-testid="chat-thinking">
                        <span className="flex gap-1">
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sky-400" />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sky-400" />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sky-400" />
                        </span>
                        Buscando en tus fuentes…
                      </div>
                    )}
                    {t.content && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-700/50 pt-3" data-testid={`chat-sources-${i}`}>
                        {t.engine && (
                          <span className="rounded-full border border-slate-600/60 bg-slate-900/70 px-2 py-1 text-[10px] text-slate-400" data-testid={`chat-engine-label-${i}`}>
                            {t.engine}
                          </span>
                        )}
                        {(t.sources ?? []).map((s, si) => (
                          safeSource(s.url) ? <a key={si} href={s.url!} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-sky-200 transition-colors hover:border-sky-500" data-testid={`chat-source-link-${i}-${si}`}>{s.estado} {s.name} · {s.updated.slice(0, 10)}<ExternalLink size={12} /></a> : <span key={si} className="text-xs text-slate-400" data-testid={`chat-source-text-${i}-${si}`}>{s.estado} {s.name} · {s.updated.slice(0, 10)}</span>
                        ))}
                      </div>
                    )}
                    {t.external_help && t.content && <section className="mt-4 rounded-xl border border-sky-900/70 bg-sky-950/20 p-4" data-testid={`chat-external-help-${i}`}>
                      <h2 className="flex items-center gap-2 text-sm font-semibold text-sky-200" data-testid={`chat-external-title-${i}`}><ExternalLink size={16} />¿Necesitas más ayuda?</h2>
                      <p className="mt-2 text-xs leading-5 text-slate-300" data-testid={`chat-external-warning-${i}`}>Copilot es la primera alternativa sugerida. También puedes usar Gemini o ChatGPT. Sus opciones gratuitas tienen límites y pueden requerir una cuenta; no se garantiza uso ilimitado.</p>
                      <p className="mt-2 text-xs leading-5 text-amber-200" data-testid={`chat-external-privacy-${i}`}>No se enviarán automáticamente esta conversación, archivos ni datos del concesionario. No compartas datos personales, precios internos o documentos confidenciales con un chat externo.</p>
                      <div className="mt-3 flex flex-wrap gap-2">{EXTERNAL_CHATS.map((provider, n) => <a key={provider.id} href={provider.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs transition-colors ${n === 0 ? "border-sky-600 bg-sky-700/30 text-white hover:bg-sky-700/50" : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"}`} data-testid={`chat-external-${provider.id}-${i}`}>Abrir {provider.name}<ExternalLink size={13} /></a>)}</div>
                      <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={async () => { try { await navigator.clipboard.writeText(turns[i - 1]?.content ?? ""); toast.success("Pregunta copiada. Revisa que no contenga información confidencial antes de compartirla."); } catch { toast.error("No se pudo copiar. Selecciona la pregunta manualmente."); } }} data-testid={`chat-copy-question-${i}`}><Copy size={13} />Copiar mi pregunta para revisarla</Button>
                    </section>}
                  </div>
                </div>
              ),
            )}
            <div ref={bottom} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="mt-3">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1" data-testid="chat-commands">
          {COMMANDS.map((c) => (
            <button
              key={c.cmd}
              type="button"
              onClick={() => setInput((v) => (v.startsWith("/") ? `${c.cmd} ` : `${c.cmd} ${v}`.trim() + " "))}
              className="shrink-0 rounded-full border border-slate-700/60 bg-slate-900/60 px-2.5 py-1 font-mono text-[11px] text-cyan-300 transition-colors duration-200 hover:border-cyan-500/50"
              title={c.hint}
              data-testid={`chat-command-${c.cmd.slice(1)}`}
            >
              {c.cmd}
            </button>
          ))}
        </div>
        <form
          className="glass-panel flex items-end gap-2 rounded-2xl p-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          data-testid="chat-form"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={2}
            placeholder="Busca un modelo, precio, promoción, financiación, stock o pregunta comercial…"
            className="min-h-[52px] resize-none border-0 bg-transparent focus-visible:ring-0"
            data-testid="chat-input-textarea"
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} className="glow-accent mb-1" data-testid="chat-send-button" aria-label="Enviar">
            {busy ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Consulta local sin coste de IA. Los extractos y datos pendientes no son ofertas confirmadas. Comprueba siempre la fuente antes de presentarlos al cliente.
        </p>
      </div>
    </div>
  );
}
