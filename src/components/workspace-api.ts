export class WorkspaceRequestError extends Error {
  constructor(message: string, readonly fields: string[] = []) { super(message); }
}
export async function workspaceRequest<T>(path: string, method: "POST" | "PATCH" | "DELETE", data?: unknown): Promise<T> {
  const response = await fetch(path, { method, headers: data === undefined ? undefined : { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const payload = await response.json() as { error?: string; fields?: string[] } & T;
  if (!response.ok) throw new WorkspaceRequestError(payload.error ?? "No se pudieron guardar los cambios.", payload.fields ?? []);
  return payload;
}
