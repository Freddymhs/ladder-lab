import { TRANSPORT_STDIO } from '@config/constants.js';

/**
 * Debe importarse PRIMERO en cada comando de línea (respaldo, restaurar): los
 * módulos se evalúan en orden de importación, así que esto corre antes de que
 * `@config` lea el entorno. Esos comandos no sirven HTTP; que la imagen traiga
 * MCP_TRANSPORT=http no debe exigirles un MCP_AUTH_TOKEN que no usan.
 */
process.env.MCP_TRANSPORT = TRANSPORT_STDIO;
