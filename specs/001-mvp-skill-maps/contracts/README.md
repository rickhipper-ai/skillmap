# API Contracts

The MVP exposes the HTTP interface documented in [openapi.yaml](openapi.yaml).

## Contract Rules

- OpenAPI 3.1 is generated from or validated against Fastify runtime schemas.
- All routes are rooted at `/v1`; incompatible changes require a new major path version.
- Browser authentication uses the opaque `__Host-skillmaps-session` cookie.
- Every state-changing browser request requires an allowed `Origin` and `X-CSRF-Token`.
- Retryable command endpoints additionally require `Idempotency-Key`.
- Errors use RFC 9457 `application/problem+json` with stable `code` values.
- Dates and timestamps use ISO 8601; identifiers are UUIDs unless documented otherwise.
- List endpoints use cursor pagination and never expose internal sequential event IDs as user IDs.
- CI validates the document, generated client, documented responses, and incompatible diffs.

## Compatibility

Adding optional response fields or endpoints is compatible. Removing or renaming fields, changing
their meaning/type, making optional input required, or changing authorization is incompatible and
requires a reviewed version transition.
