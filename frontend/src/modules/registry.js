/**
 * Catálogo de “mini sistemas” del hub ATV.
 * Cada entrada apunta a una ruta bajo `/m/…`; el código del módulo vive en su carpeta
 * (`src/modules/<id>/`) para poder habilitar/deshabilitar o empaquetar por cliente.
 *
 * Imagen en cada cuadrícula: logo en `frontend/public/ATVWhite.png`.
 */
const TILE_IMAGE = '/ATVWhite.png'

export const dashboardTiles = [
  { id: 'clientes', path: 'clientes', label: 'ATV CLIENTS', type: 'module', image: TILE_IMAGE },
  { id: 'finanzas', path: 'finanzas', label: 'ATV FINANZAS', type: 'module', image: TILE_IMAGE },
  { id: 'producto', path: 'producto', label: 'ATV PRODUCTO', type: 'module', image: TILE_IMAGE },
  { id: 'ventas', path: 'ventas', label: 'ATV VENTAS', type: 'module', image: TILE_IMAGE },
  { id: 'marketing', path: 'marketing', label: 'ATV MARKETING', type: 'module', image: TILE_IMAGE },
  { id: 'proximo-1', path: 'proximo/1', label: '?', type: 'placeholder', image: TILE_IMAGE },
  { id: 'proximo-2', path: 'proximo/2', label: '?', type: 'placeholder', image: TILE_IMAGE },
  { id: 'proximo-3', path: 'proximo/3', label: '?', type: 'placeholder', image: TILE_IMAGE },
]
