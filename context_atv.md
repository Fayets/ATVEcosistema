# Contexto ATV — para continuar el desarrollo (ChatGPT / asistentes)

Documento de handoff del estado del proyecto **ATV** (backend FastAPI + Pony ORM, frontend React). Úsalo como contexto inicial en nuevas conversaciones.

---

## Objetivo del producto

CRM de clientes para la empresa, con programas **Boost** y **Mentoria Avanzada** modelados como campo `programa` en el cliente (no como entidades separadas ni CRUD de “instancias de programa”). La base debe servir después a un flujo de **IA** (ya existe integración con Claude en el backend; vista **IA** en el front es placeholder).

---

## Stack y rutas del repo

| Capa | Tecnología |
|------|------------|
| Backend | Python, **FastAPI**, **Pony ORM**, PostgreSQL (`psycopg2`), Pydantic v2, `python-decouple` para `.env` |
| Frontend | **React** (Vite), React Router, `fetch` + `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`) |

- Backend entry: `backend/main.py` — `init_db()` en lifespan.
- Modelos Pony: `backend/src/models.py`
- Schemas: `backend/src/schemas.py`
- Servicio clientes: `backend/src/services/clientes.py`
- Rutas clientes: `backend/src/controllers/clientes.py`
- **Discord (documento por cliente):** `backend/src/services/discord_services.py`, `backend/src/controllers/discord_controller.py`
- **Fathom (transcripts):** `backend/src/controllers/fathom_controller.py` + servicios asociados
- DB central: `backend/src/db.py`
- API front: `frontend/src/api.js`
- Vista módulo clientes: `frontend/src/modules/clients/ClientsHome.jsx`
- Estilos relacionados: `frontend/src/App.css` (clases `clients-*`)
- Convenciones backend: `docs/convenciones-backend-pony.md`

---

## Entidad `Cliente` (Pony)

Campos relevantes:

- `id`: UUID (PK)
- `nombre`: obligatorio
- `apellido`, `telefono`, `instagram`, `notas`: opcionales (`nullable=True` en modelo donde aplica)
- `email`, `origen`: siguen en el modelo/DB por historia; **el API de cliente actual no expone email/origen** en Pydantic (solo lo que está en `ClienteResponse`)
- `programa`: string requerido, default `"boost"` — valores válidos en API: **`boost`** | **`mentoria_avanzada`**
- `estado`: default `"activo"` (métricas front: activo / inactivo)
- `created_at`, `updated_at`; `before_update` actualiza `updated_at`
- Relación **1:1** opcional **`DiscordDocumento`** (`discord_documento` en `Cliente`, borrado en cascada)

No hay entidades `Boost` / `MentoriaAvanzada` ni FKs a programas: fue simplificado a un solo campo.

---

## Entidad `DiscordDocumento` (Pony)

- Un documento de texto por cliente (`contenido` almacenado como string; tope ~**2.000.000** caracteres en servicio).
- Los **bloques** se concatenan con separador de línea: `\n\n--- [YYYY-MM-DD HH:MM:SS UTC] ---\n\n` (fecha UTC al hacer append).
- El front parte el contenido por ese patrón para mostrar **tarjetas** estilo Fathom (sin volcar el texto crudo en la grilla); lectura/edición en modal.

---

## API REST — Clientes

Prefijo típico: `/clientes` (router con `prefix="/clientes"`).

- `POST /clientes/` — crear (body según `ClienteCreate`)
- `GET /clientes/?skip=&limit=` — listar paginado (**importante: barra final `/`** para evitar **307 Redirect** de FastAPI/Starlette)
- `GET /clientes/{id}` — detalle
- `PUT /clientes/{id}` — actualización parcial (`ClienteUpdate`)
- `DELETE /clientes/{id}` — borrar

Autenticación: el front envía `Authorization: Bearer <jwt>` (`sessionStorage` clave `atv_token`) en las llamadas de `api.js`.

Errores: el controlador puede incluir el mensaje de excepción en el `detail` del 500 para depuración.

---

## API REST — Discord (documento del cliente)

Prefijo: `/discord` (barra final en rutas como el resto del front).

- `GET /discord/clientes/{cliente_id}/documento/` — obtiene o crea documento vacío (`DiscordDocumentoResponse`)
- `POST /discord/clientes/{cliente_id}/documento/append/` — body `{ "texto": "..." }` — agrega bloque (validación Pydantic: texto 1…**2.000.000** caracteres, alineado al tope del documento)
- `PUT /discord/clientes/{cliente_id}/documento/blocks/{block_index}/` — body `{ "texto": "..." }` — reemplaza el bloque en el índice (0 = primer segmento entre separadores)
- `DELETE /discord/clientes/{cliente_id}/documento/blocks/{block_index}/` — elimina ese bloque y recompone el documento conservando marcas de tiempo entre bloques restantes

Schemas: `DiscordDocumentoAppend`, `DiscordDocumentoBlockEdit`, `DiscordDocumentoResponse` en `schemas.py`.

---

## API REST — Fathom (transcripts por cliente)

