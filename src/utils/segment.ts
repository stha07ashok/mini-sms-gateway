import type { Encoding } from "../models/message.model.ts";

const GSM_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);

const GSM_EXTENDED = new Set("^{}\\[~]|€\f");

const GSM_SINGLE = 160;
const GSM_MULTI = 153;
const UNICODE_SINGLE = 70;
const UNICODE_MULTI = 67;

export interface Segmentation {
  encoding: Encoding;
  length: number;
  parts: number;
}

const countGsmSeptets = (message: string): number | null => {
  let septets = 0;

  for (const char of message) {
    if (GSM_BASIC.has(char)) {
      septets += 1;
    } else if (GSM_EXTENDED.has(char)) {
      septets += 2;
    } else {
      return null;
    }
  }

  return septets;
};

const countParts = (length: number, single: number, multi: number): number => {
  if (length <= single) return 1;
  return Math.ceil(length / multi);
};

// Calculates message segment counts
export const segmentMessage = (message: string): Segmentation => {
  const septets = countGsmSeptets(message);

  if (septets !== null) {
    return {
      encoding: "GSM-7",
      length: septets,
      parts: countParts(septets, GSM_SINGLE, GSM_MULTI),
    };
  }

  const length = message.length;

  return {
    encoding: "UNICODE",
    length,
    parts: countParts(length, UNICODE_SINGLE, UNICODE_MULTI),
  };
};
