import {
  TETO_PARSER_BASE,
  TETO_PARSER_NUMBER,
  TETO_PARSER_STRING,
  TETO_PARSER_STRING_ESCAPED,
  TETO_PARSER_STRING_LENGTH,
  TETO_SEGMENT_EXECUTE,
  TETO_SEGMENT_READ,
  TETO_SEGMENT_WRITE,
  TETO_THX_CHECKSUM,
  TETO_THX_JSON,
  TETO_THX_LENGTH,
  TETO_THX_MAGIC,
  TETO_THX_METADATA,
  TETO_THX_OK,
  TETO_THX_RANGE,
  TETO_THX_SECTION,
} from "./abi.js";
import {
  tetoImageBegin,
  tetoImageContains,
  tetoImageFinish,
  tetoImageSegment,
} from "./kernel.js";
import { loadU8, loadU32, loadU64, storeU32, storeU64 } from "./memory.js";
import type { TetoMemory } from "./memory.js";
import type { I32, Ptr, U32, U64 } from "./types.js";
import { mulU32, u32word, wordToU32 } from "./word.js";

const BAD: Ptr = 0xffffffff;
const MAX_SAFE: U64 = 9007199254740991n;

const K_MACHINE: U32 = 1;
const K_VER: U32 = 2;
const K_SEC: U32 = 3;
const K_SYM: U32 = 4;
const K_REL: U32 = 5;
const K_DBG: U32 = 6;
const K_IDENT: U32 = 7;
const K_ENTRY: U32 = 8;
const K_MEM: U32 = 9;
const K_ISA: U32 = 10;
const K_PHDR: U32 = 11;
const K_PHENT: U32 = 12;
const K_PHNUM: U32 = 13;
const K_NAME: U32 = 14;
const K_FLG: U32 = 15;
const K_ALIGN: U32 = 16;
const K_SIZE: U32 = 17;
const K_ADDR: U32 = 18;
const K_AT: U32 = 19;
const K_LEN: U32 = 20;

const whitespace = (byte: U32): boolean => byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;
const digit = (byte: U32): boolean => byte >= 0x30 && byte <= 0x39;
const hex = (byte: U32): boolean => digit(byte) || byte >= 0x41 && byte <= 0x46 || byte >= 0x61 && byte <= 0x66;

const space = (memory: TetoMemory, at: Ptr, end: Ptr): Ptr => {
  let cursor = at;
  while (cursor < end && whitespace(loadU8(memory, cursor))) cursor += 1;
  return cursor;
};

const parseString = (memory: TetoMemory, at: Ptr, end: Ptr): Ptr => {
  if (at >= end || loadU8(memory, at) !== 0x22) return BAD;
  const start = at + 1;
  let cursor = start;
  let escaped: U32 = 0;
  while (cursor < end) {
    const byte = loadU8(memory, cursor);
    if (byte === 0x22) {
      storeU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING, start);
      storeU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING_LENGTH, cursor - start);
      storeU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING_ESCAPED, escaped);
      return cursor + 1;
    }
    if (byte < 0x20) return BAD;
    if (byte === 0x5c) {
      escaped = 1;
      cursor += 1;
      if (cursor >= end) return BAD;
      const code = loadU8(memory, cursor);
      if (code === 0x75) {
        if (end - cursor < 5 || !hex(loadU8(memory, cursor + 1)) || !hex(loadU8(memory, cursor + 2)) ||
            !hex(loadU8(memory, cursor + 3)) || !hex(loadU8(memory, cursor + 4))) return BAD;
        cursor += 5;
        continue;
      }
      if (code !== 0x22 && code !== 0x5c && code !== 0x2f && code !== 0x62 && code !== 0x66 &&
          code !== 0x6e && code !== 0x72 && code !== 0x74) return BAD;
    }
    cursor += 1;
  }
  return BAD;
};

const byte = (memory: TetoMemory, at: Ptr, index: U32, expected: U32): boolean =>
  loadU8(memory, at + index) === expected;

