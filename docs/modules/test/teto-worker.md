# test/teto-worker

The scheduler worker receives generated WASM bytes, shared memory and a worker budget. It runs Teto scheduler batches and posts concrete execution, idle and contention counters back to the parent test.

Public names: `WorkerReport`, `SchedulerWorkerData`.
