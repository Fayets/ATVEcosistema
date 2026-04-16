# Estilo visual: pantalla de login ATV

Referencia para mantener la misma línea estética al tocar el login (frontend React en `frontend/`). La implementación vive principalmente en `frontend/src/App.css` y `frontend/src/App.jsx`.

## Objetivo de la pantalla

- **Tema:** oscuro, marca **rojo + negro** (ATV).
- **Sensación:** algo **cinematográfica / gaming**: fondo negro, humo rojo muy suave, logo con “corte de luz”, CTA roja fuerte.
- **Legibilidad:** texto claro sobre inputs oscuros; el humo **no** debe tapar ni competir con el formulario.

## Estructura (clases)

| Área        | Clase              | Rol |
|------------|--------------------|-----|
| Contenedor | `.login-page`      | Pantalla completa; fondo con **gradientes fijos** (misma lógica que `.atv-shell`). Sin pseudo-elementos con blur. |
| Contenido  | `.login-main`      | Centrado flex, `z-index: 1` sobre el fondo. |
| Bloque UI  | `.login-card`      | Columna centrada, `max-width: 22rem`, espacio vertical entre logo y form. |
| Logo       | `.login-card__logo`| `frontend/public/ATVLogin.png` (ruta en JSX: `/ATVLogin.png`). Tamaño base **88px**. |
| Formulario | `.login-form`      | Columna, `gap` entre campos. |
| Campos     | `.login-input`     | Contenedor del icono + input. |
| CTA        | `.login-submit`    | Botón **Ingresar**, pill, gradiente rojo. |

## Fondo y atmósfera

- **Rendimiento:** evitar **`filter: blur()`** grande en capas `::before`/`::after` animadas: en muchos equipos genera **jank** (repaints costosos). El fondo ATV usa **gradientes radiales + lineales fijos** en `.login-page` / `.atv-shell` (sin blur, sin animación de fondo).
- **Color base:** tono casi negro (`#020203`) y degradés oscuros en los bordes para encuadrar el contenido.
- **Rojo de marca:** varios `radial-gradient` suaves (sin `mix-blend-mode` animado) para sensación “gaming” sin cargar la GPU.

### Fondo con imagen (opcional)

Si querés máximo control artístico o un humo muy fino **sin** costo de blur en runtime:

1. Exportá un asset oscuro con humo/rojo ya integrado (WebP o JPG), p. ej. **`frontend/public/ATV-atmosphere.webp`**.
2. En el contenedor raíz del login o del dashboard, sumá la clase **`atv-shell--foto`** junto con `.login-page` o `.atv-shell` (ver reglas en `App.css`). Eso aplica `url('/ATV-atmosphere.webp')` con una viñeta encima para legibilidad.

Si no usás la clase, solo aplican los gradientes (comportamiento por defecto).

## Logo

- Archivo: **`frontend/public/ATVLogin.png`**.
- Tamaño visual: **88×88** (aprox.), `object-fit: contain`.
- **Glow:** `drop-shadow` rojo **fijo** (no se anima el `filter` en cada keyframe: eso era muy caro).
- **Animación `logo-light-cut`:** ~**4.2s**, bucle infinito; solo cambia **opacidad** con tiempos **irregulares** (efecto “fallo eléctrico” suave), no un parpadeo metrónomo.

## Tipografía

- **`DM Sans`** cargada en `frontend/index.html` (Google Fonts); fallback en `frontend/src/index.css` en `body`.

## Formulario

- **Campos:** fondo `rgba(12, 12, 14, 0.92)`, borde sutil claro, `border-radius` ~`0.65rem`, iconos SVG a la izquierda en gris suave.
- **Texto:** `#f2f0f7`; placeholders discretos `rgba(180, 178, 190, 0.55)`.
- **Focus:** borde / sombra con acento **rojo** (`rgba(255, 70, 90, …)`), sin abandonar el look oscuro.

## Botón “Ingresar” (CTA)

- **Forma:** ancho completo del formulario, **`border-radius: 9999px`** (pill).
- **Gradiente vertical:** `#ff3d4d` → `#e01828` → `#9a0612`.
- **Texto:** blanco, `font-weight: 600`, leve `letter-spacing`.
- **Sombra:** glow rojo + sombra hacia abajo + highlight interno suave.
- **Separación del campo de contraseña:** **`margin-top: 1.1rem`** en `.login-submit` (antes quedaba muy pegado; no volver a `0.35rem` salvo que se pida explícitamente).

## Accesibilidad y movimiento

- **`prefers-reduced-motion: reduce`:** desactivar la animación del **logo** (`.login-card__logo` y `.dashboard-header__logo`); el `drop-shadow` del logo queda fijo.
- Etiquetas de campos: texto oculto visualmente con `.visually-hidden` donde corresponda.

## Archivos a tocar al iterar

| Archivo | Uso |
|---------|-----|
| `frontend/src/App.jsx` | Estructura del login, textos, rutas de assets. |
| `frontend/src/App.css` | Todo el estilo descrito arriba. |
| `frontend/src/index.css` | Reset mínimo, altura viewport, fuente base. |
| `frontend/index.html` | Título, `lang="es"`, fuente DM Sans. |
| `frontend/public/ATVLogin.png` | Logo del login. |
| `frontend/public/ATV-atmosphere.webp` | (Opcional) Fondo con humo; activar con clase `atv-shell--foto` en el contenedor. |

## Checklist rápido al cambiar algo

- [ ] El fondo sigue leyéndose **oscuro** y el rojo **sutil** (no “lava roja”); sin blur pesado salvo decisión explícita.
- [ ] El **logo** y el **CTA** siguen siendo el foco; el fondo es ambiente.
- [ ] **Contraste** de inputs y botón aceptable en tema oscuro.
- [ ] **`prefers-reduced-motion`** sigue respetado si hay nuevas animaciones.

---

*Última alineación con el código en `frontend/src/App.css` (fondo por gradientes / modo foto, logo solo-opacidad, CTA). Si cambiás valores clave en CSS, actualizá este documento en la misma PR.*
