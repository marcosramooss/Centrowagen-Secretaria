import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Square } from "lucide-react";
import { toast } from "sonner";

import MarkdownLite from "@/components/MarkdownLite";
import SecretariaAvatar from "@/components/SecretariaAvatar";
import { DemoPill, SourcePill } from "@/components/bits";
import { useMode } from "@/components/ModeContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiStream } from "@/lib/api";
import type { SourceRef } from "@/lib/types";

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
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
  "¿Qué T-Roc tenemos en stock?",
  "¿Cuál es el precio del Tiguan R-Line?",
  "Compárame T-Roc y Tiguan",
  "¿Qué coches tienen entrega inmediata?",
  "Un cliente quiere un SUV automático por menos de 35.000 €",
  "Prepárame un WhatsApp para un cliente interesado en el Golf",
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

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setTurns((t) => [...t, { role: "user", content: message }, { role: "assistant", content: "" }]);
    try {
      await apiStream("/chat", { message, chat_id: chatId.current, mode }, (ev) => {
        if (ev.type === "meta") {
          if (ev.chat_id) chatId.current = ev.chat_id;
          setTurns((t) => {
            const next = [...t];
            next[next.length - 1] = { ...next[next.length - 1], sources: ev.sources ?? [] };
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
            <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">¿En qué puedo ayudarte?</h1>
            <p className="text-xs text-muted-foreground">
              Modo {mode === "cliente" ? "👤 cliente — respuesta lista para enviar" : "👨‍💼 vendedor — información comercial completa"}
            </p>
          </div>
        </div>
        <DemoPill />
      </div>

      {/* Conversation */}
      <div className="glass-panel flex-1 overflow-y-auto rounded-3xl p-4 md:p-6" data-testid="chat-thread">
        {turns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 py-8 text-center">
            <SecretariaAvatar size={96} />
            <div>
              <p className="text-base font-medium text-slate-200">Soy SecretarIA, tu asistente comercial Volkswagen.</p>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                Respondo únicamente con la información oficial registrada en la base de datos del concesionario. Si un
                dato no está confirmado, te lo diré en lugar de inventarlo.
              </p>
            </div>
            <div className="flex max-w-3xl flex-wrap justify-center gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => void send(e)}
                  className="rounded-full border border-slate-700/60 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition-colors duration-200 hover:border-sky-500/50 hover:text-white"
                  data-testid="chat-example-chip"
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
                <div key={i} className="flex justify-end" data-testid="chat-message-user">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-sky-600 px-4 py-2.5 text-sm text-white">
                    {t.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-3" data-testid="chat-message-assistant">
                  <SecretariaAvatar size={34} pulse={busy && i === turns.length - 1} />
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-slate-700/60 bg-slate-900/80 px-4 py-3 backdrop-blur-xl">
                    {t.content ? (
                      <MarkdownLite content={t.content} />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-sky-300" data-testid="chat-thinking">
                        <span className="flex gap-1">
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sky-400" />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sky-400" />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sky-400" />
                        </span>
                        SecretarIA está pensando…
                      </div>
                    )}
                    {t.sources && t.sources.length > 0 && t.content && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-700/50 pt-3" data-testid="chat-sources">
                        {t.sources.map((s, si) => (
                          <SourcePill key={si} source={s} />
                        ))}
                      </div>
                    )}
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
          SecretarIA solo usa la información oficial registrada. Verifica cualquier condición antes de presentarla como
          oferta definitiva al cliente.
        </p>
      </div>
    </div>
  );
}
