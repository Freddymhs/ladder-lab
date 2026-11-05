# DECISION: La compuerta de F2 se levanta por orden, sin las 10 estampas reales

Fecha: 2026-11-05

## Qué dice el concepto

«Sin datos reales no se construye F2: F1 debe estar en uso antes.» Riesgo declarado: **sobrediseño**, comparaciones antes de tener datos. El 2026-11-05 Freddy fijó el umbral en **10 estampas reales** y el orden F3 antes que F2.

## Qué se hizo

Freddy ordenó completar todas las fases y levantó la compuerta de F2 **por orden suya, sin que existan datos reales**. Se construye F2 igual, con estas consecuencias asumidas y escritas aquí para que no se pierdan:

- **No hay ni una estampa real.** F1 está implementada y probada en local, pero no desplegada ni usada. F2 se probó solo con datos de prueba.
- **El riesgo de sobrediseño se acepta, no se resuelve.** Las salidas de `comparar_estampas`, `historial_versiones`, `mejor_por_juego` y `matches_perfectos` son una primera forma elegida sin haber visto datos reales; esperar que haya que ajustarlas cuando Freddy las use.
- **Los índices de F2 no se midieron con datos reales** (`DECISION_INDICES_F2.md`): hay una medición con datos sintéticos, que dice poco sobre un uso real.
- **Qué sigue valiendo:** el umbral de 10 estampas reales sigue siendo el criterio para revisar F2 (ajustar o recortar herramientas que no se usen), no para construirla.

## Qué queda abierto

- Revisar F2 con datos reales cuando existan las 10 estampas.
