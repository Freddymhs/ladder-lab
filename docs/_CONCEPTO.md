> Origen: DEVELOPMENT/concept-ladder-lab.md (ideación)

# Concepto: ladder-lab

Fecha: 2026-11-05. Destino: proyecto nuevo. Salida de `/work:resume:new-concept`.

## Propósito

Registrar en una línea de tiempo qué configuración usó Freddy en cada juego competitivo y qué rendimiento logró con ella, para recuperar y mejorar su nivel en ranked, en FPS y RTS. Son horas de juego convertidas en datos: no se pueden perder.

## Qué es

- Un servidor MCP personal para un solo usuario.
- Una base histórica de **estampas**: fotos de una configuración de Windows y de juego, ligadas a un juego y a un resultado.
- La fuente de origen de un convertidor separado, a través de un JSON versionado.

## Qué no es

- No calcula ni convierte sensibilidad. Eso es del convertidor.
- No recomienda ni juzga cuál configuración es mejor.
- No toca el mouse, Windows ni archivos de juegos.
- No tiene interfaz web, cuentas ni usuarios múltiples.

## Modelo de dominio

**Estampa:** unidad principal, una por juego y momento. Cada estampa es independiente.

```text
Estampa
├── Juego: juego, género (FPS o RTS), etapa o fecha
├── Sistema: mouse (marca y modelo), DPI, polling, resolución, Hz, posición de Windows, aceleración de Windows
├── En el juego: sensibilidad, raw input, parámetros de inicio, MarkC
└── Resultado: rango, juego del logro, match perfecto, certeza
```

**Obligatorios:** juego, género, etapa o fecha, mouse, DPI, polling, resolución, Hz, posición de Windows, aceleración de Windows, sensibilidad, raw input, rango y certeza.

**Opcionales:** versión de Windows, parámetros de inicio, MarkC, notas y `derivadaDe`.

**Árbol:** `derivadaDe` indica la estampa que dio origen a otra, por ejemplo una conversión probada en otro juego. Es opcional y va en el formato JSON.

**Valores especiales:** todo campo obligatorio acepta `desconocido`. Si no corresponde, como raw input en algunos RTS, acepta `no_aplica`.

**Certeza:** `medido` significa comprobado en ese momento; también `recordado` y `estimado`.

**Versiones:**

- Corregir un dato crea una versión nueva y conserva la anterior.
- Una configuración distinta en otra etapa es una estampa nueva.
- Ninguna estampa se borra de verdad: se archiva.

## Formato común

JSON versionado, documentado con esquema Zod. Es la única conexión con el convertidor. Los dos productos no comparten base, código ni despliegue.

```json
{
  "formato": "ladder-lab.estampa",
  "version": 1,
  "derivadaDe": "<id de otra estampa, opcional>",
  "juego": { "nombre": "Counter-Strike", "genero": "FPS" },
  "sistema": { "mouse": "Modelo", "dpi": 450, "windows": 4 },
  "enJuego": { "sensibilidad": null, "rawInput": "apagado" },
  "resultado": { "rango": "Global", "certeza": "recordado" }
}
```

## Fases

**F1, protegida:** registrar y no perder. Herramientas `crear_estampa`, `corregir_estampa`, `ver_estampa`, `listar_estampas` y `exportar`. Incluye esquema, versiones, formato JSON y despliegue.

**F2:** obtener conclusiones. `comparar_estampas`, `mejor_por_juego`, `matches_perfectos` y `historial_versiones`.

**F3:** cuidar los datos. Archivar, respaldo programado e importar desde JSON.

**F4:** integración con el convertidor.

Sin datos reales no se construye F2: F1 debe estar en uso antes.

## Stack

| pieza      | decisión                            | fuente                |
| ---------- | ----------------------------------- | --------------------- |
| Base       | `template-mcp`, TypeScript, Node 22 | `[feature]`           |
| Transporte | Streamable HTTP en Mac Mini M1      | `[feature]`           |
| Acceso     | solo Tailscale, con token           | `[feature]`           |
| Datos      | proyecto Supabase propio            | `[feature]`           |
| Cliente    | `supabase-js` con migraciones SQL   | `[feature]` `[norte]` |
| Validación | Zod                                 | `[feature]`           |
| Pruebas    | Vitest                              | `[feature]`           |

**Flujo:** se desarrolla en el ThinkPad, se despliega en el Mac Mini y se usa desde Claude Code del PC de juegos.

## Practice-wishlist

- SQL e índices `[norte]`.
- TypeScript avanzado `[norte]`.

## Fuera de alcance v1

Interfaz web, cuentas, recomendaciones, conversión de sensibilidad, sincronización automática con juegos, y lectura automática de configuraciones.

## Riesgos

- **Sobrediseño:** comparaciones antes de tener datos. Se mitiga protegiendo F1.
- **Registro con datos pobres:** recuerdos incompletos. Se mitiga con `desconocido` y certeza.
- **Dependencia de Supabase:** se mitiga con `exportar` desde F1.
- **Mac Mini:** decisión de Freddy. Por su incidente de seguridad pendiente, el proyecto usa una base y credenciales propias, sin compartir con otros sistemas.
- **Conexión con el convertidor:** cambios de formato sin versión. Se mitiga con el campo `version`.
