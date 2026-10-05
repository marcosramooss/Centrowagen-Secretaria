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
| **Claude (Anthropic)** | `lib/llm.py` → `claude-sonnet-5-5` / `claude-opus-5-5` | motor por defecto |
| **ChatGPT (OpenAI)** | `lib/llm.py` → `gpt-5.6-terra` / `gpt-5.4-mini` | seleccionable en el asistente; `GET /api/ai/models` lista los motores, el cliente envía `model` en `/api/chat` y `engine` en `/api/client-message`; la preferencia se guarda en localStorage |
| **Resend gestionado** | `lib/email.py`, `routers/client_messages.py`, `routers/tasks.py` | mensajes a cliente + **resumen diario de tareas**; gate `_assert_safe_email` en cada envío; la ruta de envío recibe solo un **id** (G4) |
| **Google Sign-In (Emergent)** | `POST /api/auth/google` + `AuthCallback.tsx` | el `session_id` se canjea en backend; email nuevo → rol `vendedor` |
| **Almacenamiento de archivos** | `lib/storage.py` + `routers/knowledge.py` | borrado **lógico** (`is_deleted`); descarga siempre por backend |
| **Cron de plataforma** | `.emergent/crons.yml` → `POST /api/cron/daily-digest` | 08:00 Europe/Madrid; bearer `WEBHOOK_CRON_SECRET`, ack 2xx inmediato + trabajo en `BackgroundTasks`, idempotente por `X-Webhook-Id` en `cron_runs` |

## Modelo de datos (colecciones Mongo)
`users`, `sessions`, `google_sessions`, `vehicles`, `stock`, `prices`, `financing`, `promotions`,
`documents`, `faq`, `memory`, `argumentario`, `chats`, `messages`, `client_messages`, `sales`, `settings`,
`tasks` (recordatorios), `cron_runs` (idempotencia del cron).
Ids string uuid4. Cada modelo Pydantic tiene su interfaz TS espejo en `src/lib/types.ts` (fase 1) o `src/lib/types2.ts` (fase 2).

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
9. **Recordatorios** (`/tareas`): CRUD de seguimientos con tipo, cliente, teléfono, vehículo, fecha/hora y prioridad.
   Estados derivados de la fecha: vencida / hoy / próximos 7 días. Avisos in-app: campana en la cabecera
   (`notifications-bell-button`, badge con vencidas+hoy), contador en el menú y bloque en el dashboard.
   Email automático cada día a las 08:00 (cron de plataforma) solo si hay vencidas o de hoy.
10. **Importar tarifa** (`/importar`, solo ADMIN): sube Excel/CSV → `POST /api/tariff/preview` (**no escribe nada**)
    empareja por modelo+acabado y clasifica cada fila en `actualizable` / `nueva` / `no_reconocida` con el delta de
    precio → el usuario confirma → `POST /api/tariff/apply` actualiza `prices` y, si se marca, el PVP de `stock`.
    Cabecera detectada en cualquiera de las 10 primeras filas; importes en formato español (35.020,50).
11. **Oferta PDF** (`GET /api/offers/{vehicle_id}/pdf?client_name=&stock_number=`): reportlab, con cliente, vendedor,
    fecha, ficha, precio, promociones vigentes, financiación, equipamiento y aviso legal. Botón en la ficha del vehículo.
12. **Modo vendedor / cliente**: `ModeContext` (localStorage) → se envía al backend y cambia el prompt.
13. **RAG de PDF**: `_extract_text` en `routers/knowledge.py` indexa TXT/CSV/MD/JSON, Excel y **PDF** (pypdf, 60 págs/20k car.).

## Roles
- **ADMIN**: todas las mutaciones (vehículos, stock, precios, financiación, promociones, documentos, FAQ, memoria, argumentario, settings).
- **VENDEDOR**: solo lectura del plano comercial + asistente, comparador, generar mensajes y registrar **sus** ventas.
  Las rutas de mutación usan `Depends(require_admin)` → 403 para vendedor.
