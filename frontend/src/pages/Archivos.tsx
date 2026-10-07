import { Link, useSearchParams } from "react-router-dom";
import { Car, FileSpreadsheet, FileText, FolderUp, Warehouse, ArrowUpRight, CircleCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import DataImportPanel from "@/components/DataImportPanel";
import ImportarTarifas from "@/pages/ImportarTarifas";
import Documentos from "@/pages/Documentos";
import { useMe } from "@/lib/session";

const SECTIONS = [
  { id: "catalogo", label: "Catálogo", icon: Car, title: "Versiones del concesionario", detail: "Completa modelos, acabados y características de tus versiones concretas. La gama oficial de Volkswagen se actualiza por separado, automáticamente.", format: "Excel o CSV · hasta 10 MB", required: "Modelo y acabado para identificar cada versión", result: "Vista previa de altas y cambios. Solo se guarda al confirmar." },
  { id: "stock", label: "Stock", icon: Warehouse, title: "Unidades disponibles", detail: "Carga las unidades del concesionario: referencia, bastidor, color, precio y disponibilidad. Importa primero las versiones a las que pertenecen.", format: "Excel o CSV · hasta 10 MB", required: "Nº de stock, modelo y acabado exactos", result: "Empareja por número de stock y muestra los cambios antes de guardar." },
  { id: "tarifas", label: "Tarifas", icon: FileSpreadsheet, title: "Precios y condiciones", detail: "Actualiza los precios de las versiones ya registradas. Revisa las diferencias y decide si quieres actualizar también los precios del stock.", format: "Excel o CSV · hasta 10 MB", required: "Modelo y PVP; acabado si hay varias versiones", result: "Compara importes anteriores y nuevos antes de aplicarlos." },
  { id: "documentos", label: "Documentos PDF", icon: FileText, title: "Biblioteca documental", detail: "Guarda catálogos, fichas técnicas y circulares de referencia. Subir un documento no crea unidades de stock ni modifica precios.", format: "PDF, Excel, CSV, Word o imagen · hasta 25 MB", required: "Selecciona el archivo y su categoría", result: "Se guarda como documento pendiente de revisión, no como dato verificado." },
] as const;

export default function Archivos() {
  const [params, setParams] = useSearchParams();
  const section = SECTIONS.find(s => s.id === params.get("seccion")) ?? SECTIONS[0];
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  return <div className="animate-fade-up" data-testid="files-center-page">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div><p className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[.2em] text-sky-400" data-testid="files-center-eyebrow"><FolderUp size={15} />Información del concesionario</p><h1 className="text-4xl font-medium tracking-tight" data-testid="files-center-title">Centro de archivos</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400" data-testid="files-center-description">Cada archivo, en su lugar. Elige qué quieres cargar y revisa cómo se utilizará antes de continuar.</p></div>
      <Link to="/gestion" className={buttonVariants({ variant: "outline" })} data-testid="files-manual-management-link">Editar registros manualmente <ArrowUpRight size={15} /></Link>
    </header>
    {!isAdmin && <p className="mb-5 rounded-xl border border-amber-800/50 bg-amber-950/20 p-4 text-sm text-amber-200" data-testid="files-admin-required">Las cargas están reservadas a administradores. Puedes consultar el catálogo y la biblioteca.</p>}
    <Tabs value={section.id} onValueChange={value => setParams({ seccion: value })} data-testid="files-tabs">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950/40 p-1.5 md:grid-cols-4" data-testid="files-tabs-list">
        {SECTIONS.map(({ id, label, icon: Icon }, i) => <TabsTrigger key={id} value={id} className="min-h-14 gap-2 rounded-lg text-sm" data-testid={`files-tab-${id}`}><Icon size={17} /><span>{label}</span><span className="ml-auto hidden font-mono text-[10px] opacity-40 lg:inline">0{i + 1}</span></TabsTrigger>)}
      </TabsList>
      <section className="my-6 grid gap-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 lg:grid-cols-[1.3fr_1fr] lg:p-6" aria-live="polite" data-testid="files-section-guide">
        <div><h2 className="text-2xl font-medium" data-testid="files-section-title">{section.title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400" data-testid="files-section-description">{section.detail}</p></div>
        <div className="space-y-3 border-t border-slate-800 pt-4 text-xs lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <p className="text-slate-300" data-testid="files-format-guide"><span className="mr-2 text-slate-500">Formato</span>{section.format}</p>
          <p className="text-slate-300" data-testid="files-columns-guide"><span className="mr-2 text-slate-500">Necesitas</span>{section.required}</p>
          <p className="flex gap-2 leading-5 text-sky-200" data-testid="files-result-guide"><CircleCheck size={15} className="mt-0.5 shrink-0" />{section.result}</p>
        </div>
      </section>
      <TabsContent value="catalogo" data-testid="files-content-catalogo"><DataImportPanel isAdmin={isAdmin} fixedKind="vehicles" /></TabsContent>
      <TabsContent value="stock" data-testid="files-content-stock"><DataImportPanel isAdmin={isAdmin} fixedKind="stock" /></TabsContent>
      <TabsContent value="tarifas" data-testid="files-content-tarifas"><ImportarTarifas embedded /></TabsContent>
      <TabsContent value="documentos" data-testid="files-content-documentos"><Documentos embedded /></TabsContent>
    </Tabs>
    <p className="mt-5 text-xs leading-5 text-slate-500" data-testid="files-data-policy">Cambiar de sección descarta la vista previa sin guardar. La importación no verifica automáticamente ningún dato comercial. Conserva la fuente y contrasta su vigencia antes de presentar una oferta.</p>
  </div>;
}