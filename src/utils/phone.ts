const COUNTRY_CODE = "977";
const NEPALI_MOBILE = /^9[78]\d{8}$/;

export type PhoneResult =
  | { valid: true; normalized: string }
  | { valid: false; reason: string };

// Normalizes Nepali mobile numbers
export const normalizePhone = (input: unknown): PhoneResult => {
  if (typeof input !== "string") {
    return { valid: false, reason: "Number must be a string" };
  }

  const cleaned = input.replace(/[\s\-()]/g, "").replace(/^\+/, "");

  if (cleaned.length === 0) {
    return { valid: false, reason: "Number is empty" };
  }

  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, reason: "Number must contain digits only" };
  }

  const digits =
    cleaned.length === COUNTRY_CODE.length + 10 &&
    cleaned.startsWith(COUNTRY_CODE)
      ? cleaned.slice(COUNTRY_CODE.length)
      : cleaned;

  if (digits.length !== 10) {
    return {
      valid: false,
      reason: `Number must be 10 digits after the optional +977 prefix, got ${digits.length}`,
    };
  }

  if (!NEPALI_MOBILE.test(digits)) {
    return { valid: false, reason: "Number must start with 97 or 98" };
  }

  return { valid: true, normalized: digits };
};