const keyId = (memory: TetoMemory): U32 => {
  if (loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING_ESCAPED) !== 0) return 0;
  const at = loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING);
  const length = loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING_LENGTH);
  if (length === 2 && byte(memory, at, 0, 0x61) && byte(memory, at, 1, 0x74)) return K_AT;
  if (length === 3) {
    if (byte(memory, at, 0, 0x76) && byte(memory, at, 1, 0x65) && byte(memory, at, 2, 0x72)) return K_VER;
    if (byte(memory, at, 0, 0x73) && byte(memory, at, 1, 0x65) && byte(memory, at, 2, 0x63)) return K_SEC;
    if (byte(memory, at, 0, 0x73) && byte(memory, at, 1, 0x79) && byte(memory, at, 2, 0x6d)) return K_SYM;
    if (byte(memory, at, 0, 0x72) && byte(memory, at, 1, 0x65) && byte(memory, at, 2, 0x6c)) return K_REL;
    if (byte(memory, at, 0, 0x64) && byte(memory, at, 1, 0x62) && byte(memory, at, 2, 0x67)) return K_DBG;
    if (byte(memory, at, 0, 0x6d) && byte(memory, at, 1, 0x65) && byte(memory, at, 2, 0x6d)) return K_MEM;
    if (byte(memory, at, 0, 0x69) && byte(memory, at, 1, 0x73) && byte(memory, at, 2, 0x61)) return K_ISA;
    if (byte(memory, at, 0, 0x66) && byte(memory, at, 1, 0x6c) && byte(memory, at, 2, 0x67)) return K_FLG;
    if (byte(memory, at, 0, 0x6c) && byte(memory, at, 1, 0x65) && byte(memory, at, 2, 0x6e)) return K_LEN;
  }
  if (length === 4) {
    if (byte(memory, at, 0, 0x6e) && byte(memory, at, 1, 0x61) && byte(memory, at, 2, 0x6d) && byte(memory, at, 3, 0x65)) return K_NAME;
    if (byte(memory, at, 0, 0x73) && byte(memory, at, 1, 0x69) && byte(memory, at, 2, 0x7a) && byte(memory, at, 3, 0x65)) return K_SIZE;
    if (byte(memory, at, 0, 0x61) && byte(memory, at, 1, 0x64) && byte(memory, at, 2, 0x64) && byte(memory, at, 3, 0x72)) return K_ADDR;
    if (byte(memory, at, 0, 0x70) && byte(memory, at, 1, 0x68) && byte(memory, at, 2, 0x64) && byte(memory, at, 3, 0x72)) return K_PHDR;
  }
  if (length === 5) {
    if (byte(memory, at, 0, 0x69) && byte(memory, at, 1, 0x64) && byte(memory, at, 2, 0x65) && byte(memory, at, 3, 0x6e) && byte(memory, at, 4, 0x74)) return K_IDENT;
    if (byte(memory, at, 0, 0x65) && byte(memory, at, 1, 0x6e) && byte(memory, at, 2, 0x74) && byte(memory, at, 3, 0x72) && byte(memory, at, 4, 0x79)) return K_ENTRY;
    if (byte(memory, at, 0, 0x70) && byte(memory, at, 1, 0x68) && byte(memory, at, 2, 0x65) && byte(memory, at, 3, 0x6e) && byte(memory, at, 4, 0x74)) return K_PHENT;
    if (byte(memory, at, 0, 0x70) && byte(memory, at, 1, 0x68) && byte(memory, at, 2, 0x6e) && byte(memory, at, 3, 0x75) && byte(memory, at, 4, 0x6d)) return K_PHNUM;
    if (byte(memory, at, 0, 0x61) && byte(memory, at, 1, 0x6c) && byte(memory, at, 2, 0x69) && byte(memory, at, 3, 0x67) && byte(memory, at, 4, 0x6e)) return K_ALIGN;
  }
  if (length === 7 && byte(memory, at, 0, 0x6d) && byte(memory, at, 1, 0x61) && byte(memory, at, 2, 0x63) &&
      byte(memory, at, 3, 0x68) && byte(memory, at, 4, 0x69) && byte(memory, at, 5, 0x6e) && byte(memory, at, 6, 0x65)) return K_MACHINE;
  return 0;
};

