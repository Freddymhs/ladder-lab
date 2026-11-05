# DECISION: Integración con el convertidor (sens-lab) — verificada con su código real

Fecha: 2026-11-05 (tarea 4.3 de FASE_4)

## Qué se verificó

`scripts/verificar-con-sens-lab.sh` pasa **salidas reales de ladder-lab** por el **importador y el mapeo reales de sens-lab** (importados en solo lectura desde `../sens-lab`; no se modificó nada de ese proyecto), y valida en sentido inverso los fixtures de sens-lab contra el esquema de ladder-lab. **12 comprobaciones, todas en verde:**

- sens-lab importa un documento suelto, la exportación normal, el respaldo con versiones y los cuatro fixtures publicados.
- sens-lab **puede citar el `id` de la estampa de origen** (`estampaOrigenId`), que es la razón de que toda exportación lleve `id`.
- sens-lab no inventa lo que falta: una estampa con DPI `desconocido`, sensibilidad `no_aplica` y un juego fuera de su catálogo se mapea con `faltantes: [juego, sensibilidad, dpi, camino]`.
- ladder-lab **acepta** la exportación que sens-lab usa como válida, y **rechaza** lo que sens-lab también rechaza (versión futura, campo inválido, formato equivocado).
- **Controles rojos**: versión 2, formato equivocado y JSON truncado son rechazados por sens-lab con su código de error esperado. Y si la exportación **perdiera los `id`**, la verificación sale con código 1 (probado quitándolos a propósito).

Esto cierra el riesgo del concepto «cambios de formato sin versión» en lo que se puede probar sin datos reales: cualquier cambio de formato que rompa al convertidor hace fallar el script.

## Hallazgos

1. **Se encontró y corrigió un defecto de F1** al escribir la especificación publicada: los campos de texto aceptaban las palabras reservadas como texto cualquiera (`juego.nombre: "desconocido"`, `mouse: "no_aplica"`), contra lo que decía el ADR del formato. Ahora el esquema las rechaza donde corresponde, y una prueba comprueba cada celda de la tabla publicada contra el comportamiento real.
2. **El respaldo con versiones cuenta cada versión como una estampa en sens-lab** (3 entradas para 2 estampas, porque una está en 2 versiones). sens-lab debe recibir la **exportación normal**, no el respaldo; es lo que su documentación asume. Anotado, no se cambia nada en sens-lab.
3. **sens-lab comparte el proyecto Supabase de ladder-lab** (esquema `sens_lab` aparte), por decisión de Freddy (`sens-lab/docs/decisions/DECISION_ESQUEMA_SENS_LAB.md`). Eso contradice lo que decía el runbook de ladder-lab («proyecto solo para ladder-lab»), que se corrigió. Consecuencias que Freddy debería tener presentes:
   - **Una sola clave `service_role` abre los dos esquemas.** Cada servidor usa solo el suyo por código, pero la clave no lo impide. Las migraciones de ladder-lab dejan a `service_role` sin `DELETE` ni `TRUNCATE` en sus tablas.
   - **El respaldo de ladder-lab no cubre `sens_lab`** (candidatas y calibraciones): sens-lab tiene su propia exportación.
   - **La pausa por inactividad y la ausencia de copias del plan gratuito afectan a los dos productos a la vez.**
   - El ajuste «Exposed schemas» de la API del proyecto lo comparten.
4. **Cómo viaja un JSON del PC de juegos a sens-lab:** `exportar` devuelve el texto al cliente (Claude Code en el PC); sens-lab lo recibe pegado en el navegador y no lo sube a ningún lado. Se copia, no se transfiere un archivo.

## Qué no se verificó

- sens-lab **en ejecución** (su interfaz y sus pruebas de extremo a extremo) ni desplegado; solo su importador y su mapeo.
- Un `exportar` hecho contra un Supabase real con estampas reales de Freddy.

## Cómo repetirlo

```bash
scripts/verificar-con-sens-lab.sh        # SENS_LAB_DIR=<ruta> si no está en ../sens-lab
```

Sale con 0 si todo coincide, 1 si algo del contrato se rompe y 2 si no encuentra sens-lab (en ese caso **no verificó nada**, y lo dice).

## Qué queda abierto

- Repetir la verificación con una exportación real cuando existan las estampas reales.
- Decidir si sens-lab debe rechazar o deduplicar un respaldo con versiones (cambio en el otro proyecto).
