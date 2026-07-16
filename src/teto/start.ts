import {
  TETO_PARSER_BASE,
  TETO_PARSER_NUMBER,
  TETO_STARTUP_MAGIC,
  TETO_START_FORMAT,
  TETO_START_MEMORY,
  TETO_START_OK,
  TETO_START_RANGE,
} from "./abi.js";
import {
  tetoHartImageFloor,
  tetoHartVirtualTop,
  tetoImageContains,
  tetoStackAux,
  tetoStackCopy,
  tetoStackFinish,
  tetoStackPrepare,
  tetoStackStoreU64,
} from "./kernel.js";
import { loadU8, loadU32, storeU32 } from "./memory.js";
import type { TetoMemory } from "./memory.js";
import type { I32, Ptr, U32, U64 } from "./types.js";
import { u32word } from "./word.js";

const START_BAD: Ptr = 0xffffffff;

const startupEntry = (memory: TetoMemory, at: Ptr, end: Ptr): Ptr => {
  if (end - at < 4) return START_BAD;
  const length = loadU32(memory, at);
  if (length > end - at - 4) return START_BAD;
  let index: U32 = 0;
  while (index < length) {
    if (loadU8(memory, at + 4 + index) === 0) return START_BAD;
    index += 1;
  }
  storeU32(memory, TETO_PARSER_BASE + TETO_PARSER_NUMBER, length);
  return at + 4 + length;
};

export const tetoBuildInitialStack = (
  memory: TetoMemory,
  hart: U32,
  startup: Ptr,
  startupLength: U32,
  stackBytes: U32,
): I32 => {
  if (!tetoImageContains(memory, startup, startupLength)) return TETO_START_RANGE;
  if (startupLength < 32 || loadU32(memory, startup) !== TETO_STARTUP_MAGIC) return TETO_START_FORMAT;
  const argc = loadU32(memory, startup + 4);
  const envc = loadU32(memory, startup + 8);
  if (argc < 1 || argc > 4096 || envc > 8192 || argc > 0xffffffff - envc) return TETO_START_FORMAT;
  const entries = argc + envc;
  const end = startup + startupLength;
  let cursor = startup + 32;
  let totalStrings: U64 = 0n;
  let index: U32 = 0;
  while (index < entries) {
    const next = startupEntry(memory, cursor, end);
    if (next === START_BAD) return TETO_START_FORMAT;
    totalStrings += u32word(loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_NUMBER)) + 1n;
    if (totalStrings > 0x7fffffffn) return TETO_START_RANGE;
    cursor = next;
    index += 1;
  }
  if (cursor !== end) return TETO_START_FORMAT;

  const top = tetoHartVirtualTop(memory, hart);
  const limit = stackBytes < 1024 * 1024 ? 1024 * 1024 : stackBytes;
  if (top <= u32word(limit) || top < 32n + totalStrings) return TETO_START_MEMORY;
  const bottom = top - u32word(limit);
  let stringPointer = top - 16n - totalStrings;
  if (stringPointer < 16n) return TETO_START_MEMORY;
  const random = stringPointer - 16n;
  const aligned = random & -16n;
  const words = argc + envc + 33;
  if (words > 0x0fffffff) return TETO_START_RANGE;
  const wordBytes = u32word(words * 8);
  if (aligned < wordBytes) return TETO_START_MEMORY;
  const stackPointer = aligned - wordBytes & -16n;
  const floor = tetoHartImageFloor(memory, hart);
  const heapGuard = (floor + 4095n & -4096n) + 1024n * 1024n;
  if (stackPointer < bottom || stackPointer < heapGuard) return TETO_START_MEMORY;
  let result = tetoStackPrepare(memory, hart, bottom, stackPointer);
  if (result !== TETO_START_OK) return result;

  const argvTable = stackPointer + 8n;
  const envTable = argvTable + u32word(argc) * 8n + 8n;
  const auxTable = envTable + u32word(envc) * 8n + 8n;
  result = tetoStackStoreU64(memory, hart, stackPointer, u32word(argc));
  if (result !== TETO_START_OK) return result;
  result = tetoStackStoreU64(memory, hart, argvTable + u32word(argc) * 8n, 0n);
  if (result !== TETO_START_OK) return result;
  result = tetoStackStoreU64(memory, hart, envTable + u32word(envc) * 8n, 0n);
  if (result !== TETO_START_OK) return result;

  cursor = startup + 32;
  stringPointer = top - 16n;
  index = 0;
  while (index < envc) {
    const next = startupEntry(memory, cursor, end);
    if (next === START_BAD) return TETO_START_FORMAT;
    const length = loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_NUMBER);
    stringPointer -= u32word(length) + 1n;
    result = tetoStackCopy(memory, hart, stringPointer, cursor + 4, length);
    if (result !== TETO_START_OK) return result;
    result = tetoStackStoreU64(memory, hart, envTable + u32word(index) * 8n, stringPointer);
    if (result !== TETO_START_OK) return result;
    cursor = next;
    index += 1;
  }
  let exec: U64 = 0n;
  index = 0;
  while (index < argc) {
    const next = startupEntry(memory, cursor, end);
    if (next === START_BAD) return TETO_START_FORMAT;
    const length = loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_NUMBER);
    stringPointer -= u32word(length) + 1n;
    result = tetoStackCopy(memory, hart, stringPointer, cursor + 4, length);
    if (result !== TETO_START_OK) return result;
    result = tetoStackStoreU64(memory, hart, argvTable + u32word(index) * 8n, stringPointer);
    if (result !== TETO_START_OK) return result;
    if (index === 0) exec = stringPointer;
    cursor = next;
    index += 1;
  }
  if (stringPointer !== random + 16n || exec === 0n) return TETO_START_FORMAT;
  result = tetoStackCopy(memory, hart, random, startup + 16, 16);
  if (result !== TETO_START_OK) return result;
  result = tetoStackAux(memory, hart, auxTable, random, exec);
  if (result !== TETO_START_OK) return result;
  return tetoStackFinish(memory, hart, stackPointer);
};
