# DECISION: Cómo cambia el formato JSON sin romper a sens-lab ni a un respaldo viejo

Fecha: 2026-11-05 (tarea 4.2 de FASE_4)

## Qué dice el concepto

El JSON versionado es la **única conexión** con el convertidor, y el riesgo declarado es «cambios de formato sin versión». Hoy existe la versión 1 (`docs/formato/ladder-lab.estampa.v1.md`) y sens-lab ya la consume.

## Qué es compatible y qué no

**Compatible (se queda en `version: 1`):** agregar un campo **opcional** nuevo. Condición: los consumidores **ignoran los campos que no conocen** (regla 2 de la especificación). sens-lab ya lo hace: su esquema descarta lo que no usa.

**Incompatible (sube a `version: 2`):** cualquiera de estas:

- renombrar o quitar un campo;
- cambiar el tipo, el rango o el significado de un campo (incluido el significado de `desconocido`/`no_aplica`);
- volver obligatorio un campo opcional;
- **agregar un valor a un enum** (p. ej. un tercer género): un consumidor que lo trata de forma exhaustiva se rompería. Se trata como incompatible por defecto;
- cambiar la forma del envoltorio o el significado de `id`, `numeroVersion` o `archivada`.

## Qué hace falta para una v2

1. Un ADR nuevo que diga qué cambia y por qué.
2. Un **migrador puro v1→v2** en `src/domain/estampa/migraciones/` (esa carpeta **no existe todavía a propósito**: no se inventa una v2 hasta que haga falta).
3. La especificación nueva `ladder-lab.estampa.v2.md`, con sus fixtures. La v1 **se conserva**.
4. `exportar` escribe siempre la versión actual; el consumidor elige qué versiones soporta.
5. Pasar `scripts/verificar-con-sens-lab.sh` (el contrato real contra el código de sens-lab) y actualizar sens-lab antes de publicar.

## Cuántas versiones atrás acepta `importar_json` y `restaurar`

**La actual y todas las anteriores que tengan un migrador registrado. Nunca se descarta una sin aviso.** Motivo: un respaldo es de larga vida; el día que haga falta restaurar uno de hace un año tiene que poder leerse. Una versión desconocida (hoy, cualquiera distinta de 1) se **rechaza con un mensaje que dice qué llegó y qué se soporta**, antes de tocar la base: ya está implementado y probado (`validarEnvoltorio`). La columna `version_formato` de cada versión guardada dice con qué formato se escribió, para que un migrador futuro sepa qué convertir.

## Mientras el formato no esté congelado

El formato **no está congelado** hasta que Freddy lo marque con datos reales (tarea 1.12). Hasta entonces puede cambiar sin subir la versión **solo si**: se actualizan la especificación, los fixtures y las pruebas (la prueba `formato-publicado.spec.ts` obliga), y se pasa el contrato contra sens-lab. Después de congelarlo rige todo lo de arriba.

## Cómo se protege (por construcción)

- La tabla de la especificación debe coincidir **campo por campo** con el esquema (`formato-publicado.spec.ts`): cambiar el esquema sin tocar el documento falla.
- Los fixtures publicados se validan contra el esquema y reproducen exactamente la salida de `exportar`.
- El contrato real contra sens-lab (`scripts/verificar-con-sens-lab.sh`) con controles rojos: versión futura, formato equivocado y JSON truncado deben ser rechazados.

## Qué queda abierto

- Si los instantes de creación entran al formato (campos opcionales nuevos, compatibles con v1).
