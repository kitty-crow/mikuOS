/** FNV-1a over the exact bytes stored in an image or package. */
export function checksum(bytes: Uint8Array): number {
  let value = 0x811c9dc5;
  for (const byte of bytes) value = Math.imul(value ^ byte, 0x01000193);
  return value >>> 0;
}
