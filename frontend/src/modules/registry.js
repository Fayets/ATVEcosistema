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
    id: 'onboarding',
    path: 'onboarding',
    hubPath: '/onboarding',
    label: 'ATV ONBOARDING',
    status: 'existe',
    image: TILE_IMAGE,
  },
  { id: 'clientes', path: 'clientes', label: 'ATV CLIENTS', status: 'existe', image: TILE_IMAGE },
  { id: 'finanzas', path: 'finanzas', label: 'ATV FINANZAS', status: 'por_construir', image: TILE_IMAGE },
  { id: 'producto', path: 'producto', label: 'ATV PRODUCTO', status: 'por_construir', image: TILE_IMAGE },
  { id: 'ventas', path: 'ventas', label: 'ATV VENTAS', status: 'existe', image: TILE_IMAGE },
  { id: 'marketing', path: 'marketing', label: 'ATV MARKETING', status: 'existe', image: TILE_IMAGE },
  { id: 'discord', path: 'discord', label: 'ATV DISCORD', status: 'por_construir', image: TILE_IMAGE },
  { id: 'docs', path: 'docs', label: 'ATV DOCS', status: 'por_construir', image: TILE_IMAGE },
]
