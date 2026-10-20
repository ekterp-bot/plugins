"use strict";

// This endpoint deliberately has no email transport. A secret or environment
// flag must not enable public sending before shared abuse protection exists.
// The existing hosting adapter supplies request.body (JSON, string or Buffer).
const MAX_BODY_BYTES = 12 * 1024;
const ALLOWED_FIELDS = new Set(["name", "email", "topic", "message", "companyWebsite"]);
const LIMITS = { name: 100, email: 254, topic: 80, message: 5000, companyWebsite: 200 };
const SINGLE_LINE_CONTROL = /[\u0000-\u001f\u007f]/;
const MESSAGE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function respond(response, status, code, message) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify({ ok: false, sent: false, code, message }));
}

function validEmail(email) {
  if (email.length > LIMITS.email || SINGLE_LINE_CONTROL.test(email)) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  const labels = domain.split(".");
  return labels.length >= 2 && labels.every(label =>
    label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label)
  );
}

module.exports = async function support(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return respond(response, 405, "METHOD_NOT_ALLOWED", "Use POST for support requests. Nothing was sent.");
  }

  const headers = request.headers || {};
  const contentType = headers["content-type"];
  if (typeof contentType !== "string" || !/^application\/json(?:\s*;.*)?$/i.test(contentType)) {
    return respond(response, 415, "UNSUPPORTED_MEDIA_TYPE", "Use a JSON request. Nothing was sent.");
  }

  const contentLength = headers["content-length"];
  if (contentLength !== undefined && (typeof contentLength !== "string" || !/^\d+$/.test(contentLength))) {
    return respond(response, 400, "INVALID_REQUEST", "Check the request and try again. Nothing was sent.");
  }
  if (Number(contentLength) > MAX_BODY_BYTES) {
    return respond(response, 413, "REQUEST_TOO_LARGE", "The request is too large. Nothing was sent.");
  }

  let body;
  try {
    const raw = Buffer.isBuffer(request.body) ? request.body.toString("utf8") : request.body;
    const serialized = typeof raw === "string" ? raw : JSON.stringify(raw);
    if (typeof serialized !== "string") throw new Error("Missing body");
    if (Buffer.byteLength(serialized, "utf8") > MAX_BODY_BYTES) {
      return respond(response, 413, "REQUEST_TOO_LARGE", "The request is too large. Nothing was sent.");
    }
    body = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!body || Array.isArray(body) || typeof body !== "object") throw new Error("Invalid object");
    if (Object.keys(body).some(key => !ALLOWED_FIELDS.has(key))) throw new Error("Unexpected field");

    for (const [key, limit] of Object.entries(LIMITS)) {
      const value = body[key];
      if (key === "companyWebsite" && value === undefined) continue;
      if (typeof value !== "string" || value.length > limit) throw new Error("Invalid field");
      if (key !== "companyWebsite" && !value.trim()) throw new Error("Required field");
      if ((key === "message" ? MESSAGE_CONTROL : SINGLE_LINE_CONTROL).test(value)) throw new Error("Invalid control character");
    }
    if (!validEmail(body.email.trim())) throw new Error("Invalid email");
  } catch {
    return respond(response, 400, "INVALID_REQUEST", "Check the required fields and email address. Nothing was sent.");
  }

  // Treat filled honeypots identically to valid submissions while transport is
  // disabled. Do not claim success, store a message, or notify anyone.
  return respond(response, 503, "SUPPORT_UNAVAILABLE", "Online support delivery is not available yet. Your message was not sent or saved.");
};