const exactMachine = (memory: TetoMemory): boolean => {
  if (loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING_ESCAPED) !== 0 ||
      loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING_LENGTH) !== 9) return false;
  const at = loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING);
  return byte(memory, at, 0, 0x74) && byte(memory, at, 1, 0x68) && byte(memory, at, 2, 0x69) &&
    byte(memory, at, 3, 0x73) && byte(memory, at, 4, 0x74) && byte(memory, at, 5, 0x6c) &&
    byte(memory, at, 6, 0x65) && byte(memory, at, 7, 0x36) && byte(memory, at, 8, 0x34);
};

const exactIsa = (memory: TetoMemory): boolean => {
  if (loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING_ESCAPED) !== 0 ||
      loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING_LENGTH) !== 6) return false;
  const at = loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING);
  return byte(memory, at, 0, 0x72) && byte(memory, at, 1, 0x76) && byte(memory, at, 2, 0x36) &&
    byte(memory, at, 3, 0x34) && byte(memory, at, 4, 0x67) && byte(memory, at, 5, 0x63);
};

const parseUnsigned = (memory: TetoMemory, at: Ptr, end: Ptr): Ptr => {
  if (at >= end || !digit(loadU8(memory, at))) return BAD;
  const first = loadU8(memory, at);
  let cursor = at;
  let value: U64 = 0n;
  while (cursor < end && digit(loadU8(memory, cursor))) {
    if (first === 0x30 && cursor !== at) return BAD;
    value = value * 10n + u32word(loadU8(memory, cursor) - 0x30);
    if (value > MAX_SAFE) return BAD;
    cursor += 1;
  }
  storeU64(memory, TETO_PARSER_BASE + TETO_PARSER_NUMBER, value);
  return cursor;
};

const literal = (memory: TetoMemory, at: Ptr, end: Ptr, a: U32, b: U32, c: U32, d: U32, length: U32): Ptr => {
  if (end - at < length || !byte(memory, at, 0, a) || !byte(memory, at, 1, b) || !byte(memory, at, 2, c)) return BAD;
  if (length === 4 && !byte(memory, at, 3, d)) return BAD;
  return at + length;
};

const skipNumber = (memory: TetoMemory, at: Ptr, end: Ptr): Ptr => {
  let cursor = at;
  if (cursor < end && loadU8(memory, cursor) === 0x2d) cursor += 1;
  if (cursor >= end || !digit(loadU8(memory, cursor))) return BAD;
  if (loadU8(memory, cursor) === 0x30) cursor += 1;
  else while (cursor < end && digit(loadU8(memory, cursor))) cursor += 1;
  if (cursor < end && loadU8(memory, cursor) === 0x2e) {
    cursor += 1;
    if (cursor >= end || !digit(loadU8(memory, cursor))) return BAD;
    while (cursor < end && digit(loadU8(memory, cursor))) cursor += 1;
  }
  if (cursor < end && (loadU8(memory, cursor) === 0x65 || loadU8(memory, cursor) === 0x45)) {
    cursor += 1;
    if (cursor < end && (loadU8(memory, cursor) === 0x2b || loadU8(memory, cursor) === 0x2d)) cursor += 1;
    if (cursor >= end || !digit(loadU8(memory, cursor))) return BAD;
    while (cursor < end && digit(loadU8(memory, cursor))) cursor += 1;
  }
  return cursor;
};

