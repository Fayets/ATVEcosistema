/**
 * Catálogo de “mini sistemas” del hub ATV.
 * Cada entrada apunta a una ruta bajo `/m/…`; el código del módulo vive en su carpeta
 * (`src/modules/<id>/`) para poder habilitar/deshabilitar o empaquetar por cliente.
 *
 * Imagen en cada cuadrícula: logo en `frontend/public/ATVWhite.png`.
 *
 * status:
 *   - `existe` — módulo disponible en el hub
 *   - `por_construir` — hueco reservado, aún sin producto final
 */
const TILE_IMAGE = '/ATVWhite.png'

export const dashboardTiles = [
  {
    id: 'landing',
    path: 'landing',
    hubPath: 'https://landing.atvos.io/dashboard',
    label: 'ATV LANDING',
    status: 'existe',
    image: TILE_IMAGE,
  },
  {
    id: 'onboarding',
    path: 'onboarding',
    hubPath: '/onboarding',
    label: 'ATV ONBOARDING',
    status: 'existe',
    image: TILE_IMAGE,
  },
  {
    id: 'clientes',
    path: 'clientes',
    hubPath: 'https://clients.atvos.io',
    label: 'ATV CLIENTS',
    status: 'existe',
    image: TILE_IMAGE,
  },
  { id: 'hiring', path: 'hiring', label: 'ATV HIRING', status: 'existe', image: TILE_IMAGE },
  { id: 'ventas', path: 'ventas', label: 'ATV VENTAS', status: 'existe', image: TILE_IMAGE },
  { id: 'marketing', path: 'marketing', label: 'ATV MARKETING', status: 'existe', image: TILE_IMAGE },
  {
    id: 'backbone',
    path: 'backbone',
    hubPath: 'https://backbone.atvos.io',
    label: 'ATV BACKBONE',
    status: 'existe',
    image: TILE_IMAGE,
  },
  { id: 'producto', path: 'producto', label: 'ATV PRODUCTO', status: 'por_construir', image: TILE_IMAGE },
  { id: 'docs', path: 'docs', label: 'ATV DOCS', status: 'por_construir', image: TILE_IMAGE },
]
