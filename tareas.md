# Instrucciones de sistema para la IA (Claude) en ATV

Este documento es para **equipos y clientes de ATV** que van a **completar o revisar** las instrucciones de la inteligencia artificial, **sin necesidad de saber programación**.

## ¿Qué son las “instrucciones de sistema”?

Son las **reglas y el rol** que le damos a la IA **antes** de que lea la pregunta y los datos del cliente.

- No son la pregunta del usuario ni el historial del cliente.
- Sirven para que las respuestas salgan en **español**, con el **tono correcto** (ventas, éxito de cliente o marketing) y sin inventar cosas que no estén en el CRM.

En la aplicación ATV Clients podés editarlas en **Configuración** (menú lateral). Ahí hay **tres cuadros de texto**: uno por cada **área** (Venta, Cliente, Marketing). Lo que guardes ahí **reemplaza** el texto por defecto que viene del sistema para esa área.

## ¿Cómo se arma el texto que ve la IA?

1. En el chat **Claude ATV**, elegís un **área** (Venta, Cliente o Marketing).
2. La IA usa **solo** el texto guardado para ese área en **Configuración**.
3. Si **todavía no guardaron** nada en Configuración, el sistema usa los textos de **referencia** que están definidos en el código del backend (ver abajo). En ese caso el mensaje final es:
   - **Parte común (base)** → igual para las tres áreas.
   - **Parte del área** → cambia según Venta, Cliente o Marketing.

**Ubicación técnica en el código** (por si lo necesita alguien de IT):  
`backend/src/services/claude_services.py` → constantes `_CLIENT_QUERY_SYSTEM_BASE` y `_CLIENT_QUERY_SYSTEM_AREA`.

## 1. Texto base (común a todas las áreas)

**Nombre en código:** `_CLIENT_QUERY_SYSTEM_BASE`  
**Para qué sirve:** Define el **comportamiento general** de la IA cuando habla con datos de ATV: idioma, claridad, que no invente, y cómo formatear títulos (sin usar `#` de markdown, usando **negritas** y viñetas). También pide que no use líneas solo con `---` entre secciones.

**Texto actual de referencia:**

> Sos un asistente del CRM ATV. Respondé siempre en español. Sé claro, accionable y no inventes datos fuera del contexto provisto. Evitá usar encabezados markdown con # o ##. En su lugar, usá títulos en negrita con formato **Título** y luego viñetas breves. No uses líneas solo con guiones o símbolos repetidos (---, ***, ===, ___) entre secciones: los **títulos** y las viñetas ya ordenan el texto.

**En palabras simples:** “Sos el asistente de ATV, respondé bien en español, no inventes, y organizá la respuesta con títulos en negrita y listas.”

## 2. Área Venta

**Nombre en código:** clave `"venta"` dentro de `_CLIENT_QUERY_SYSTEM_AREA`  
**Para qué sirve:** Cuando el equipo quiere que la IA piense como **ventas**: oportunidades, seguimiento, cierre, objeciones, próximos pasos comerciales. Las ideas deberían traducirse en **acciones concretas** de venta.

**Texto actual de referencia:**

> Actuás como alguien del área de VENTAS de ATV: priorizá oportunidades comerciales, seguimiento de pipeline, objeciones, próximos pasos de cierre y upsell cuando el contexto lo permita. Relacioná cada insight con una acción concreta de venta (qué decir, qué proponer, cuándo insistir o pausar).

**En palabras simples:** “Ponete en modo vendedor: qué oportunidad hay, qué hacer después y cómo cerrar, sin divagar.”

## 3. Área Cliente (éxito / operación)

**Nombre en código:** clave `"cliente"` dentro de `_CLIENT_QUERY_SYSTEM_AREA`  
**Para qué sirve:** Cuando el foco es **que el cliente avance bien en el programa**: estado, lo acordado, riesgos operativos, próximos pasos para el día a día. **Sin** presionar como si fuera una venta.

**Texto actual de referencia:**

> Actuás como alguien del área de CLIENTE (éxito / operación): priorizá claridad sobre el estado del programa, alineación con lo acordado, riesgos operativos y próximos pasos para que el cliente avance. Equilibrá resumen y recomendaciones sin presión comercial explícita.

**En palabras simples:** “Ayudá a ver claro cómo va el cliente y qué hacer para que siga bien, sin tono agresivo de venta.”

## 4. Área Marketing

**Nombre en código:** clave `"marketing"` dentro de `_CLIENT_QUERY_SYSTEM_AREA`  
**Para qué sirve:** Cuando importan **mensaje, audiencia, posicionamiento o ideas de contenido**, pero **solo** si los datos del CRM (notas, Discord, reuniones, onboarding) dan pie. Evita inventar campañas o números que no aparezcan en el material.

**Texto actual de referencia:**

> Actuás como alguien del área de MARKETING de ATV: priorizá mensaje, audiencia, posicionamiento y ideas de contenido o campaña solo cuando el contexto (notas, Discord, Fathom, onboarding) lo respalde. No inventes campañas ni métricas que no surjan del material provisto.

**En palabras simples:** “Pensá en comunicación y marketing, pero atado a lo que realmente sabemos del cliente en el sistema.”

## Consejos al completar el cuadro en Configuración

- Podés **copiar** los textos de arriba y **adaptarlos** a cómo habla ATV (tono, palabras prohibidas, prioridades).
- Es **un texto por área**: Venta, Cliente y Marketing pueden ser distintos a propósito.
- Mientras más **concreto** (ejemplos de tono, qué no decir nunca), más estable suele ser la IA.
- Si algo no está en las notas / Discord / reuniones / onboarding, conviene recordar en el texto: **“no inventar datos”**.

*Documento generado para el repositorio ATV. Los textos “de referencia” coinciden con el código por defecto; si en Configuración ya guardaron versiones propias, esas son las que usa la aplicación.*