const skipValue = (memory: TetoMemory, at: Ptr, end: Ptr, depth: U32): Ptr => {
  if (depth > 32) return BAD;
  let cursor = space(memory, at, end);
  if (cursor >= end) return BAD;
  const first = loadU8(memory, cursor);
  if (first === 0x22) return parseString(memory, cursor, end);
  if (first === 0x74) return literal(memory, cursor, end, 0x74, 0x72, 0x75, 0x65, 4);
  if (first === 0x66) {
    if (end - cursor < 5 || !byte(memory, cursor, 0, 0x66) || !byte(memory, cursor, 1, 0x61) ||
        !byte(memory, cursor, 2, 0x6c) || !byte(memory, cursor, 3, 0x73) || !byte(memory, cursor, 4, 0x65)) return BAD;
    return cursor + 5;
  }
  if (first === 0x6e) return literal(memory, cursor, end, 0x6e, 0x75, 0x6c, 0x6c, 4);
  if (first === 0x2d || digit(first)) return skipNumber(memory, cursor, end);
  if (first === 0x5b) {
    cursor = space(memory, cursor + 1, end);
    if (cursor < end && loadU8(memory, cursor) === 0x5d) return cursor + 1;
    while (cursor < end) {
      cursor = skipValue(memory, cursor, end, depth + 1);
      if (cursor === BAD) return BAD;
      cursor = space(memory, cursor, end);
      if (cursor < end && loadU8(memory, cursor) === 0x5d) return cursor + 1;
      if (cursor >= end || loadU8(memory, cursor) !== 0x2c) return BAD;
      cursor = space(memory, cursor + 1, end);
    }
    return BAD;
  }
  if (first === 0x7b) {
    cursor = space(memory, cursor + 1, end);
    if (cursor < end && loadU8(memory, cursor) === 0x7d) return cursor + 1;
    while (cursor < end) {
      cursor = parseString(memory, cursor, end);
      if (cursor === BAD) return BAD;
      cursor = space(memory, cursor, end);
      if (cursor >= end || loadU8(memory, cursor) !== 0x3a) return BAD;
      cursor = skipValue(memory, cursor + 1, end, depth + 1);
      if (cursor === BAD) return BAD;
      cursor = space(memory, cursor, end);
      if (cursor < end && loadU8(memory, cursor) === 0x7d) return cursor + 1;
      if (cursor >= end || loadU8(memory, cursor) !== 0x2c) return BAD;
      cursor = space(memory, cursor + 1, end);
    }
  }
  return BAD;
};

const nameHash = (memory: TetoMemory): U32 => {
  const at = loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING);
  const length = loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING_LENGTH);
  let hash: U32 = 0x811c9dc5;
  let index: U32 = 0;
  while (index < length) {
    hash = mulU32(hash ^ loadU8(memory, at + index), 0x01000193);
    index += 1;
  }
  return hash;
};

const sectionFlags = (memory: TetoMemory): U32 => {
  if (loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING_ESCAPED) !== 0) return 0xffffffff;
  const at = loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING);
  const length = loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING_LENGTH);
  let flags: U32 = 0;
  let index: U32 = 0;
  while (index < length) {
    const value = loadU8(memory, at + index);
    let flag: U32 = 0;
    if (value === 0x72) flag = TETO_SEGMENT_READ;
    else if (value === 0x77) flag = TETO_SEGMENT_WRITE;
    else if (value === 0x78) flag = TETO_SEGMENT_EXECUTE;
    else return 0xffffffff;
    if ((flags & flag) !== 0) return 0xffffffff;
    flags |= flag;
    index += 1;
  }
  return flags;
};

