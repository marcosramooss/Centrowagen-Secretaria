import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { DemoPill, EmptyState, PageHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiDelete, apiGet, apiPostForm } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useMe } from "@/lib/session";
import type { DocumentItem } from "@/lib/types";

const CATEGORIES = ["Tarifas", "Catálogos", "Campañas", "Stock", "Fichas técnicas", "Financiación", "Garantía", "Formación", "Procedimientos", "General"];
const TYPES = ["PDF", "XLSX", "CSV", "DOCX", "Imagen"];

export default function Documentos({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Tarifas");
  const [docType, setDocType] = useState("PDF");
  const fileRef = useRef<HTMLInputElement>(null);

  const docs = useQuery({ queryKey: ["documents"], queryFn: () => apiGet<DocumentItem[]>("/documents"), retry: false });

  const upload = useMutation({
    mutationFn: (form: FormData) => apiPostForm<DocumentItem>("/documents", form),
    onSuccess: () => {
      toast.success("Documento añadido a la base documental");
      setName("");
      if (fileRef.current) fileRef.current.value = "";
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => toast.error("No se pudo subir el documento"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/documents/${id}`),
    onSuccess: () => {
      toast.success("Documento eliminado");
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => toast.error("No se pudo eliminar el documento"),
  });

  const all = docs.data ?? [];
  const list = all.filter((d) => {
    if (!q) return true;
    const blob = `${d.name} ${d.category} ${d.document_type} ${d.source}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).every((t) => blob.includes(t));
  });

  return (
    <div data-testid="documentos-page">
      {!embedded && <PageHeader
        title="📚 Documentación"
        subtitle="Archivos de referencia con trazabilidad. Subir un PDF no verifica sus datos ni los convierte en tarifa."
        right={<DemoPill />}
      />}

      {isAdmin && (
        <form
          className="glass-panel mb-5 rounded-2xl p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const file = fileRef.current?.files?.[0];
            const form = new FormData();
            form.append("name", name || file?.name || "Documento sin título");
            form.append("category", category);
            form.append("document_type", docType);
            form.append("source", "Centrowagen");
            if (file) form.append("file", file);
            upload.mutate(form);
          }}
          data-testid="document-upload-form"
        >
          <h2 className="mb-3 text-base font-semibold text-white">Subir documento</h2>
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-xs">Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tarifa Volkswagen PVP 2026-3"
                data-testid="document-name-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="document-category-select">
                  <SelectValue>{(v) => String(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger data-testid="document-type-select">
                  <SelectValue>{(v) => String(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Archivo (PDF, Excel, CSV, Word, imagen)</Label>
              <Input
                ref={fileRef}
                required
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.txt,.png,.jpg,.jpeg"
                className="file:mr-3 file:rounded-md file:border-0 file:bg-sky-600/30 file:px-3 file:py-1 file:text-xs file:text-sky-200"
                data-testid="document-file-input"
              />
            </div>
            <Button type="submit" className="gap-2" disabled={upload.isPending} data-testid="document-upload-button">
              <Upload className="h-4 w-4" /> {upload.isPending ? "Subiendo…" : "Subir"}
            </Button>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground" data-testid="document-verification-notice">
            PDF, TXT, CSV y Excel: se extrae el texto disponible. Un PDF escaneado puede no contener texto extraíble.
            Los archivos quedan pendientes de revisión y excluidos de las respuestas confirmadas de la IA.
          </p>
        </form>
      )}

      <div className="glass-panel mb-5 rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca por nombre, categoría o fuente…"
            className="pl-9"
            data-testid="documentos-search-input"
          />
        </div>
      </div>

      {docs.isError ? (
        <EmptyState title="No se ha podido cargar la base documental" hint="Comprueba la conexión con el servidor." />
      ) : list.length === 0 ? (
        <EmptyState icon={<FileText className="h-7 w-7 text-sky-400" />} title="Sin documentos" hint="Sube tarifas, catálogos o campañas oficiales." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="documentos-grid">
          {list.map((d) => (
            <div key={d.id} className="glass-card rounded-2xl p-4" data-testid={`document-card-${d.id}`}>
              <p className="mb-3 text-xs text-amber-300" data-testid={`document-verification-${d.id}`}>{d.verification_status === "verified" ? "Revisado por el concesionario" : "No verificado automáticamente · Pendiente de revisión"}</p>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 font-mono text-[10px] text-sky-300">
                    {d.document_type}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100">{d.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{d.category} · v{d.version}</p>
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => remove.mutate(d.id)}
                    data-testid={`document-delete-${d.id}`}
                    aria-label="Eliminar documento"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                  </Button>
                )}
              </div>
              {d.content_text && (
                <p className="mt-3 line-clamp-3 text-[11px] text-slate-400">{d.content_text.slice(0, 200)}…</p>
              )}
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[10px] text-slate-500">📚 {d.source} · 📅 {fmtDate(d.upload_date)}</p>
                {d.file_url && (
                  <a
                    href={d.file_url}
                    className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
                    data-testid={`document-download-${d.id}`}
                  >
                    <Download className="h-3 w-3" /> Descargar
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
