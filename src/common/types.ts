import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface TextContent {
  type: 'text';
  text: string;
}

/** El resultado de una herramienta es el del SDK: una sola definición. */
export type ToolResult = CallToolResult;
