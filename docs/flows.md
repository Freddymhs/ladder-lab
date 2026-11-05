# Flow Validation Document — ladder-lab

> Documento mantenido manualmente. Describe cómo funciona la app para el usuario final.
> Llenar cada flujo después de probarlo. Útil como guía para `/tools:testing:run-browser-testing`.
> Aquí no hay interfaz web: el «usuario» es Freddy hablando con Claude Code en el PC de juegos, y los pasos son llamadas a herramientas MCP.
>
> Última actualización: 2026-11-05 (flujos de F1 llenados con lo verificado automáticamente; cada flujo dice qué falta contra el servidor real)

---

## Convenciones

- **Precondiciones**: qué debe existir antes de ejecutar el flujo
- **Pasos**: acciones del usuario (navegar, click, escribir, etc.)
- **Resultado esperado**: qué ve/obtiene el usuario al completar
- **Casos borde**: situaciones alternativas relevantes

---

## Módulo: Acceso y primer uso (F0–F1)

### Flujo: primer uso, conectar Claude Code al servidor

**Precondiciones:**

- Servidor desplegado, token generado y proyecto Supabase con la migración aplicada (runbook, secciones 1 a 6)
- Tailscale activo en el PC de juegos

**Pasos:**

1. `claude mcp add --transport http --scope user ladder-lab http://<host-tailscale>:3000/mcp --header "Authorization: Bearer <TOKEN>"`
2. Abrir Claude Code y ejecutar `/mcp`

**Resultado esperado:**

- ladder-lab aparece conectado
- Se listan 5 herramientas: crear_estampa, corregir_estampa, ver_estampa, listar_estampas, exportar (más las de F2 y F3 cuando estén desplegadas)

**Casos borde:**

- Sin Tailscale activo: no hay respuesta (esperado)
- Token mal copiado: el servidor responde 401

