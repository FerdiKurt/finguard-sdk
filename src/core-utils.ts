import { createHash } from "node:crypto";

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function canonicalHash(value: unknown) {
  return sha256Hex(stableJson(normalizeCanonicalValue(value)));
}

export function compareDecimalStrings(left: string, right: string) {
  const [leftWhole, leftFraction = ""] = left.split(".");
  const [rightWhole, rightFraction = ""] = right.split(".");
  const leftNormalized = normalizeDecimalParts(leftWhole, leftFraction);
  const rightNormalized = normalizeDecimalParts(rightWhole, rightFraction);

  if (leftNormalized.sign !== rightNormalized.sign) {
    return leftNormalized.sign > rightNormalized.sign ? 1 : -1;
  }

  const sign = leftNormalized.sign;
  if (leftNormalized.whole.length !== rightNormalized.whole.length) {
    return (
      (leftNormalized.whole.length > rightNormalized.whole.length ? 1 : -1) *
      sign
    );
  }

  const wholeComparison = leftNormalized.whole.localeCompare(rightNormalized.whole);
  if (wholeComparison !== 0) {
    return (wholeComparison > 0 ? 1 : -1) * sign;
  }

  const fractionLength = Math.max(
    leftNormalized.fraction.length,
    rightNormalized.fraction.length,
  );
  const leftFractionPadded = leftNormalized.fraction.padEnd(fractionLength, "0");
  const rightFractionPadded = rightNormalized.fraction.padEnd(fractionLength, "0");
  const fractionComparison = leftFractionPadded.localeCompare(rightFractionPadded);

  if (fractionComparison === 0) {
    return 0;
  }

  return (fractionComparison > 0 ? 1 : -1) * sign;
}

export function validDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
}

export function validDateTime(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function validEvmAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function normalizeDecimalParts(whole: string, fraction: string) {
  const sign = whole.startsWith("-") ? -1 : 1;
  const unsignedWhole = whole.replace(/^-/, "").replace(/^0+(?=\d)/, "");

  return {
    sign,
    whole: unsignedWhole || "0",
    fraction: fraction.replace(/0+$/, ""),
  };
}

function normalizeCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeCanonicalValue(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, normalizeCanonicalValue(value[key])]),
    );
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
