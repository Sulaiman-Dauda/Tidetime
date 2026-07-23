# Security Policy

> Audience: security reporters, maintainers, and self-hosters.
>
> For setup and deployment help, see the [README](./README.md) and
> [deployment guide](./docs/DEPLOYMENT.md).

## Supported versions

Tidetime is currently maintained on the latest default branch and the latest tagged release line.

When a new release is published, users should upgrade promptly because security fixes may not be backported indefinitely.

## Reporting a vulnerability

Please **do not** report vulnerabilities in public issues or discussions.

Instead:

1. use your repository host's **private vulnerability reporting** feature if it is enabled
2. otherwise contact the maintainers privately before any public disclosure

Please include:

- a clear description of the issue
- affected versions or commit hashes
- reproduction steps or a proof of concept
- the expected impact
- any suggested remediation, if known

## What to expect

Maintainers will try to:

- acknowledge the report promptly
- validate and triage the issue
- work on a fix or mitigation
- coordinate disclosure once users have a reasonable upgrade path

## Security design notes

Tidetime already includes several security-focused defaults:

- hashed opaque session tokens
- `scrypt` password hashing
- AES-GCM encryption for stored credentials
- HMAC-signed outgoing webhooks
- SSRF-resistant webhook validation with DNS-pinned outbound connections
- role- and ownership-scoped server authorization
- global security headers with clickjacking protection on sensitive routes
- strict environment validation in production

## Disclosure guidance

Please avoid publishing exploit details until maintainers have had time to investigate and release a fix.
