interface WorkerPort {
  postMessage(value: unknown): void;
}

export {};

interface SchedulerWorkerData {
  bytes: Uint8Array<ArrayBuffer>;
  memory: WebAssembly.Memory;
  worker: number;
  budget: number;
}

interface WorkerThreads {
  workerData: SchedulerWorkerData;
  parentPort: WorkerPort | null;
}

interface SchedulerExports {
  tetoRunSchedulerBatch(memory: number, budget: number, nowMicros: bigint, worker: number): number;
}

const load = (name: string): Promise<unknown> => import(name);
const threads = await load("node:worker_threads") as WorkerThreads;
const data = threads.workerData;
const module = await WebAssembly.compile(data.bytes);
const instance = await WebAssembly.instantiate(module, { env: { memory: data.memory } });
const run = (instance.exports as unknown as SchedulerExports).tetoRunSchedulerBatch;
const wait = new Int32Array(data.memory.buffer);
let calls = 0;
let claims = 0;
let idle = 0;
let contention = 0;
let terminal = 0;

while (calls < 100000 && idle < 100) {
  const packed = run(0, data.budget, BigInt(Date.now()) * 1000n, data.worker);
  calls += 1;
  if (packed === 0) {
    idle += 1;
    Atomics.wait(wait, 0, Atomics.load(wait, 0), 1);
    continue;
  }
  if (packed <= 255) {
    if (packed === 5 || packed === 6) {
      contention += 1;
      continue;
    }
    terminal = packed;
    break;
  }
  idle = 0;
  claims += 1;
  const result = packed & 255;
  if (result === 1 || result === 2 || result === 4) {
    terminal = result;
    break;
  }
}

threads.parentPort?.postMessage({ calls, claims, idle, contention, terminal });
