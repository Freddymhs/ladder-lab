# FASE 4: INTEGRACIÓN CON EL CONVERTIDOR

**Prioridad**: Baja
**Dependencias**: FASE_1 con el formato v1 congelado (tarea 1.12) y que exista el convertidor (producto separado, fuera de este repo)
**Origen**: concepto, F4. El único vínculo entre los dos productos es el JSON versionado: no comparten base, código ni despliegue.

> Este repo no construye el convertidor ni calcula sensibilidad («Qué no es»). F4 solo garantiza que el JSON que sale de aquí sea consumible y que sus cambios no rompan al otro lado sin aviso. Riesgo del concepto: «cambios de formato sin versión».
> Se detalla cuando exista el contrato del convertidor. Hoy no se conoce qué campos necesita ni cómo recibe el JSON.

## Estado de ejecución (2026-11-05)

**Hecha y verificada contra el código real de sens-lab.** Lo que queda necesita datos reales o sens-lab en ejecución.

| Tarea                                       | Estado                                                                                                                                                                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 Especificación publicada del formato v1 | hecha: `docs/formato/ladder-lab.estampa.v1.md`, con una prueba que obliga a que coincida con el esquema campo por campo                                                                                                          |
| 4.2 Política de versionado y migración      | hecha: `DECISION_VERSIONADO_FORMATO.md` (sin carpeta de migraciones: no hay v2)                                                                                                                                                  |
| 4.3 Verificación contra el convertidor real | hecha con su importador y mapeo reales: `DECISION_INTEGRACION_CONVERTIDOR.md`, `scripts/verificar-con-sens-lab.sh` (12 comprobaciones y controles rojos). **Falta:** sens-lab en ejecución y una exportación con estampas reales |

## Orden de ejecución

1. Tarea 4.1 — especificación publicada del formato (base de las otras dos)
2. Tarea 4.2 — política de versionado y migración (sobre 4.1)
3. Tarea 4.3 — verificación contra el convertidor real (necesita que el convertidor exista)

## Tareas

### Tarea 4.1: Especificación publicada del formato v1

- Archivo: `docs/formato/ladder-lab.estampa.v1.md` (crear), fixtures en `docs/formato/ejemplos/` (crear)
- Que hacer: documentar el formato congelado en 1.12 de forma que quien escriba el convertidor no tenga que leer el código: cada campo, valores especiales, ejemplo completo y ejemplos con `desconocido`/`no_aplica`. Los fixtures son los mismos que usa el test de contrato de `exportar` (una sola copia, no dos; SSOT). Esta especificación es lo que el convertidor lee, no el esquema Zod (no comparten código).
- Referencia: `docs/decisions/DECISION_FORMATO_ESTAMPA_V1.md` (F1).

### Tarea 4.2: Política de versionado y migración del formato

- Archivo: `docs/decisions/DECISION_VERSIONADO_FORMATO.md` (crear); `src/domain/estampa/migraciones/` (crear solo si surge una v2)
- Que hacer: definir qué es un cambio compatible (campo opcional nuevo, sin subir `version`) y qué no (renombrar/quitar/cambiar tipo: sube `version` y trae un migrador v1→v2). Decidir cuántas versiones atrás acepta `importar_json` (F3). No inventar una v2 hasta que haga falta.

### Tarea 4.3: Verificación contra el convertidor real

- Archivo: `docs/decisions/DECISION_INTEGRACION_CONVERTIDOR.md` (crear)
- Que hacer: con el convertidor funcionando, pasar un `exportar` real por él y registrar el resultado; si el convertidor necesita algo que el formato no da, se discute como cambio de formato (4.2), no como parche. Definir cómo viaja el archivo del PC de juegos al convertidor (el servidor no escribe archivos: `exportar` devuelve texto al cliente).

## Criterios de Aceptacion

- [x] La especificación del formato v1 está publicada con ejemplos y sirve sin leer el código.
- [x] Existe una política escrita de versionado y migración.
- [ ] Un `exportar` real fue consumido por el convertidor y el resultado quedó registrado. **Parcial:** salidas reales del código de ladder-lab (doble en memoria) pasaron por el importador real de sens-lab; **falta una exportación con estampas reales** y sens-lab en ejecución.
- [x] Cambiar el formato sin subir `version` es imposible por construcción: la tabla publicada debe coincidir con el esquema, los fixtures deben validar y reproducir `exportar`, y el contrato con sens-lab falla si se rompe.
