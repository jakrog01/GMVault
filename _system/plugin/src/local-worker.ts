import ortLoader from "./ort-loader.mjs?text";

type Request = { type: "init"; model: string; wasmBinary: ArrayBuffer } | { type: "embed"; id: number; texts: string[] } | { type: "file"; id: number; buffer: ArrayBuffer | null };
type Pipeline = (texts: string[], options: { pooling: "mean"; normalize: boolean }) => Promise<{ dims: number[]; data: Float32Array }>;

const scope = self as unknown as { postMessage(message: unknown, transfer?: Transferable[]): void; onmessage: ((event: MessageEvent<Request>) => void) | null };
const files = new Map<number, (buffer: ArrayBuffer | null) => void>();
let nextFile = 0;
let extractor: Promise<Pipeline> | null = null;

const requestFile = (url: string): Promise<ArrayBuffer | null> => new Promise(resolve => {
  const id = nextFile++;
  files.set(id, resolve);
  scope.postMessage({ type: "file", id, url });
});

async function init(model: string, wasmBinary: ArrayBuffer): Promise<Pipeline> {
  const { pipeline, env } = await import("@huggingface/transformers");
  const wasm = env.backends.onnx.wasm as { wasmBinary?: ArrayBuffer; numThreads?: number; proxy?: boolean; wasmPaths?: unknown };
  wasm.wasmBinary = wasmBinary;
  wasm.numThreads = 1;
  wasm.proxy = false;
  wasm.wasmPaths = { mjs: `data:text/javascript;base64,${btoa(ortLoader)}`, wasm: "https://localhost.invalid/ort-wasm-simd-threaded.wasm" };
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useBrowserCache = false;
  env.useFSCache = false;
  env.useCustomCache = true;
  env.customCache = {
    match: async (request: globalThis.Request | string) => {
      const buffer = await requestFile(typeof request === "string" ? request : request.url);
      return buffer ? new Response(buffer) : undefined;
    },
    put: async () => undefined,
  };
  return await pipeline("feature-extraction", model, { dtype: "q8", device: "wasm" }) as unknown as Pipeline;
}

scope.onmessage = event => {
  const message = event.data;
  if (message.type === "file") { files.get(message.id)?.(message.buffer); files.delete(message.id); return; }
  if (message.type === "init") {
    extractor = init(message.model, message.wasmBinary);
    extractor.then(() => scope.postMessage({ type: "ready" }), error => scope.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) }));
    return;
  }
  void (async () => {
    try {
      if (!extractor) throw new Error("The local embedding worker is not initialised.");
      const output = await (await extractor)(message.texts, { pooling: "mean", normalize: true });
      const data = output.data.slice();
      scope.postMessage({ type: "result", id: message.id, dims: output.dims, data }, [data.buffer]);
    } catch (error) {
      scope.postMessage({ type: "error", id: message.id, message: error instanceof Error ? error.message : String(error) });
    }
  })();
};