- Listado / CRUD de transcripts asociados al cliente (ver `fathom_controller` y `frontend/src/api.js`: `listFathomTranscripts`, `createFathomTranscript`, etc.).
- La UI dentro de la carpeta **Fathom** del cliente incluye buscador, Crear/Editar/Eliminar y tarjetas tipo documento.

---

## Pydantic — qué expone el cliente

Ver `ClienteBase` / `ClienteCreate` / `ClienteUpdate` / `ClienteResponse` en `schemas.py`:

- Incluye: `nombre`, `apellido`, `telefono`, `instagram`, `programa`, `estado`, `notas`, timestamps en response.
- **No** incluye en el contrato actual: `email`, `origen`.
- Validador `programa`: solo `boost` o `mentoria_avanzada` (normalizado a minúsculas).

---

## Base de datos y migraciones “a mano”

En `src/db.py`, `_run_postgres_schema_patches()`:

- Detecta la tabla `cliente` (case-insensitive).
- `ADD COLUMN IF NOT EXISTS programa` con default `boost`, actualiza filas vacías.
- `ALTER COLUMN ... DROP NOT NULL` en columnas opcionales alineadas al modelo.

`db.generate_mapping(create_tables=True)` al iniciar.

---

## Compatibilidad Pony + Python 3.13

Evitar `select(c for c in Cliente)` en listados amplios; usar **`Cliente.select()`** y luego **`.to_list()`** (o paginación sobre la query) para no chocar con incompatibilidades del iterador/query en 3.13.

---

## Frontend — módulo ATV Clients (`ClientsHome.jsx`)

Vistas por estado `activeView`:

| Vista | Contenido |
|-------|-----------|
| `dashboard` | Métricas: **Clientes**, **Activos**, **Inactivos** |
| `boost` | Lista tipo “carpetas” de clientes con `programa === 'boost'`: borde rojo, **buscador por nombre**, menú ⋮ con **Eliminar cliente** + `confirm` |
| `mentoria` | Mismo estilo para `mentoria_avanzada`; cabecera “Mentoria” y subtítulo **“Clientes Mentoria”**; **sin** buscador |
| `cliente-knowledge` | **Carpeta del cliente** (al hacer clic en la tarjeta): subvistas **overview** (carpetas Fathom / Discord / Entregables), **Fathom**, **Discord**, **entregables** (placeholder) |
| `crear-cliente` | Formulario CRM: sin email/origen; `programa` select Boost/Mentoría; teléfono y notas opcionales |
| `ia` | Placeholder |

### Lista Boost / Mentoria — tarjetas cliente

- Toda la **zona izquierda** de la tarjeta (hasta el menú ⋮) es un **`button`** (`.clients-folder-card__main`): clic en el **espacio vacío** o en el nombre abre la vista **conocimiento** del cliente (`openClienteKnowledge`).
- Menú **⋮**: popover con **Eliminar cliente**. Con menú abierto, **clic fuera** o **Escape** cierra el menú (`useEffect` + `data-cliente-menu-root` + `pointerdown` en captura en `document`).

### Vista conocimiento — Discord

- Documento único con bloques separados en backend; en UI: **buscador**, acciones **Crear** (foco al textarea de agregar), **Editar** / **Eliminar** (requiere bloque seleccionado en la grilla).
- **Strip** opcional de encabezado de exportación de Discord (líneas hasta el primer mensaje con fecha) al mostrar y al guardar append/edición.
- Modal: lectura del bloque; edición con textarea y **Guardar** → `PUT`; eliminar desde toolbar → `DELETE` + confirmación.
- URLs en `api.js`: barra final en rutas Discord.

### Vista conocimiento — Fathom

- Toolbar (buscar + Crear/Editar/Eliminar), grilla de tarjetas, modales de alta/edición/lectura según el flujo ya implementado.

Sidebar (sin texto “ATV Suite”): **Dashboard**, **Boost**, **Mentoria**, **Crear cliente**, **IA**.

Listado global: `listClientes({ skip: 0, limit: 100 })` — URL debe ser **`/clientes/?...`**.

---

## Qué ya no existe (no reintroducir sin decisión)

- CRUD separado de entidades “Boost” / “Mentoria Avanzada” ni routers dedicados.
- Columnas `boost_id` / `mentoria_avanzada_id` en el modelo actual (patches viejos eliminados del flujo actual).

---

## Próximos pasos posibles (no implementados o parcial)

- Carpeta **Entregables** del cliente (placeholder en UI).
- Enriquecer vista **IA** con contexto de cliente (`ClaudeClientContextRequest` y similares ya en schemas).
- Métricas adicionales en dashboard cuando se definan reglas de negocio.
- Paridad UX entre Boost y Mentoria (p. ej. buscador en Mentoria) si se pide explícitamente.

---

## Comandos útiles

- Backend (desde carpeta `backend`): `uvicorn main:app --reload`
- Frontend: `npm run build` / `npm run dev` según `package.json`

---

*Última actualización: abril 2026 — handoff coherente con código (cliente-knowledge, Discord, Fathom, menú cliente).*
