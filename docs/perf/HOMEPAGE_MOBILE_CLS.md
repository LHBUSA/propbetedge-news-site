# Homepage mobile CLS ≈ 0.28 — pre-existing, scoped fix ticket (2026-10-04)

**Status:** open · **Scope:** homepage lead/breaking layout only · **Not caused by** the Predictions network change.

## Measurement (same harness, same device profile)

Harness: fresh Chrome context per run (cold cache), mobile emulation (390×844 and 430×932, DPR 2, touch), load the
real origin `https://propbetedge.ai/`, observe `layout-shift` for `load` + 10 s with no input. For the before/after,
only the HTML document and `/assets/*` were served from a local build of each commit; every data/API request went to
production on the real origin, so both builds rendered the same live content (3 runs × 2 widths each).

| Build | Mean CLS | Range |
|---|---|---|
| `8a88c81` (parent, before network integration) | 0.287 | 0.256–0.310 |
| `246678a` (after network integration) | 0.280 | 0.256–0.310 |
| production (no interception) | 0.231* | 0.256–0.310 (*one run had a data failure → 0) |

Preview deployment URLs measure ~0 only because the news API refuses non-production origins (403), so the
homepage shows its empty state and never renders the lead — they are not valid for CLS.

## Shift sources

1. `#breaking-slot` — the breaking banner is injected at ~1.0–1.5 s with no reserved height; `main` moves
   y277 → y322 (~45 px).
2. `#lead-slot` skeleton is far shorter than the rendered cinematic lead (≈598 px tall at 390 px); when the lead
   renders, `aside#sidebar-slot.lead-sidebar` (Top Stories) is pushed out of the viewport (y658 h186 → off-screen).
   Largest single shift ≈ 0.24–0.30.

## Scoped fix (proposal)

- Reserve the breaking banner's height before data (`min-height` on `#breaking-slot` when a breaking story is
  possible, or render the banner below the lead) — no layout redesign.
- Make `leadSkeleton()` occupy the same box as the rendered lead at each breakpoint (aspect-ratio/min-height
  matching `.lead-hero` on mobile) so Top Stories does not move.
- Acceptance: mobile CLS < 0.1 at 390 and 430 with the harness above; desktop unchanged.
