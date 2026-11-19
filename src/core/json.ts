/** Values produced by the ECMAScript JSON parser. */
export interface JsonObject { [key: string]: Json; }
export type Json = null | boolean | number | string | Json[] | JsonObject;

/** Require an object before reading domain-specific fields. */
export function jsonObject(value: Json): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  return value;
}

export function jsonText(value: Json): string {
  if (typeof value !== "string") throw new Error("Expected a JSON string");
  return value;
}

export function jsonNat(value: Json): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Expected a non-negative JSON integer");
  return value;
}

/** Parse JSON at the text boundary; consumers validate their domain schema. */
export function parseJson(text: string): Json {
  // JSON.parse returns only JSON values, but its standard library type is any.
  //@cg-expect-warning
  return JSON.parse(text) as Json;
}