**Verificación:** tools/list y conexión con el cliente del SDK por HTTP real, con pruebas automáticas (src/http/**tests**, src/tools/**tests**). contra el servidor desplegado y el Supabase real: **pendiente** (exige credenciales; ver docs/runbooks/PUESTA_EN_MARCHA.md).

---

### Flujo: conexión sin token o con token incorrecto

**Precondiciones:**

- Servidor HTTP en marcha

**Pasos:**

1. Pedir `POST /mcp` sin cabecera Authorization
2. Repetir con `Authorization: Bearer basura`
3. Repetir con un token de otra longitud

**Resultado esperado:**

- Las tres dan 401 con `WWW-Authenticate: Bearer` y sin ningún detalle
- El log registra el rechazo pero nunca el token

**Casos borde:**

- `GET /mcp` sin token también da 401 (no 405): sin token no se revela nada
- `/healthz` responde 200 sin token y sin datos

**Verificación:** 12 casos de auth y 6 de HTTP en pruebas automáticas, con el caso rojo hecho a propósito (isAuthorized devolviendo siempre true). Contra el servidor corriendo en contenedor local: 401 y 200 comprobados con curl. Contra el Mac Mini: pendiente.

---

### Flujo: reconectar tras reiniciar el servidor o Claude Code

**Precondiciones:**

- Cliente ya registrado

**Pasos:**

1. Reiniciar el contenedor (`docker restart ladder-lab`)
2. Ejecutar cualquier herramienta desde Claude Code

**Resultado esperado:**

- Funciona sin volver a registrar nada: el servidor es sin estado (DECISION_TRANSPORTE_HTTP.md)

**Casos borde:**

- Dos clientes conectados a la vez funcionan
- Un reinicio no pierde datos: viven en Supabase

**Verificación:** dos clientes simultáneos y reconexión tras cerrar otro, con el cliente real del SDK sobre HTTP real. Reinicio del contenedor en el Mac Mini: pendiente.

---

## Módulo: Registro de estampas (F1)

### Flujo: crear una estampa completa

**Precondiciones:**

- Servidor conectado

**Pasos:**

1. Pedir a Claude que registre una estampa con todos los datos (juego, género, etapa o fecha, mouse en un solo texto, DPI, polling, resolución, Hz, posición y aceleración de Windows, sensibilidad, raw input, rango, certeza)

**Resultado esperado:**

- Responde "Estampa creada." con el id, versión 1 de 1 y la estampa completa

**Casos borde:**

- Mouse es un solo texto con marca y modelo (no dos campos)
- Con una fecha inexistente (2025-02-30) se rechaza

**Verificación:** herramienta, esquema y contrato del repositorio (doble en memoria y Supabase vía PostgREST real). contra el servidor desplegado y el Supabase real: **pendiente** (exige credenciales; ver docs/runbooks/PUESTA_EN_MARCHA.md).

---

### Flujo: crear una estampa con datos desconocidos o que no aplican

**Precondiciones:**

- Servidor conectado

**Pasos:**

1. Registrar una estampa donde el DPI no se recuerda y el juego (RTS) no tiene sensibilidad ni raw input

**Resultado esperado:**

- Se guarda con `"desconocido"` en el DPI y `"no_aplica"` en sensibilidad y rawInput
- Un campo opcional no registrado simplemente no aparece

**Casos borde:**

- `desconocido` se acepta en los obligatorios salvo nombre del juego, género y certeza
- `no_aplica` solo en sensibilidad y rawInput; en otro campo se rechaza
- Nunca `null`

**Verificación:** 68 casos de esquema (cada campo con desconocido, no_aplica y rechazo donde no corresponde) y contrato del repositorio. contra el servidor desplegado y el Supabase real: **pendiente** (exige credenciales; ver docs/runbooks/PUESTA_EN_MARCHA.md).

---

### Flujo: crear una estampa con datos inválidos o incompletos

**Precondiciones:**

- Servidor conectado

**Pasos:**

1. Intentar registrar con género `MOBA`, sin etapa ni fecha, o con una clave sobrante como `juegoDelLogro`

**Resultado esperado:**

- Se rechaza con un mensaje que dice qué campo falla
- No se guarda nada

**Casos borde:**

- Género `desconocido` se rechaza (solo FPS o RTS)
- Sin etapa ni fecha: "Indica al menos la etapa o la fecha"

**Verificación:** pruebas de herramienta con repositorio vacío tras cada rechazo. contra el servidor desplegado y el Supabase real: **pendiente** (exige credenciales; ver docs/runbooks/PUESTA_EN_MARCHA.md).

---

### Flujo: registrar una configuración distinta en otra etapa del mismo juego

**Precondiciones:**

- Existe una estampa del juego

**Pasos:**

1. Registrar la configuración nueva con `crear_estampa` (no con `corregir_estampa`)
2. Opcionalmente, indicar `derivadaDe` con el id de la estampa de la que parte

**Resultado esperado:**

- Hay dos estampas independientes; la primera no cambia
- `derivadaDe` apunta a una estampa existente (puede ser de otro juego)

**Casos borde:**

- `derivadaDe` a un id que no existe: se rechaza
- La descripción de `crear_estampa` advierte que otra etapa es OTRA estampa

**Verificación:** pruebas de herramienta y contrato (derivadaDe existente, inexistente y de otro juego). contra el servidor desplegado y el Supabase real: **pendiente** (exige credenciales; ver docs/runbooks/PUESTA_EN_MARCHA.md).

---

## Módulo: Corrección y versiones (F1)

### Flujo: corregir un dato de una estampa

**Precondiciones:**

- Existe una estampa

**Pasos:**

1. Pedir a Claude que corrija un dato (p. ej. el DPI)
2. Pedir `ver_estampa` y luego `exportar` con versiones

**Resultado esperado:**

- Responde que ahora va en la versión 2 y que la versión 1 se conserva
- La exportación con versiones trae las dos

**Casos borde:**

- Solo se envían los campos que cambian
- No se puede quitar un campo opcional ya registrado
- Si otra sesión corrigió entre tanto, falla en vez de pisar (conflicto de versión)

**Verificación:** pruebas de herramienta, contrato y SQL real: la versión 1 queda intacta y la base rechaza UPDATE/DELETE. contra el servidor desplegado y el Supabase real: **pendiente** (exige credenciales; ver docs/runbooks/PUESTA_EN_MARCHA.md).

---

### Flujo: corregir sin cambiar nada

**Precondiciones:**

- Existe una estampa

**Pasos:**

1. Corregir con el mismo valor que ya tiene, o con `cambios` vacío

**Resultado esperado:**

- Se rechaza: "no cambia ningún dato"
- No se crea una versión nueva

**Casos borde:**

- Un cambio que deja la estampa inválida también se rechaza sin tocar nada

**Verificación:** pruebas de herramienta. contra el servidor desplegado y el Supabase real: **pendiente** (exige credenciales; ver docs/runbooks/PUESTA_EN_MARCHA.md).

---

## Módulo: Consulta (F1)

### Flujo: ver una estampa

**Precondiciones:**

- Existe una estampa

**Pasos:**

1. Pedir `ver_estampa` con el id

**Resultado esperado:**

- Muestra la versión vigente, su número y cuántas versiones tiene
- Indica si está archivada

**Casos borde:**

- Id inexistente: "No existe una estampa con id …"
- Id que no es uuid: se rechaza en la entrada
- Las versiones anteriores se ven con `historial_versiones` o en `exportar`

**Verificación:** pruebas de herramienta y contrato. contra el servidor desplegado y el Supabase real: **pendiente** (exige credenciales; ver docs/runbooks/PUESTA_EN_MARCHA.md).

---

### Flujo: listar estampas por juego o género

**Precondiciones:**

- Existen estampas de varios juegos

**Pasos:**

1. `listar_estampas` sin filtros
2. Repetir con `juego` y con `genero`

**Resultado esperado:**

- Resumen compacto, de la más reciente a la más antigua por fecha; las sin fecha al final
- El filtro por juego no distingue mayúsculas

**Casos borde:**

- Lista vacía: no es un error
- Paginación con `limite` y `desplazamiento`, y `hayMas` avisa si hay otra página
- Un nombre con % o \_ no actúa como patrón

**Verificación:** pruebas de herramienta y contrato, incluido el orden y la paginación contra PostgREST real. contra el servidor desplegado y el Supabase real: **pendiente** (exige credenciales; ver docs/runbooks/PUESTA_EN_MARCHA.md).

---

## Módulo: Exportación y no perder datos (F1)

### Flujo: exportar todo y comprobar que reconstruye los datos

**Precondiciones:**

- Existen estampas

**Pasos:**

1. `exportar` sin parámetros

**Resultado esperado:**

- Un envoltorio `ladder-lab.export` versión 1 con un arreglo de documentos
- Cada documento lleva su `id`, también sin versiones
- Cada `derivadaDe` se resuelve contra un `id` del mismo envoltorio

**Casos borde:**

- Base vacía: envoltorio con arreglo vacío
- Incluye las estampas archivadas, marcadas con `archivada: true`
- Es el JSON que consume el convertidor

**Verificación:** contrato contra el fixture publicado docs/formato/ejemplos/export-vigentes.json. contra el servidor desplegado y el Supabase real: **pendiente** (exige credenciales; ver docs/runbooks/PUESTA_EN_MARCHA.md).

---

### Flujo: exportar incluyendo versiones anteriores

**Precondiciones:**

- Existe una estampa con al menos una corrección

**Pasos:**

1. `exportar` con `incluirVersiones: true`

**Resultado esperado:**

- La estampa aparece una vez por versión, cada una con `numeroVersion`
- Con esto se puede reconstruir todo sin la base

**Casos borde:**

- Sin `incluirVersiones` no aparece `numeroVersion`
- Con más de 500 estampas se pide a la base por páginas

**Verificación:** contrato contra docs/formato/ejemplos/export-con-versiones.json y paginación de 520 estampas contra PostgREST real. contra el servidor desplegado y el Supabase real: **pendiente** (exige credenciales; ver docs/runbooks/PUESTA_EN_MARCHA.md).

---

### Flujo: intentar borrar una estampa o una versión

**Precondiciones:**

- Existe una estampa

**Pasos:**

1. Pedir a Claude que borre una estampa
2. Intentar `delete` o `update` directo por SQL sobre las tablas

**Resultado esperado:**

- No existe ninguna herramienta que borre: Claude no puede hacerlo
- Por SQL, la base rechaza con LL010 (UPDATE, DELETE y TRUNCATE de versiones; DELETE y TRUNCATE de estampas)

**Casos borde:**

- `service_role` no tiene permiso de DELETE ni TRUNCATE
- Un superusuario podría quitar los triggers: la protección es contra accidentes y errores de la aplicación

**Verificación:** SQL real contra Postgres y contra la imagen oficial de Supabase, con el caso rojo hecho a propósito (migración sin el trigger: 4 pruebas fallan). Contra el proyecto Supabase real: pendiente.

---

## Módulo: Conclusiones (F2, bloqueada)

### Flujo: comparar dos estampas del mismo juego

**Precondiciones:**

- (por llenar)

**Pasos:**

1. (por llenar)

**Resultado esperado:**

- (por llenar)

**Casos borde:**

- (por llenar)

---

### Flujo: ver el historial de versiones de una estampa

**Precondiciones:**

- (por llenar)

**Pasos:**

1. (por llenar)

**Resultado esperado:**

- (por llenar)

**Casos borde:**

- (por llenar)

---

## Módulo: Cuidado de datos (F3)

### Flujo: archivar una estampa y verificar que no se pierde

**Precondiciones:**

- (por llenar)

**Pasos:**

1. (por llenar)

**Resultado esperado:**

- (por llenar)

**Casos borde:**

- (por llenar)

---

### Flujo: restaurar un respaldo en una base vacía

**Precondiciones:**

- (por llenar)

**Pasos:**

1. (por llenar)

**Resultado esperado:**

- (por llenar)

**Casos borde:**

- (por llenar)

---

### Flujo: importar un JSON exportado

**Precondiciones:**

- (por llenar)

**Pasos:**

1. (por llenar)

**Resultado esperado:**

- (por llenar)

**Casos borde:**

- (por llenar)

---
