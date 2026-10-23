import { DataAdapter, requestUrl } from "obsidian";
import workerCode from "./local-worker.js?worker";
import type { EmbeddingProvider } from "./embeddings";

export const LOCAL_MODEL = "Xenova/multilingual-e5-small";
export const ORT_VERSION = "1.22.0-dev.20250409-89f8206ba4";
export const ORT_WASM_URL = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort-wasm-simd-threaded.wasm`;
export const ORT_WASM_SHA256 = "f061472c6e77d6d50d079aacdc0ff9b63fee287ddd2cbf46cf62438d3891de2b";
export const LOCAL_CACHE = ".gmvault/cache/models";
const CACHE = LOCAL_CACHE;
const IDLE = 5 * 60 * 1000;
const BATCH = 8;

export type Extractor = ((texts: string[], options: { pooling: "mean"; normalize: boolean }) => Promise<{ dims: number[]; data: Float32Array }>) & { dispose?: () => Promise<unknown> };
export interface LocalHooks { onProgress(percent: number): void; onReady(): void }

const sha256 = async (data: ArrayBuffer): Promise<string> => [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))].map(byte => byte.toString(16).padStart(2, "0")).join("");
const cacheFile = (url: string): string => `${CACHE}/${url.replace(/^https?:\/\//, "").replace(/[^A-Za-z0-9._-]+/g, "_")}`;

async function ensureFolder(adapter: DataAdapter, folder: string): Promise<void> {
  let current = "";
  for (const part of folder.split("/")) {
    current = current ? `${current}/${part}` : part;
    if (!await adapter.exists(current)) await adapter.mkdir(current);
  }
}

async function runtimeBinary(adapter: DataAdapter, announce: () => void): Promise<ArrayBuffer> {
  const path = `${CACHE}/ort-wasm-simd-threaded-${ORT_VERSION}.wasm`;
  if (await adapter.exists(path)) {
    const cached = await adapter.readBinary(path);
    if (await sha256(cached) === ORT_WASM_SHA256) return cached;
  }
  announce();
  let response;
  try { response = await requestUrl({ url: ORT_WASM_URL, throw: false }); }
  catch (error) { throw new Error(`The local embedding runtime could not be downloaded: ${error instanceof Error ? error.message : String(error)}`); }
  if (response.status >= 400) throw new Error(`The local embedding runtime could not be downloaded (${response.status}).`);
  if (await sha256(response.arrayBuffer) !== ORT_WASM_SHA256) throw new Error("The downloaded local embedding runtime failed its integrity check.");
  await ensureFolder(adapter, CACHE);
  await adapter.writeBinary(path, response.arrayBuffer);
  return response.arrayBuffer;
}

async function downloadFile(url: string, onProgress: (percent: number) => void): Promise<ArrayBuffer | null> {
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok || !response.body) throw new Error(`The local embedding model could not be downloaded (${response.status}).`);
  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0, reported = -1;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    const percent = total > 5_000_000 ? Math.floor(loaded / total * 100) : -1;
    if (percent > reported) { reported = percent; onProgress(percent); }
  }
  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  return buffer.buffer;
}

export async function loadExtractor(adapter: DataAdapter, model: string, hooks: LocalHooks, code = workerCode): Promise<Extractor> {
  let downloaded = false;
  const announce = (): void => { if (!downloaded) { downloaded = true; hooks.onProgress(0); } };
  const wasmBinary = await runtimeBinary(adapter, announce);
  const file = async (url: string): Promise<ArrayBuffer | null> => {
    const path = cacheFile(url);
    if (await adapter.exists(path)) return adapter.readBinary(path);
    announce();
    const buffer = await downloadFile(url, percent => { if (percent >= 0) hooks.onProgress(percent); });
    if (!buffer) return null;
    await ensureFolder(adapter, CACHE);
    await adapter.writeBinary(path, buffer);
    return buffer;
  };
  const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  const pending = new Map<number, { resolve: (vectors: { dims: number[]; data: Float32Array }) => void; reject: (error: Error) => void }>();
  let nextId = 0;
  let failure: Error | null = null;
  const ready = new Promise<void>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent) => {
      const message = event.data as { type: string; id: number; url: string; dims: number[]; data: Float32Array; message: string };
      if (message.type === "file") {
        file(message.url).then(buffer => worker.postMessage({ type: "file", id: message.id, buffer }, buffer ? [buffer] : []), error => {
          failure = error instanceof Error ? error : new Error(String(error));
          worker.postMessage({ type: "file", id: message.id, buffer: null });
        });
      } else if (message.type === "ready") resolve();
      else if (message.type === "result") { pending.get(message.id)?.resolve({ dims: message.dims, data: message.data }); pending.delete(message.id); }
      else if (message.type === "error") {
        const error = failure ?? new Error(message.message);
        if (message.id === undefined) reject(error);
        else { pending.get(message.id)?.reject(error); pending.delete(message.id); }
      }
    };
    worker.onerror = event => {
      const error = new Error(event.message || "The local embedding worker failed.");
      reject(error);
      for (const entry of pending.values()) entry.reject(error);
      pending.clear();
    };
  });
  worker.postMessage({ type: "init", model, wasmBinary }, [wasmBinary]);
  try { await ready; }
  catch (error) { worker.terminate(); throw error; }
  if (downloaded) hooks.onReady();
  const extract = ((texts: string[]) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ type: "embed", id, texts });
  })) as Extractor;
  extract.dispose = async () => {
    worker.terminate();
    for (const entry of pending.values()) entry.reject(new Error("The local embedding worker was stopped."));
    pending.clear();
  };
  return extract;
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly id: string;
  dimensions = 0;
  private extractor: Promise<Extractor> | null = null;
  private idle?: ReturnType<typeof setTimeout>;
  constructor(private readonly load: () => Promise<Extractor>, private readonly model = LOCAL_MODEL) { this.id = `local:${model}`; }
  async embedDocuments(texts: string[]): Promise<Float32Array[]> { return this.embed(texts.map(text => this.prefix("passage", text.split("\u0000", 2).filter(Boolean).join("\n")))); }
  async embedQuery(text: string): Promise<Float32Array> { return (await this.embed([this.prefix("query", text)]))[0]; }
  private prefix(kind: "query" | "passage", text: string): string { return /e5/i.test(this.model) ? `${kind}: ${text}` : text; }
  private async embed(texts: string[]): Promise<Float32Array[]> {
    this.extractor ??= this.load().catch(error => { this.extractor = null; throw error; });
    const extract = await this.extractor;
    const vectors: Float32Array[] = [];
    for (let index = 0; index < texts.length; index += BATCH) {
      const output = await extract(texts.slice(index, index + BATCH), { pooling: "mean", normalize: true });
      const size = output.dims[output.dims.length - 1];
      for (let row = 0; row < output.dims[0]; row++) vectors.push(output.data.slice(row * size, (row + 1) * size));
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    this.dimensions = vectors[0]?.length ?? this.dimensions;
    clearTimeout(this.idle);
    this.idle = setTimeout(() => void this.dispose(), IDLE);
    return vectors;
  }
  async dispose(): Promise<void> {
    clearTimeout(this.idle);
    const extractor = this.extractor;
    this.extractor = null;
    await (await extractor?.catch(() => null))?.dispose?.();
  }
}
