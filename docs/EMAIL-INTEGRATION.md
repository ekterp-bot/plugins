# Plugin support: email integration and evidence

**October 19, 2026.** `api/support.js` is a local, dependency-free CommonJS validation endpoint. It deliberately has **no sending transport, storage or provider calls**. It cannot be enabled by setting a key or a `SUPPORT_ENABLED` flag. A valid request returns HTTP 503 and explicitly says the message was not sent or saved.

## What is implemented

| Request | Result |
| --- | --- |
| POST `application/json` with valid `name`, `email`, `topic`, `message` and optional `companyWebsite` | 503 `SUPPORT_UNAVAILABLE`; `ok: false`, `sent: false` |
| Other HTTP method | 405 with `Allow: POST` |
| Missing or incompatible content type | 415 |
| Malformed JSON, missing/type-invalid fields, invalid email, unwanted fields or forbidden control characters | 400 with a generic message |
| Declared or serialized body larger than 12 KiB | 413 |
| Filled honeypot | Same unavailable response; no success claim or delivery |

The hosting adapter must provide `request.body` as a parsed JSON object, string or Buffer. It must also enforce a body limit **before** buffering/parsing a raw HTTP stream; this handler cannot undo work already performed by a hosting adapter. Field limits are 100 JavaScript string units for name, 254 for email, 80 for topic, 5,000 for message and 200 for the honeypot. Message paragraphs are permitted; CR/LF and other control characters are forbidden in single-line fields. Email addresses are validated conservatively; internationalized local parts are not supported.

Only the five form fields are accepted. Client-supplied `to`, `from`, `bcc`, `reply_to`, HTML, headers and attachments are rejected. Responses are JSON, non-cacheable, and never echo submitted content. The endpoint does not log messages or provider responses.

The frontend performs browser validation and displays an unsent preview; it does not call this endpoint or transmit/store form data. Its submit button remains disabled without browser JavaScript. Retain the honest unavailable result if the endpoint is connected later: do not clear the user's text or replace it with “message sent.” No fallback may call the old intake route. Run the local handler tests with:

```text
node --test tests/support.test.cjs
```

These tests substitute a throwing `fetch` mock and show that no network call occurs, including when provider-like environment values are present. They cover malformed and oversized inputs, header injection, recipient control and unavailable responses. They do not demonstrate provider authentication, DNS verification, inbox placement or deployed routing.

## Legacy intake retired in the local storefront branch

`api/intake.js` now returns HTTP **410 Gone**, `ok: false` and `sent: false` in this isolated storefront branch. It performs no provider call. The local development server also treats retired API routes as unavailable. The earlier service-intake implementation remains recoverable in Git at `24f0574`; it is not used by the new support endpoint.

This is a local source change. The live website and deployed intake route were not modified. Safe GET requests to `https://www.hextheengineer.com/api/intake` and the existing Vercel alias returned 405 with `Allow: POST`, matching the original handler's method gate. No POST or delivery test was performed, and production intake is not retired by this branch. Any eventual deployment must confirm that the retired handler and new route configuration are included; removing a frontend link alone would not retire a deployed API.

## Evidence limits

- Repository code and `.env.example` were inspected. The example contains empty documentation placeholders. Legacy intake variable names are historical context; neither the disabled support handler nor the retired intake handler uses them to send email.
- No secret values were read, printed, created or changed.
- Public evidence confirms that the corrected domain redirects to `www.hextheengineer.com`, serves the matching baseline site through Vercel and exposes the intake method gate. DNS shows Hostinger mail routing and SPF. See the [infrastructure audit](INFRASTRUCTURE-AUDIT.md) for exact records and hashes.
- The Vercel connector remains unauthorized on the latest check. The owner intends to reconnect it; account-side environment values, sender settings, team/project ownership, production-branch binding and runtime configuration remain unverified.
- No Resend account/domain/sender status was inspected. No DNS records were changed and no test or real email was sent.
- The original function's safe HTTP response establishes a live endpoint, not email delivery or every runtime setting. Reuse the existing Vercel project after authenticated configuration inspection; a new hosting platform is not needed for this local prototype.

## Future approved transport

Retain the existing human support mailbox provider. Resend can provide the outbound notification service; domain verification alone does not establish the human mailbox used to read and answer support.

1. **Confirm the existing runtime and routing.** Reuse its server capability for one POST endpoint. If it only serves static files, select an appropriate existing form/server capability before enabling the form. Keep this endpoint disabled until routing, secrets, abuse protection and failure behavior are verified.
2. **Verify an owned transactional subdomain.** Use a stable sender at that subdomain and a fixed recipient in server configuration. Resend recommends subdomains to separate reputation. Configure the exact account-generated DNS records and preserve existing mailbox routing. Current documentation notes that older domains may show TXT/MX records while domains created after August 2026 can show CNAME records. [Verified domains](https://resend.com/docs/dashboard/domains/introduction), [verification troubleshooting](https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying).
3. **Review authentication safely.** Confirm SPF/DKIM verification and the domain's existing sending services before changing DMARC enforcement. Start with monitoring when those services are not yet fully understood. [DMARC policy guidance](https://resend.com/blog/dmarc-policy-modes).
4. **Keep credentials private.** Use a narrowly scoped, domain-restricted sending key in the host's server-side secret store, separated from preview/development values. Never expose it in public JavaScript, HTML, client environment prefixes, logs or a committed env file. `.env.example` is documentation only and is not automatically loaded. [Resend API keys](https://resend.com/docs/dashboard/api-keys/introduction).
5. **Add shared abuse protection before live transport.** Apply limits across all instances using an appropriate existing gateway/shared store, not a per-process memory counter. Bound raw body size before parsing, validate fields, use the honeypot, and verify a bot challenge server-side when selected. Origin checks alone are insufficient. Disable transport when the protection service is unavailable; do not bypass it. [OWASP REST guidance](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).
6. **Send one internal notification.** Use fixed server-controlled `From`/`To` values, the visitor's validated address only as `Reply-To`, and a fixed or allowlisted subject. Escape any user text rendered as HTML or use plain text. Do not accept arbitrary recipients or attachment URLs. Use the runtime's existing `fetch` capability; no extra SDK is required. [Resend send API](https://resend.com/docs/api-reference/emails/send-email).
7. **Handle failure without duplicates or disclosure.** Add a bounded request timeout, catch network exceptions, inspect the provider's HTTP result, and return generic errors. Do not log provider response bodies or submitted messages. Use stable idempotency keys for retries. Report acceptance only after the provider accepts; acceptance is not proof of inbox delivery. [Idempotency](https://resend.com/blog/engineering-idempotency-keys).
8. **Avoid an email relay.** Initially omit automatic confirmations to arbitrary visitor-entered addresses. Any future autoresponder needs its own abuse controls. Keep marketing opt-in independent; a support inquiry is not newsletter consent. Handle bounces and complaints, and keep transactional tracking disabled unless needed. [Consent and reputation](https://resend.com/blog/6-steps-to-improve-your-sender-reputation-score), [domain segmentation](https://resend.com/docs/dashboard/domains/introduction).

## Later validation

Use mocks first for provider rejection, timeout, duplicate submission, limiter failure and bot-challenge failure. Only after explicit authorization and verified configuration, send a controlled test to an owned support inbox and verify receipt/reply routing. A deploy, successful JSON response or provider acceptance alone does not establish end-to-end delivery. Document the actual host, sender-domain state, test recipient and observed result without exposing secrets or private messages.
