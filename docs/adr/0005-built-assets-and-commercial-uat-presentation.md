# ADR-0005 — Built assets and commercial UAT presentation

## Status

Accepted for TASK-0023.

## Context

The LOCAL USER UAT previously ran the Vite development server while `index.html`
kept an external-style-only CSP. Vite transforms CSS imports into JavaScript that
injects an inline `<style>` element. A conforming browser rejects that element,
so the authenticated application was usable but rendered as unstyled HTML.
HTTP-only health checks and semantic browser assertions did not detect the
computed-style failure.

The workbench also exposed diagnostic detail before the reviewer's primary task,
which made the otherwise complete text-first flow feel like a developer console.

## Decision

- Build the UAT frontend with the exact pinned Node/npm toolchain.
- Serve the resulting hashed JavaScript and external CSS from unprivileged Nginx.
- Keep `style-src 'self'`; do not add `unsafe-inline`.
- Runtime-substitute only the Backend and same-origin OIDC proxy origins.
- Preserve native TypeScript, API contracts, authentication, recovery state, form
  names, accessibility semantics, and safe text rendering.
- Apply a commercial internal-SaaS presentation layer:
  - branded login and App Shell;
  - compact, always-visible safety strip;
  - searchable review queue and separated Test Lab;
  - guided Case steps;
  - sticky review section navigation;
  - stronger document, Evidence, report, HITL, Chat, and history hierarchy.
- Put runtime hashes and diagnostic detail behind progressive disclosure, while
  keeping `3/58`, text-only, auto-off, and not-Production boundaries visible.
- Require actual Chrome assertions for an external stylesheet and computed App
  Shell layout.

## Consequences

- UAT startup builds a static image instead of serving source modules.
- CSP behavior now matches the Production static-asset model.
- The visual redesign remains independent of Agent/Data/Backend semantics.
- This is still a LOCAL USER UAT and does not add OCR, 58-law legal coverage,
  automatic completion, or Production release approval.
