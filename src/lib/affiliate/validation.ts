import { REFCODE, RESERVED_REFCODES } from "./constants";

type Ok = { ok: true };
type Err = { ok: false; reason: string; message: string };
type Result = Ok | Err;

export function validateRefCode(raw: string): Result {
  const code = raw.toLowerCase();

  if (code.length < REFCODE.minLength || code.length > REFCODE.maxLength) {
    return {
      ok: false,
      reason: "invalid_refcode",
      message: `Реферальный код должен быть от ${REFCODE.minLength} до ${REFCODE.maxLength} символов`,
    };
  }

  if (!REFCODE.pattern.test(code)) {
    return {
      ok: false,
      reason: "invalid_refcode",
      message: "Реферальный код может содержать только буквы, цифры, _ и -",
    };
  }

  if (RESERVED_REFCODES.has(code)) {
    return {
      ok: false,
      reason: "reserved_refcode",
      message: "Этот реферальный код зарезервирован",
    };
  }

  return { ok: true };
}

export function validateApplicationData(data: unknown): Result {
  if (typeof data !== "object" || data === null) {
    return { ok: false, reason: "invalid_application_data", message: "applicationData должен быть объектом" };
  }

  const d = data as Record<string, unknown>;

  if (typeof d.promoChannels !== "string" || d.promoChannels.trim() === "") {
    return { ok: false, reason: "invalid_application_data", message: "promoChannels обязателен" };
  }

  if (typeof d.audience !== "string" || d.audience.trim() === "") {
    return { ok: false, reason: "invalid_application_data", message: "audience обязателен" };
  }

  return { ok: true };
}
