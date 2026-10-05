# SecretarIA — Especificación viva

**App**: SecretarIA — "Tu asistente comercial Volkswagen", para **Centrowagen Don Benito** (Badajoz, España).
Software comercial de concesionario: catálogo VW, stock, precios, financiación, promociones, comparador,
documentación, FAQ, argumentario, memoria IA, auditoría de datos, ventas/comisiones y un asistente IA con RAG.
Idioma de toda la interfaz: **español**. UI: liquid glass oscuro estilo Apple + azul Volkswagen (#0066D6), tipografía Inter.

## Principio rector
**No inventar datos comerciales.** El asistente solo responde con lo recuperado de la base de datos
(`lib/rag.py` construye el bloque de contexto; el prompt prohíbe cualquier dato ausente). Si falta un dato:
"⚠️ No tengo este dato confirmado en la información oficial disponible." Cada dato muestra fuente, fecha y
estado 🟢/🟡 (🟡 = > 45 días, `lib/rag.freshness`).
Todo el contenido actual está marcado **DATOS DE DEMOSTRACIÓN**.

## Stack
- Backend FastAPI (:8001), todas las rutas en `api_router` bajo `/api`. Mongo vía motor (`lib/db.py`, `INDEXES`).
- Frontend Vite + React 19 + TS strict (:3000), TanStack Query, shadcn/ui, llamadas relativas `/api` (`src/lib/api.ts`).

## Integraciones
| Integración | Dónde | Notas |
|---|---|---|
| **Claude (Anthropic)** | `lib/llm.py` → `claude-sonnet-5-5` vía `emergentintegrations`, clave `EMERGENT_LLM_KEY` | streaming SSE en `POST /api/chat` y `POST /api/client-message` |
| **Resend gestionado** | `lib/email.py` + `routers/client_messages.py` | `EMERGENT_EMAIL_KEY`, `EMAIL_FROM_NAME`; gate `_assert_safe_email` en cada envío; la ruta de envío recibe solo un **id** (G4), plantilla y destinatario son de servidor; límite 10 envíos/hora/usuario |
| **Google Sign-In (Emergent)** | `POST /api/auth/google` + `src/components/AuthCallback.tsx` | el `session_id` del fragmento se canjea en backend; crea/reutiliza usuario por email con rol `vendedor` |
| **Almacenamiento de archivos** | `lib/storage.py` + `routers/knowledge.py` | objetos en `secretaria-centrowagen/documents/...`; borrado **lógico** (`is_deleted`), sin API de delete; descarga siempre por backend |

## Modelo de datos (colecciones Mongo)
`users`, `sessions`, `google_sessions`, `vehicles`, `stock`, `prices`, `financing`, `promotions`,
`documents`, `faq`, `memory`, `argumentario`, `chats`, `messages`, `client_messages`, `sales`, `settings`.
Ids string uuid4. Cada modelo Pydantic tiene su interfaz TS espejo en `src/lib/types.ts`.

## Datos sembrados (`python seed.py --force`)
- **17 versiones** de 10 modelos: Golf (Life/R-Line/GTI), T-Roc (Life/R-Line), Tiguan (Life/R-Line),
  Passat (Business/Elegance eHybrid), Taigo (Life/R-Line), T-Cross (Life/Sport), ID.3, ID.4, ID.5, ID.7.
- **23 unidades de stock** (nº CB-xxxx; estados: Entrega inmediata / En tránsito / Bajo pedido / Reservado).
- **17 tarifas**, **10 planes de financiación** (cuota calculada con TIN real), **8 promociones**
  (2 deliberadamente finalizadas para probar el estado), **14 FAQ**, **8 memorias**, **6 argumentarios**,
  **8 documentos**, **5 ventas**, settings (comisión 3%, objetivo 600.000 €).

## Flujos clave
1. **Login** (`/login`): email+contraseña → cookie httpOnly `secretaria_session`; o "Continuar con Google".
2. **Asistente** (`/asistente`): pregunta → `retrieve()` rankea vehículos/stock/precios/promos/FAQ/memoria/docs →
   prompt con el contexto → Claude en streaming → respuesta markdown + pills de fuente. 11 comandos slash.
3. **Stock** (`/stock`): filtros (modelo, combustible, cambio, color, disponibilidad, precio máx., potencia mín.) + vista tarjetas/tabla.
4. **Ficha** (`/vehiculos/:id`): resumen, precio, promociones, equipamiento, técnico, stock, financiación, argumentario, FAQ.
5. **Comparador** (`/comparador`): hasta 4 versiones, resalta la mejor cifra por fila.
6. **Auditoría** (`/auditoria`): verificación **determinista** (sin IA) contra tarifas/stock/promos/FAQ/docs → 🟢/🟡/🔴.
7. **Respuesta a cliente** (`/cliente`): canal (WhatsApp/email/corto) + tono + cliente + modelo → Claude en **modo cliente**
   (streaming) → copiar o **enviar por email** (Resend gestionado). Deep link desde la ficha: `/cliente?model=...`.
   Si falta un dato comercial, el mensaje escribe `[DATO PENDIENTE DE CONFIRMACIÓN]`.
8. **Ventas** (`/ventas`): registra operación → comisión estimada = (PVP − descuento) × tasa; KPIs mes/año + objetivo.
9. **Modo vendedor / cliente**: `ModeContext` (localStorage) → se envía al backend y cambia el prompt.

## Roles
- **ADMIN**: todas las mutaciones (vehículos, stock, precios, financiación, promociones, documentos, FAQ, memoria, argumentario, settings).
- **VENDEDOR**: solo lectura del plano comercial + asistente, comparador, generar mensajes y registrar **sus** ventas.
  Las rutas de mutación usan `Depends(require_admin)` → 403 para vendedor.
