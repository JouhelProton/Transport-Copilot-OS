import { createHash, randomBytes } from "node:crypto";
import type { AppConfig } from "../../config/env.js";

export const createSessionToken = () => randomBytes(32).toString("base64url");
export const hashSessionToken = (token: string) =>
  createHash("sha256").update(token).digest("base64url");

export function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}

export function sessionCookie(
  config: AppConfig,
  token: string,
  expiresAt: Date,
) {
  const maxAge = Math.max(
    0,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  );
  return [
    `${config.SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    `Expires=${expiresAt.toUTCString()}`,
    ...(config.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");
}

export function expiredSessionCookie(config: AppConfig) {
  return [
    `${config.SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...(config.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");
}
