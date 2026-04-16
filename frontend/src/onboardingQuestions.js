/**
 * Plantilla por defecto del onboarding (sincronizada con `backend/src/data/onboarding_plantilla_default.json`).
 * La versión en servidor: `GET /entregables/plantillas/onboarding/` (slug `onboarding`).
 * `long: true` → textarea más alto.
 * `optional: true` → puede quedar vacío si no tenés el dato.
 */
export const ONBOARDING_FIELDS = [
  {
    key: 'nombre_real',
    label: 'Nombre real',
    question: '¿Cómo te llamás? Nombre real, no el de usuario.',
    example: 'Ejemplo: «Matías Gómez»',
    long: false,
    optional: false,
  },
  {
    key: 'contacto',
    label: 'WhatsApp y email',
    question: 'Dejá tu WhatsApp y tu email principal.',
    example: 'Ejemplo: «+54 9 11 2345-6789 | ejemplo@gmail.com»',
    long: false,
    optional: false,
  },
  {
    key: 'redes_sociales',
    label: 'Redes activas',
    question:
      'Pasame los links de todas tus redes activas o las de tus clientes en caso de que NO seas el creador (Instagram, YouTube, TikTok, Twitter, podcast, etc.).',
    example:
      'Ejemplo: «Instagram: @tucuenta | YouTube: youtube.com/tucanal | TikTok: @tucuenta | Podcast: El juego invisible en Spotify»',
    long: true,
    optional: false,
  },
  {
    key: 'oferta',
    label: 'Tu oferta',
    question: '¿Cuál es exactamente tu oferta? ¿Qué vendés y por qué alguien debería escucharte?',
    example:
      'Ejemplo: «Mentoría 1 a 1 para creadores que quieren escalar sus ingresos con colaboraciones de alto ticket. No vendo cursos, vendo una transformación acompañada.»',
    long: true,
    optional: false,
  },
  {
    key: 'precio_y_logica',
    label: 'Precio y lógica',
    question: '¿A qué precio estás vendiendo y con qué lógica lo definiste?',
    example:
      'Ejemplo: «1.500 USD. Elegí ese precio porque es el máximo que me han pagado antes y me siento cómodo vendiéndolo.»',
    long: true,
    optional: false,
  },
  {
    key: 'descripcion_producto',
    label: 'Producto en una frase',
    question: '¿Cómo describirías tu producto en una sola oración que no suene a copia de otro curso?',
    example:
      'Ejemplo: «Es un sistema de escalado basado en partnership con influencers, sin necesidad de tener audiencia propia ni invertir en ads.»',
    long: true,
    optional: false,
  },
  {
    key: 'audiencia_dolor',
    label: 'Audiencia y lucha',
    question: '¿A quién le estás hablando? No me des una demografía, decime con qué está luchando esa persona.',
    example:
      'Ejemplo: «Le hablo a emprendedores que ya probaron tener una agencia o vender servicios, pero se dieron cuenta que están atrapados en su propio sistema.»',
    long: true,
    optional: false,
  },
  {
    key: 'nicho_y_diferencial',
    label: 'Nicho y por qué vos',
    question: '¿En qué nicho jugás y qué tan saturado está? ¿Por qué te eligen a vos?',
    example:
      'Ejemplo: «Marketing digital para creadores. Está saturado, pero conecto con los que quieren dejar de ser freelancers y convertirse en socios de negocios.»',
    long: true,
    optional: false,
  },
  {
    key: 'canales_contenido',
    label: 'Canales de contenido',
    question: '¿Dónde estás creando contenido y cuál es tu canal más fuerte?',
    example:
      'Ejemplo: «Instagram y YouTube. Instagram abre más chats, pero YouTube me trae leads más calificados.»',
    long: true,
    optional: false,
  },
  {
    key: 'facturacion_6_meses',
    label: 'Facturación últimos 6 meses',
    question: '¿Cuánto estás facturando en los últimos 6 meses y cuán estable es esa cifra?',
    example:
      'Ejemplo: «Entre 2.000 y 5.000 por mes, pero depende de si cierro un cliente grande o no. No tengo predictibilidad.»',
    long: true,
    optional: false,
  },
  {
    key: 'calendario_contenido',
    label: 'Calendario de contenido',
    question: '¿Tenés un calendario de contenido o subís cuando te pinta?',
    example:
      'Ejemplo: «Subo cuando me inspiro, pero no tengo una estructura semanal. A veces desaparezco una semana.»',
    long: true,
    optional: false,
  },
  {
    key: 'metricas_views',
    label: 'Views promedio',
    question:
      '¿Cuántas views promedio tenés en Reels, en Historias y en YouTube? (Sumá cualquier otra plataforma que uses.)',
    example: 'Ejemplo: «Reels: 1.500 – 3.000. YouTube: entre 200 y 600.»',
    long: true,
    optional: true,
  },
  {
    key: 'chats_por_cta',
    label: 'Chats por CTA',
    question: '¿Cuántos chats estás abriendo en promedio con cada Reel o historia con CTA?',
    example:
      'Ejemplo: «Con cada Reel bueno me escriben 10–15 personas, pero no siempre son del perfil.»',
    long: true,
    optional: true,
  },
  {
    key: 'embudo',
    label: 'Embudo',
    question: '¿Tenés un embudo armado o estás improvisando con cada nuevo lead?',
    example:
      'Ejemplo: «Tengo un Loom con VSL, pero no tengo proceso. Mando el mismo mensaje a todos.»',
    long: true,
    optional: false,
  },
  {
    key: 'medios_adquisicion',
    label: 'Medios de adquisición',
    question: '¿Cuáles son tus medios de adquisición más efectivos hoy?',
    example: 'Ejemplo: «Contenido en Instagram + respuestas en historias + cierre por chat.»',
    long: true,
    optional: false,
  },
  {
    key: 'chats_por_semana',
    label: 'Chats por semana',
    question: '¿Cuántos chats abrís por semana?',
    example: 'Ejemplo: «15 a 20 chats nuevos. No todos calificados.»',
    long: false,
    optional: true,
  },
  {
    key: 'tasa_agenda_y_asistencia',
    label: 'Agenda y asistencia',
    question: '¿Qué porcentaje agenda llamada? ¿Y qué porcentaje asiste?',
    example: 'Ejemplo: «Agendan el 30%. De los que agendan, aparece el 60%.»',
    long: true,
    optional: true,
  },
  {
    key: 'tasa_cierre',
    label: 'Tasa de cierre',
    question: '¿Cuál es tu tasa de cierre real? (No la que te gustaría tener.)',
    example: 'Ejemplo: «Cierro 1 de cada 10 que se presentan.»',
    long: false,
    optional: true,
  },
  {
    key: 'proceso_setting',
    label: 'Proceso de setting',
    question: '¿Tenés un proceso de setting definido o cada setter hace lo que quiere?',
    example:
      'Ejemplo: «No tengo setters, hago todo yo. Y a veces ni contesto los mensajes rápido.»',
    long: true,
    optional: false,
  },
  {
    key: 'filtraje_leads',
    label: 'Filtraje de leads',
    question: '¿Cómo filtrás leads? ¿O hablás con cualquiera?',
    example: 'Ejemplo: «Solo vendo si veo que ya tienen algo andando. Si no, ni pierdo tiempo.»',
    long: true,
    optional: false,
  },
  {
    key: 'estructura_venta',
    label: 'Quién vende y cómo',
    question: '¿Quién vende? ¿Qué estructura de venta usás?',
    example: 'Ejemplo: «Yo hago todo: chat, llamada y cierre. Sin estructura.»',
    long: true,
    optional: false,
  },
  {
    key: 'seguimiento_leads',
    label: 'Seguimiento a leads',
    question: '¿Tenés un proceso de seguimiento o los leads se enfrían al toque?',
    example:
      'Ejemplo: «A los que no me compran les dejo de hablar. No tengo CRM ni seguimiento.»',
    long: true,
    optional: false,
  },
  {
    key: 'experiencia_post_compra',
    label: 'Experiencia post-compra',
    question: '¿Qué experiencia tiene un cliente desde que compra hasta que empieza?',
    example:
      'Ejemplo: «Le mando un correo con el link a un grupo de Telegram y después coordino las llamadas por WhatsApp.»',
    long: true,
    optional: false,
  },
  {
    key: 'que_incluye_programa',
    label: 'Qué incluye el programa',
    question: '¿Qué incluye exactamente tu programa?',
    example:
      'Ejemplo: «6 llamadas 1 a 1 + acceso a videos grabados + soporte por Telegram.»',
    long: true,
    optional: false,
  },
  {
    key: 'clientes_activos_y_progreso',
    label: 'Clientes activos y progreso',
    question: '¿Cuántos clientes activos tenés hoy y cómo medís su progreso?',
    example:
      'Ejemplo: «5 activos. Medimos solo por ingresos generados, pero no tengo un sistema.»',
    long: true,
    optional: false,
  },
  {
    key: 'capacidad_escala',
    label: 'Capacidad de escala',
    question: '¿Cuánta gente más podrías tomar sin que se te caiga el servicio?',
    example:
      'Ejemplo: «Podría llevar 10, pero tendría que dejar de crear contenido.»',
    long: true,
    optional: false,
  },
  {
    key: 'metricas_actuales',
    label: 'Qué medís hoy',
    question: '¿Estás midiendo algo o te guiás por intuición?',
    example:
      'Ejemplo: «Anoto cosas en Notion, pero la mayoría me guío por sensación.»',
    long: true,
    optional: true,
  },
  {
    key: 'herramientas',
    label: 'Herramientas',
    question: '¿Qué herramientas estás usando para operar? (Skool, GHL, Zapier, etc.)',
    example:
      'Ejemplo: «Uso Skool para comunidad, Calendly para llamadas y Telegram para soporte.»',
    long: true,
    optional: false,
  },
  {
    key: 'equipo',
    label: 'Equipo',
    question: '¿Quiénes están en tu equipo hoy? ¿Qué hace cada uno y cuánto gana?',
    example:
      'Ejemplo: «Tengo un editor que cobra $200 por mes y una chica que me ayuda con los chats a comisión.»',
    long: true,
    optional: false,
  },
  {
    key: 'toma_decisiones',
    label: 'Decisiones',
    question: '¿Quién está tomando decisiones? ¿O todo pasa por vos?',
    example:
      'Ejemplo: «Todo lo decido yo. A veces me consultan, pero tengo la última palabra.»',
    long: true,
    optional: false,
  },
  {
    key: 'freno_actual',
    label: 'Qué te frena',
    question: '¿Qué sentís que te está frenando hoy?',
    example:
      'Ejemplo: «Me cuesta escalar porque no delego. También dudo de si realmente soy bueno o tuve suerte.»',
    long: true,
    optional: false,
  },
  {
    key: 'objetivo_4_meses',
    label: 'Objetivo 4 meses',
    question: '¿Cuál es tu verdadero objetivo en los próximos 4 meses?',
    example:
      'Ejemplo: «Facturar 10k al mes de forma estable, sin tener que vender todos los días por Instagram.»',
    long: true,
    optional: false,
  },
  {
    key: 'objetivo_1_anio',
    label: 'Objetivo 1 año',
    question: '¿Dónde te gustaría estar en 1 año y qué estás dispuesto a sacrificar para llegar?',
    example:
      'Ejemplo: «Vivir solo de revenue share con 3–4 influencers top. Estoy dispuesto a dejar de crear contenido todos los días.»',
    long: true,
    optional: false,
  },
  {
    key: 'que_probaste_antes',
    label: 'Qué probaste antes',
    question: '¿Qué probaste antes de ATV y por qué creés que no funcionó?',
    example:
      'Ejemplo: «Tuve una agencia, pero dependía de cada cliente. Nunca supe construir algo que escale solo.»',
    long: true,
    optional: false,
  },
  {
    key: 'por_que_atv',
    label: 'Por qué ATV',
    question: '¿Por qué creés que con ATV lo vas a solucionar?',
    example:
      'Ejemplo: «Porque vi los videos de YouTube de Juan y me di cuenta que era mi problema» o «Vi el caso de éxito de X y le pasaba lo mismo que a nosotros».',
    long: true,
    optional: false,
  },
]

/** Claves que pueden enviarse vacías (métricas / datos que a veces no existen). */
export const ONBOARDING_OPTIONAL_KEYS = new Set(
  ONBOARDING_FIELDS.filter((f) => f.optional).map((f) => f.key),
)

/** Copia estable de la plantilla por defecto (misma referencia que `ONBOARDING_FIELDS`). */
export const DEFAULT_ONBOARDING_FIELDS = ONBOARDING_FIELDS

export function emptyRespuestasFromFields(fieldList) {
  return Object.fromEntries(fieldList.map((f) => [f.key, '']))
}

export function emptyRespuestas() {
  return emptyRespuestasFromFields(ONBOARDING_FIELDS)
}
