type Tool = { name: string; title: string; description: string; inputSchema: object; execute: (input: unknown) => Promise<unknown> };
type Context = { registerTool: (tool: Tool & { annotations: { readOnlyHint: boolean; untrustedContentHint: boolean } }, options: { signal: AbortSignal }) => void | Promise<void> };
export function registerPageTool(tool: Tool) {
  const context = (document as Document & { modelContext?: Context }).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  try { void Promise.resolve(context.registerTool({ ...tool, annotations: { readOnlyHint: false, untrustedContentHint: true } }, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Progressive enhancement: the forms remain available. */ }
  return () => lifecycle.abort();
}
