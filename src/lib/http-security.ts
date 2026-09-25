import { authConfig } from "./config";
export function validMutationOrigin(request: Request): boolean {
  return request.headers.get("origin") === authConfig().origin;
}
export async function boundedJson(request: Request, maxBytes = 4096): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Invalid body");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Invalid body");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error("Invalid body"); }
      chunks.push(result.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally { reader.releaseLock(); }
}
