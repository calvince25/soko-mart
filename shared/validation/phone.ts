import { validationError } from "../errors/appError";

export type NormalizedPhone = {
  normalizedPhone: string;
  displayPhone: string;
  countryCode: string;
};

export function normalizePhone(input: string, countryCode = "KE"): NormalizedPhone {
  const country = countryCode.trim().toUpperCase();
  const compact = input.replace(/[\s().-]/g, "");
  if (!/^\+?[0-9]{7,15}$/.test(compact)) {
    throw validationError("Enter a valid phone number.");
  }

  let normalized = compact;
  if (country === "KE") {
    if (/^0[17][0-9]{8}$/.test(compact)) normalized = `+254${compact.slice(1)}`;
    else if (/^254[17][0-9]{8}$/.test(compact)) normalized = `+${compact}`;
    else if (!/^\+254[17][0-9]{8}$/.test(compact)) throw validationError("Enter a valid Kenyan phone number.");
  } else if (!normalized.startsWith("+")) {
    throw validationError("Use international format for this country.");
  }

  return {
    normalizedPhone: normalized.startsWith("+") ? normalized : `+${normalized}`,
    displayPhone: input.trim(),
    countryCode: country,
  };
}