const parseSections = (
  memory: TetoMemory,
  hart: U32,
  at: Ptr,
  end: Ptr,
  payload: Ptr,
  payloadLength: U32,
): I32 => {
  let cursor = space(memory, at, end);
  if (cursor >= end || loadU8(memory, cursor) !== 0x5b) return TETO_THX_SECTION;
  cursor = space(memory, cursor + 1, end);
  if (cursor < end && loadU8(memory, cursor) === 0x5d) return TETO_THX_SECTION;
  while (cursor < end) {
    if (loadU8(memory, cursor) !== 0x7b) return TETO_THX_SECTION;
    cursor = space(memory, cursor + 1, end);
    let seen: U32 = 0;
    let hash: U32 = 0;
    let nameLength: U32 = 0;
    let flags: U32 = 0;
    let align: U64 = 0n;
    let size: U64 = 0n;
    let address: U64 = 0n;
    let offset: U64 = 0n;
    let length: U64 = 0n;
    while (cursor < end && loadU8(memory, cursor) !== 0x7d) {
      cursor = parseString(memory, cursor, end);
      if (cursor === BAD) return TETO_THX_SECTION;
      const key = keyId(memory);
      cursor = space(memory, cursor, end);
      if (cursor >= end || loadU8(memory, cursor) !== 0x3a) return TETO_THX_SECTION;
      cursor = space(memory, cursor + 1, end);
      let bit: U32 = 0;
      if (key === K_NAME) bit = 1;
      else if (key === K_FLG) bit = 2;
      else if (key === K_ALIGN) bit = 4;
      else if (key === K_SIZE) bit = 8;
      else if (key === K_ADDR) bit = 16;
      else if (key === K_AT) bit = 32;
      else if (key === K_LEN) bit = 64;
      if (bit !== 0 && (seen & bit) !== 0) return TETO_THX_SECTION;
      if (key === K_NAME || key === K_FLG) {
        cursor = parseString(memory, cursor, end);
        if (cursor === BAD) return TETO_THX_SECTION;
        if (key === K_NAME) {
          if (loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING_ESCAPED) !== 0) return TETO_THX_SECTION;
          hash = nameHash(memory);
          nameLength = loadU32(memory, TETO_PARSER_BASE + TETO_PARSER_STRING_LENGTH);
        } else {
          flags = sectionFlags(memory);
          if (flags === 0xffffffff) return TETO_THX_SECTION;
        }
      } else if (bit !== 0) {
        cursor = parseUnsigned(memory, cursor, end);
        if (cursor === BAD) return TETO_THX_SECTION;
        const value = loadU64(memory, TETO_PARSER_BASE + TETO_PARSER_NUMBER);
        if (key === K_ALIGN) align = value;
        else if (key === K_SIZE) size = value;
        else if (key === K_ADDR) address = value;
        else if (key === K_AT) offset = value;
        else length = value;
      } else {
        cursor = skipValue(memory, cursor, end, 0);
        if (cursor === BAD) return TETO_THX_SECTION;
      }
      seen |= bit;
      cursor = space(memory, cursor, end);
      if (cursor < end && loadU8(memory, cursor) === 0x7d) break;
      if (cursor >= end || loadU8(memory, cursor) !== 0x2c) return TETO_THX_SECTION;
      cursor = space(memory, cursor + 1, end);
    }
    if (cursor >= end || loadU8(memory, cursor) !== 0x7d || seen !== 127 || align === 0n ||
        (align & align - 1n) !== 0n || address % align !== 0n || length > size ||
        offset > u32word(payloadLength) || length > u32word(payloadLength) - offset ||
        offset > 0xffffffffn || length > 0xffffffffn) return TETO_THX_SECTION;
    const result = tetoImageSegment(memory, hart, hash, nameLength, address, size, flags,
      payload + wordToU32(offset), wordToU32(length));
    if (result !== TETO_THX_OK) return result;
    cursor = space(memory, cursor + 1, end);
    if (cursor < end && loadU8(memory, cursor) === 0x5d) return TETO_THX_OK;
    if (cursor >= end || loadU8(memory, cursor) !== 0x2c) return TETO_THX_SECTION;
    cursor = space(memory, cursor + 1, end);
  }
  return TETO_THX_SECTION;
};

