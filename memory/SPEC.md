# SecretarIA — Especificación viva

**App**: SecretarIA — "Tu asistente comercial Volkswagen", para **Centrowagen Don Benito** (Badajoz, España).
Software comercial de concesionario: catálogo VW, stock, precios, financiación, promociones, comparador,
documentación, FAQ, argumentario, memoria IA, auditoría de datos, ventas/comisiones y un asistente IA con RAG.
Idioma de toda la interfaz: **español**. UI oscura profesional (#090D14), azul Volkswagen, Outfit + DM Sans + Geist Mono.

## Principio rector
**No inventar datos comerciales.** El asistente solo responde con lo recuperado de la base de datos
(`lib/rag.py` construye el bloque de contexto; el prompt prohíbe cualquier dato ausente). Si falta un dato:
"⚠️ No tengo este dato confirmado en la información oficial disponible." Cada dato muestra fuente, fecha y
estado 🟢/🟡 (🟡 = > 45 días, `lib/rag.freshness`).
No generar datos de demostración. El GitHub recuperado no contenía .env ni base de datos: Mongo local `app` solo tenía status_checks vacío. No había registros de negocio/usuarios que borrar ni datos reales recuperados. Usuarios/configuración existentes nunca se purgan.

## Prioridad vigente: consulta local sin coste de IA (2026-10-07)
El usuario descartó Gemini API tras conocer los requisitos de facturación para su uso en España y NO autorizó créditos Emergent ni APIs de pago. Quiere primero consulta local a DB/archivos, con enlace a chat externo cuando la información no baste.
- `/api/chat` usa `lib/local_assistant.py`, determinista, sin LLM ni conexiones de red. Mantiene SSE e historial, valida pertenencia de chat antes de leer/escribir. Ignora selecciones de motores de pago heredadas. `/api/ai/models` anuncia únicamente local.
- Busca datos publicados en catalog_snapshots, stock/precios/financiación/promociones registrados, extractos documentales, FAQ y notas de memoria (solo vendedor). No inventa números. Reconoce nombres de modelos, intención y referencia al modelo del turno anterior. Consulta general de modelos/gama soporta filtros básicos (eléctrico/híbrido/SUV/automático/comerciales).
- Documentos/valores importados pendientes pueden aparecer en modo vendedor SOLO como extractos/registros claramente pendientes de revisión, no como datos oficiales verificados. En modo cliente se excluyen documentos internos y registros no verificados; falta de confirmación produce DATO PENDIENTE DE CONFIRMACIÓN.
- Si falta respuesta completa: `external_help:true` y aviso para abrir Copilot (principal), Gemini o ChatGPT externamente. URLs fijas SIN pregunta/contexto/archivos ni datos de clientes; usuario decide abrir/copy. No hay integración API ni transferencia automática. Servicios externos tienen modalidades gratuitas con límites; ninguno garantizado gratuito ilimitado ni objetivamente de mayor duración.
- Respuesta para cliente también usa plantilla local basada en datos confirmados, no LLM; no simular redacción generativa. Email sigue sin configurar.
- El error de falta EMERGENT_LLM_KEY se reprodujo por función real y por chat de navegador antes de la corrección. Verificación final obligatoria mediante testing_agent pendiente.
- El motor local es real (consultas Mongo), NO un mock de LLM. Sin contrato de semántica ilimitada: coincidencia por modelos/palabras/intención, no entiende cualquier pregunta ni genera investigación externa. Enlaces externos solo se abren por acción explícita; botón copiar pregunta solo escribe al portapapeles por decisión del usuario y avisa sobre confidencialidad.

## Actualización catálogo y preparación real (2026-10-06)
- `/vehiculos`: pestaña Gama oficial por defecto, catálogo independiente de las versiones concretas del concesionario. Admin pulsa Cargar/Actualizar desde VW; `/api/catalog/refresh` lee determinísticamente el JSON público embebido en los catálogos oficiales de Volkswagen España y VW Comerciales. No LLM, no fotos genéricas. Dos fuentes deben responder para sustituir la consulta anterior. Excluye modelos anteriores/ocasión/agrupaciones; deduplica comerciales entre ambas webs.
- `/api/catalog/official`: última consulta persistida en `catalog_snapshots`, fecha real y obsolescencia tras 7 días. Fotos del CDN oficial con fallback de enlace; fotos de gama, no stock. Carrocerías, combustibles, transmisiones, acabados y potencias solo si constan en engines/modelName. No inferir propulsión desde isElectric (erróneo en nodos virtuales de VW). No precios/campañas importados de web. Detalles con fuente de gama o ficha cuando su enlace fue encontrado literalmente.
- `/gestion`: gestión e importación catálogo/stock, antes inaccesible por falta de ruta. `POST /api/import/{vehicles|stock}/preview` solo staging (no negocio), filas válidas/rechazadas/duplicadas, cambios antes→después. XLSX/XLSM/CSV, 10MB/5.000 filas, coma decimal española. Plantillas sin ejemplos. `POST /api/import/apply` exige preview_id + confirm:true, propietario/admin, 30min, protección de reutilización y comprobación de conflictos previa. Celdas vacías no borran. Stock requiere coincidencia exacta modelo+acabado. Historial `import_audit` con fichero/usuario/fecha.
- Importaciones quedan `verification_status=pending`, NO automáticamente verificadas. Vehículos/precios/stock pendientes excluidos del RAG confirmado. Documentos PDF pendientes también excluidos. `/importar` conserva importación de tarifas con vista previa; `/documentos` almacena PDF y extrae texto no OCR. Si no hay clave de almacenamiento remoto, guarda archivo binario en Mongo GridFS y descarga autenticada (no disco efímero).
- `.env` local recuperada para Mongo app. IA/correo NO configurados: faltan claves previas y el usuario aprobó dejarlos pendientes. No se han solicitado nuevas claves ni generado consumo de IA.
- `/login`: sin credenciales demo precargadas. Si no hay usuarios, configuración del primer administrador con código secreto BOOTSTRAP_TOKEN + correo/nombre/contraseña de 5–128 caracteres (petición expresa del usuario). Se mantiene todo el formulario. Alta atómica por _id Mongo, se bloquea tras primer usuario, Google no puede saltarse alta inicial. Ver `memory/test_credentials.md`.
- `seed.py` deshabilitado: nunca ejecutar para restaurar demos. `wipe_demo.py` solo borra is_demo:true/data_origin:demo explícitos, no vacía colecciones. La base actual está vacía; no se ha ejecutado borrado indiscriminado.
- No se ha recuperado ni modificado ninguna base de producción. Alcance de esta sesión: copia local/preview.
- Eliminados avisos estáticos demo de login/dashboard/comparador/precios/configuración/ventas/PDF. Sustituidos por advertencias honestas de revisión comercial. Stock sin disponibilidad indicada = No confirmado; vehículo sin combustible/carrocería = No confirmado.
- Verificación inicial: API smoke y typecheck correctos; navegador creó cuenta temporal, consultó ambas fuentes y persistió **33 familias/modelos (16 turismos + 17 comerciales)** con fecha 2026-10-06. Primeras ocho fotografías comprobadas cargando del CDN oficial. Consulta Golf y creación por preview+confirmación comprobadas. El 401 inicial de /auth/me es esperado sin sesión.
- Dato temporal creado en ese recorrido: vehículo Golf / Verificacion temporal, precio 35.020,50 €, fuente verificacion-temporal.csv, estado pending. Tester debe borrar exclusivamente esa fila, precio e historial de prueba y los que genere, además de cuenta temporal/sesiones. Conservar la consulta oficial de 33 modelos. El resultado final debe mantener negocio sin datos ficticios y alta inicial disponible.
- Incidencia posterior a interrupción: GET /auth/setup devolvía required:false porque quedó la cuenta de comprobación (id 9759f1b3-dda4-4fee-b9fd-bbb0f9ca301b); el alta no aparecía. Además POST con contraseña de 5 caracteres devolvía 422/min_length:12. Se cambia el mínimo a 5 en Pydantic, HTML y ayuda. El tester debe retirar únicamente esa cuenta temporal y sus datos de prueba, verificar alta real con 5, rechazo de 4 y cierre del alta tras crear administrador; luego retirar sus usuarios de prueba para entregar el formulario inicial disponible. No alterar cuentas reales si aparecen durante la prueba.

## Última prioridad: Marcos ADMIN, centro de archivos y catálogo automático
- Usuario real confirmado: Marcos Ramos, mxrcosramos@gmail.com, id 4b2ac06e-d3a2-4d66-bd3d-b8ff961a1f5f. Petición explícita: convertir su cuenta a ADMIN sin cambiar contraseña ni acceso Google. Existe nueva cuenta temporal cinco@centrowagen.es (id 0571d796-2991-4915-9327-c5f9b2bdea1b). Solo retirar cuentas de verificación, NUNCA la cuenta real. El alta inicial debe permanecer cerrada mientras exista Marcos (supera la intención anterior de entregar sin usuarios).
- Promoción real ejecutada desde UI el 2026-10-07: mxrcosramos@gmail.com ahora ADMIN, mismo id y acceso. Conservar su rol y cuenta durante todas las pruebas/limpiezas.
- `POST /api/auth/users/{user_id}/promote`: solo ADMIN, cambia únicamente rol, audita actor/fecha en role_changes, idempotente. Configuración > Usuarios: botón Hacer administrador con confirmación. Cache de sesión se actualiza al reenfocar para detectar cambios de rol.
- `/archivos`: Centro de archivos con cuatro pestañas Catálogo, Stock, Tarifas y Documentos PDF; instrucciones, formatos, columnas necesarias y flujo claro. Reutiliza importadores seguros y documentos. `/importar` y `/documentos` redirigen al tab correspondiente; `/gestion` queda para edición manual. Las pestañas descartan previews no confirmadas, no datos guardados.
- Catálogo automático **cada día a las 08:00 Europe/Madrid** mediante cron de plataforma catalogo-vw-diario en .emergent/crons.yml. Consulta turismos y comerciales. `/api/cron/catalog-sync` exige bearer WEBHOOK_CRON_SECRET y envelope válido; acuse 202 inmediato + BackgroundTasks, idempotencia atómica por X-Webhook-Id/run_id en cron_runs. sync_catalog compartido con botón manual; preserva último catálogo y checked_at si falla una fuente, registra error/intento; éxito reemplaza modelos (incluye nuevos encontrados), no modifica negocio ni precios/stock. UI muestra horario, próxima consulta prevista, último éxito y fallo si lo hay.
- .env: separadas correctamente BOOTSTRAP_TOKEN y APP_URL (se detectó concatenación heredada). Se ha añadido secreto de cron, nunca mostrarlo en UI/logs/fixtures.
- No esperar la hora de disparo para verificar: tester debe invocar el webhook con secreto de env, comprobar ejecución completa/duplicados/auth inválida y esquema YAML. Preview watcher aplica el cron; producción solo se reconcilia tras un despliegue, no solicitado.

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

## Referencia histórica de demos (NO existentes en esta base, seed deshabilitado)
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
