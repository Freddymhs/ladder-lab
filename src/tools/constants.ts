/** Nombres de herramientas que otras herramientas citan en sus textos. */
export const HERRAMIENTA_CREAR = 'crear_estampa';
export const HERRAMIENTA_MARCAR_ACTIVA = 'marcar_activa';
export const HERRAMIENTA_ACTIVA_POR_JUEGO = 'activa_por_juego';

/** Comando de Claude Code que replica la configuración activa a otros RTS. */
export const COMANDO_REPLICAR_RTS = '/gameconfig:run-rts';

export const DIFERENCIA_ACTIVA_Y_MATCH =
  'Activa no es match perfecto: la activa es la que Freddy usa hoy (exactamente una por juego, elegida a mano); ' +
  'match perfecto es una marca de calidad del resultado (puede haber muchas en un juego).';

export const PREGUNTAR_ANTES_DE_MARCAR =
  `Antes de enviar marcarActiva=true llama a ${HERRAMIENTA_ACTIVA_POR_JUEGO} y PREGÚNTALE a Freddy cada vez: ` +
  '«¿La marco como la activa de <juego>? (hoy la activa es <id> v<N> del <fecha>)». Sin su sí, no la envíes.';

export const SIGUIENTE_SIN_MARCAR =
  `Si es la configuración que usas, márcala con ${HERRAMIENTA_MARCAR_ACTIVA} (pregúntale antes a Freddy). ` +
  `Para replicarla a otros RTS: ${COMANDO_REPLICAR_RTS}.`;
export const SIGUIENTE_MARCADA = `Para replicarla a otros RTS: ${COMANDO_REPLICAR_RTS}.`;

/** Etiqueta de una estampa en un listado para elegir. */
export const MARCA_ACTIVA = '✔ activa';
export const SEPARADOR_ETIQUETA = ' · ';
export const SIN_ETAPA = 'sin etapa';
/** De dónde sale la fecha de un listado: la del juego o, sin ella, la del registro. */
export const FECHA_DEL_JUEGO = 'juego' as const;
export const FECHA_DEL_REGISTRO = 'registro' as const;
/** Largo de una fecha YYYY-MM-DD al recortar un timestamp ISO. */
export const LARGO_FECHA_ISO = 10;