export const tetoLoadThx = (memory: TetoMemory, hart: U32, image: Ptr, imageLength: U32): I32 => {
  if (!tetoImageContains(memory, image, imageLength)) return TETO_THX_RANGE;
  if (imageLength < 16) return TETO_THX_LENGTH;
  if (loadU8(memory, image) !== 0x54 || loadU8(memory, image + 1) !== 0x48 ||
      loadU8(memory, image + 2) !== 0x58 || loadU8(memory, image + 3) !== 0x32) return TETO_THX_MAGIC;
  const headerLength = loadU32(memory, image + 4);
  const payloadLength = loadU32(memory, image + 8);
  if (headerLength > imageLength - 16 || payloadLength !== imageLength - 16 - headerLength) return TETO_THX_LENGTH;
  let checksum: U32 = 0x811c9dc5;
  let index: U32 = 16;
  while (index < imageLength) {
    checksum = mulU32(checksum ^ loadU8(memory, image + index), 0x01000193);
    index += 1;
  }
  if (checksum !== loadU32(memory, image + 12)) return TETO_THX_CHECKSUM;

  const header = image + 16;
  const headerEnd = header + headerLength;
  const payload = headerEnd;
  let cursor = space(memory, header, headerEnd);
  if (cursor >= headerEnd || loadU8(memory, cursor) !== 0x7b) return TETO_THX_JSON;
  cursor = space(memory, cursor + 1, headerEnd);
  let seen: U32 = 0;
  let sectionAt: Ptr = BAD;
  let entry: U64 = 0n;
  let virtualTop: U64 = 0n;
  let phdr: U64 = 0n;
  let phent: U32 = 0;
  let phnum: U32 = 0;
  while (cursor < headerEnd && loadU8(memory, cursor) !== 0x7d) {
    cursor = parseString(memory, cursor, headerEnd);
    if (cursor === BAD) return TETO_THX_JSON;
    const key = keyId(memory);
    cursor = space(memory, cursor, headerEnd);
    if (cursor >= headerEnd || loadU8(memory, cursor) !== 0x3a) return TETO_THX_JSON;
    cursor = space(memory, cursor + 1, headerEnd);
    let bit: U32 = 0;
    if (key === K_MACHINE) bit = 1;
    else if (key === K_VER) bit = 2;
    else if (key === K_SEC) bit = 4;
    else if (key === K_SYM) bit = 8;
    else if (key === K_REL) bit = 16;
    else if (key === K_DBG) bit = 32;
    else if (key === K_IDENT) bit = 64;
    else if (key === K_ENTRY) bit = 128;
    else if (key === K_MEM) bit = 256;
    else if (key === K_ISA) bit = 512;
    else if (key === K_PHDR) bit = 1024;
    else if (key === K_PHENT) bit = 2048;
    else if (key === K_PHNUM) bit = 4096;
    if (bit !== 0 && (seen & bit) !== 0) return TETO_THX_METADATA;
    if (key === K_MACHINE || key === K_ISA) {
      cursor = parseString(memory, cursor, headerEnd);
      if (cursor === BAD || key === K_MACHINE && !exactMachine(memory) || key === K_ISA && !exactIsa(memory)) return TETO_THX_METADATA;
    } else if (key === K_VER || key === K_ENTRY || key === K_MEM || key === K_PHDR || key === K_PHENT || key === K_PHNUM) {
      cursor = parseUnsigned(memory, cursor, headerEnd);
      if (cursor === BAD) return TETO_THX_METADATA;
      const value = loadU64(memory, TETO_PARSER_BASE + TETO_PARSER_NUMBER);
      if (key === K_VER && value !== 2n) return TETO_THX_METADATA;
      if (key === K_ENTRY) entry = value;
      if (key === K_MEM) virtualTop = value;
      if (key === K_PHDR) phdr = value;
      if ((key === K_PHENT || key === K_PHNUM) && value > 0xffffffffn) return TETO_THX_METADATA;
      if (key === K_PHENT) phent = wordToU32(value);
      if (key === K_PHNUM) phnum = wordToU32(value);
    } else if (key === K_SEC) {
      sectionAt = cursor;
      cursor = skipValue(memory, cursor, headerEnd, 0);
      if (cursor === BAD) return TETO_THX_JSON;
    } else if (key === K_SYM || key === K_REL || key === K_DBG || key === K_IDENT) {
      if (cursor >= headerEnd || loadU8(memory, cursor) !== 0x5b) return TETO_THX_METADATA;
      cursor = skipValue(memory, cursor, headerEnd, 0);
      if (cursor === BAD) return TETO_THX_JSON;
    } else {
      cursor = skipValue(memory, cursor, headerEnd, 0);
      if (cursor === BAD) return TETO_THX_JSON;
    }
    seen |= bit;
    cursor = space(memory, cursor, headerEnd);
    if (cursor < headerEnd && loadU8(memory, cursor) === 0x7d) break;
    if (cursor >= headerEnd || loadU8(memory, cursor) !== 0x2c) return TETO_THX_JSON;
    cursor = space(memory, cursor + 1, headerEnd);
  }
  if (cursor >= headerEnd || loadU8(memory, cursor) !== 0x7d ||
      space(memory, cursor + 1, headerEnd) !== headerEnd || (seen & 1023) !== 1023 || sectionAt === BAD) return TETO_THX_METADATA;
  let result = tetoImageBegin(memory, hart, virtualTop, entry, phdr, phent, phnum);
  if (result !== TETO_THX_OK) return result;
  result = parseSections(memory, hart, sectionAt, headerEnd, payload, payloadLength);
  if (result !== TETO_THX_OK) return result;
  result = tetoImageFinish(memory, hart, imageLength);
  return result;
};
