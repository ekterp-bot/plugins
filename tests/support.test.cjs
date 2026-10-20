"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/support.js");

const validBody = () => ({ name: "Mix Engineer", email: "engineer@example.com", topic: "Compatibility", message: "Does the planned release support my setup?", companyWebsite: "" });

async function request(body = validBody(), options = {}) {
  const headers = {};
  let result;
  const response = {
    setHeader: (name, value) => { headers[name.toLowerCase()] = value; },
    end: value => { result = JSON.parse(value); }
  };
  await handler({ method: "POST", headers: { "content-type": "application/json" }, body, ...options }, response);
  return { status: response.statusCode, headers, body: result };
}

test("valid requests fail closed without calling a network API, even with provider-like configuration", async () => {
  const originalFetch = global.fetch;
  const keys = ["RESEND_API_KEY", "SUPPORT_FROM_EMAIL", "SUPPORT_TO_EMAIL", "SUPPORT_ENABLED"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  let fetches = 0;
  global.fetch = () => { fetches += 1; throw new Error("Network must not run"); };
  Object.assign(process.env, { RESEND_API_KEY: "mock-not-a-secret", SUPPORT_FROM_EMAIL: "from@example.com", SUPPORT_TO_EMAIL: "to@example.com", SUPPORT_ENABLED: "true" });
  try {
    for (const body of [validBody(), JSON.stringify(validBody()), Buffer.from(JSON.stringify(validBody()))]) {
      const result = await request(body);
      assert.equal(result.status, 503);
      assert.equal(result.body.code, "SUPPORT_UNAVAILABLE");
      assert.equal(result.body.sent, false);
      assert.equal(result.body.ok, false);
      assert.match(result.body.message, /not sent or saved/);
      assert.equal(result.headers["cache-control"], "no-store");
    }
    assert.equal(fetches, 0);
  } finally {
    global.fetch = originalFetch;
    for (const key of keys) previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key];
  }
});

test("only POST JSON is accepted", async () => {
  const wrongMethod = await request(validBody(), { method: "GET" });
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.allow, "POST");
  assert.equal((await request(validBody(), { headers: {} })).status, 415);
  assert.equal((await request(validBody(), { headers: { "content-type": "text/plain" } })).status, 415);
  assert.equal((await request(validBody(), { headers: { "content-type": "application/json; charset=utf-8" } })).status, 503);
});

test("malformed, non-object and incomplete bodies are rejected without echoing their contents", async () => {
  for (const body of ["{broken", null, [], "[]", "null", 42, {}, { ...validBody(), message: " " }, { ...validBody(), name: 1 }]) {
    const result = await request(body);
    assert.equal(result.status, 400);
    assert.equal(result.body.sent, false);
    assert.doesNotMatch(result.body.message, /engineer@example|broken/);
  }
});

test("raw, parsed, declared and UTF-8 payload sizes are bounded", async () => {
  assert.equal((await request(" ".repeat(12289))).status, 413);
  assert.equal((await request({ ...validBody(), message: "😀".repeat(4000) })).status, 413);
  assert.equal((await request(validBody(), { headers: { "content-type": "application/json", "content-length": "12289" } })).status, 413);
  assert.equal((await request(validBody(), { headers: { "content-type": "application/json", "content-length": "invalid" } })).status, 400);
  for (const [field, value] of [["name", "n".repeat(101)], ["topic", "t".repeat(81)], ["message", "m".repeat(5001)], ["companyWebsite", "w".repeat(201)]]) {
    assert.equal((await request({ ...validBody(), [field]: value })).status, 400);
  }
});

test("header-like input rejects CRLF and malformed addresses; body paragraphs remain valid", async () => {
  for (const email of ["not-email", "a@localhost", "a@@example.com", "a@example.com\r\nBcc: victim@example.com", "a@example.com\n", "Name <a@example.com>", ".a@example.com", "a..b@example.com", "a@-example.com", "a@exam ple.com"]) {
    assert.equal((await request({ ...validBody(), email })).status, 400, email);
  }
  for (const field of ["name", "topic"]) {
    assert.equal((await request({ ...validBody(), [field]: "hello\r\nBcc: victim@example.com" })).status, 400);
  }
  assert.equal((await request({ ...validBody(), message: "First paragraph.\r\nSecond paragraph." })).status, 503);
});

test("clients cannot choose recipients, senders, headers or attachments", async () => {
  for (const field of ["to", "from", "reply_to", "bcc", "headers", "html", "attachments", "__proto__"]) {
    const body = JSON.parse(JSON.stringify(validBody()));
    Object.defineProperty(body, field, { value: "victim@example.com", enumerable: true });
    assert.equal((await request(JSON.stringify(body))).status, 400, field);
  }
});

test("filled honeypots and omitted optional honeypots never report a delivery", async () => {
  const filled = await request({ ...validBody(), companyWebsite: "https://spam.example" });
  const withoutHoneypot = validBody();
  delete withoutHoneypot.companyWebsite;
  const omitted = await request(withoutHoneypot);
  assert.equal(filled.status, 503);
  assert.equal(filled.body.sent, false);
  assert.deepEqual(filled.body, omitted.body);
});
