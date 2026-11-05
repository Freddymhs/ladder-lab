import type { ToolResult } from './types.js';

export function toolSuccess(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

export function toolJson(payload: unknown): ToolResult {
  return toolSuccess(JSON.stringify(payload, null, 2));
}

export function toolError(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}
