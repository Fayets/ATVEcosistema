import { hoursToPriorityBand } from './priority.js'

const areas = ['Ventas', 'Marketing', 'Producto', 'Sistemas', 'ADS']

function t(num, client, area, question, tags, totalH, inAreaH, status, transfers) {
  return {
    id: `tk-${num}`,
    num,
    client,
    area,
    question,
    tags,
    totalHoursOpen: totalH,
    hoursInArea: inAreaH,
    priorityBand: hoursToPriorityBand(totalH),
    status,
    createdAt: new Date(Date.now() - totalH * 3600_000).toISOString(),
    updatedAt: new Date(Date.now() - inAreaH * 3600_000).toISOString(),
    transfers,
  }
}

export const mockTickets = [
  t(
    1042,
    'Lucía M.',
    'Marketing',
    '¿Cómo configuro el embudo de conversión en Meta para el lanzamiento del cohort de abril?',
    ['#meta', '#pixel', '#funnel'],
    2.5,
    1.2,
    'En curso',
    [
      {
        id: 'tr-1',
        at: new Date(Date.now() - 8 * 3600_000).toISOString(),
        fromArea: 'Ventas',
        toArea: 'Marketing',
        by: 'Ana R.',
        note: 'Cliente pregunta por píxeles y eventos; derivamos a MKT.',
      },
    ],
  ),
  t(
    1041,
    'Marco P.',
    'Ventas',
    'Necesito actualizar el contrato y el link de pago para un upgrade a mentoría avanzada.',
    ['#upgrade', '#pago'],
    5.1,
    5.1,
    'Abierto',
    [],
  ),
  t(
    1040,
    'Sofía K.',
    'ADS',
    'Las campañas del conjunto A están con CPA 40% por encima del benchmark. ¿Revisamos creativos?',
    ['#cpa', '#creativos', '#escala'],
    9.8,
    3.0,
    'En curso',
    [
      {
        id: 'tr-2',
        at: new Date(Date.now() - 20 * 3600_000).toISOString(),
        fromArea: 'Marketing',
        toArea: 'ADS',
        by: 'Diego L.',
        note: 'Escalamiento y fatiga de anuncios.',
      },
    ],
  ),
  t(
    1039,
    'Team Nova',
    'Sistemas',
    'El bot de Discord no está asignando el rol automático al completar onboarding.',
    ['#discord', '#bot', '#roles'],
    26.4,
    6.0,
    'Abierto',
    [
      {
        id: 'tr-3',
        at: new Date(Date.now() - 30 * 3600_000).toISOString(),
        fromArea: 'Producto',
        toArea: 'Sistemas',
        by: 'Carla V.',
        note: 'Webhook responde 500 en staging.',
      },
    ],
  ),
  t(
    1038,
    'Julián R.',
    'Producto',
    'Necesito adaptar el flujo de onboarding para el nuevo cohort. ¿Qué pasos cambian?',
    ['#onboarding', '#checklist'],
    1.2,
    1.2,
    'En curso',
    [],
  ),
  t(
    1037,
    'Valentina G.',
    'Marketing',
    'Pedido de copy para secuencia de bienvenida en Discord (3 mensajes).',
    ['#copy', '#bienvenida'],
    7.0,
    7.0,
    'Abierto',
    [],
  ),
  t(
    1036,
    'Nico A.',
    'Ventas',
    'Cliente quiere pausar 30 días y retomar — ¿cómo queda el acceso al canal?',
    ['#pausa', '#acceso'],
    3.4,
    0.5,
    'Resuelto',
    [
      {
        id: 'tr-4',
        at: new Date(Date.now() - 48 * 3600_000).toISOString(),
        fromArea: 'Producto',
        toArea: 'Ventas',
        by: 'Leo F.',
        note: 'Pregunta comercial sobre política de pausa.',
      },
    ],
  ),
  t(
    1035,
    'CRM Beta',
    'Sistemas',
    'Integración Zapier → sheet de leads dejó de sincronizar ayer a las 22:00.',
    ['#zapier', '#leads', '#sync'],
    18.0,
    18.0,
    'En curso',
    [],
  ),
]

export const mockKpis = {
  total: 128,
  open: 34,
  resolvedToday: 12,
  avgResponseMin: 23,
}

export const mockAreaMetrics = areas.map((area, i) => ({
  area,
  received: 42 + i * 7,
  resolved: 28 + i * 5,
  transferred: 9 + i * 2,
}))

export const mockStaff = [
  { id: 's1', name: 'Ana R.', area: 'Marketing', resolved: 38, avgFirstResponseMin: 18, transfersOut: 6 },
  { id: 's2', name: 'Diego L.', area: 'ADS', resolved: 31, avgFirstResponseMin: 22, transfersOut: 11 },
  { id: 's3', name: 'María S.', area: 'Ventas', resolved: 45, avgFirstResponseMin: 15, transfersOut: 4 },
  { id: 's4', name: 'Tomás P.', area: 'Sistemas', resolved: 22, avgFirstResponseMin: 35, transfersOut: 3 },
  { id: 's5', name: 'Carla V.', area: 'Producto', resolved: 27, avgFirstResponseMin: 20, transfersOut: 9 },
]

export const mockAreasConfig = [...areas]

export const mockStaffUsers = [
  { id: 'u1', name: 'Ana R.', email: 'ana@atv.gg', area: 'Marketing' },
  { id: 'u2', name: 'Diego L.', email: 'diego@atv.gg', area: 'ADS' },
  { id: 'u3', name: 'María S.', email: 'maria@atv.gg', area: 'Ventas' },
  { id: 'u4', name: 'Tomás P.', email: 'tomas@atv.gg', area: 'Sistemas' },
]

export const mockDiscordWebhook =
  'https://discord.com/api/webhooks/000000000000000000/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'

export function getMockTicket(id) {
  return mockTickets.find((x) => x.id === id)
}
