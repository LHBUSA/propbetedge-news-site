# Root article social cards: rights plan

Status 2026-10-02: investigation only. Nothing here is shipped.

## Problem

`/api/social-card` (tiers in `src/entity-graph/share-image.js`) composites a
third-party image into most article cards:

| Tier | What is composited | Share of 103 current articles |
|---|---|---|
| 1 `editorial_photo` | the article's `image_url`, i.e. a publisher press photo (ESPN, CBS/Getty, FanGraphs…) with no credit data | 89 (86%): all MLB, NBA, NFL samples |
| 2 `player_headshot` | league/ESPN headshot | 0 |
| 3 `team_mark` | team logo | 0 |
| 4 `league_card` | nothing: PropBetEdge typography only | 14 (mostly NHL) |

Under `docs/IMAGE_METADATA_CONTRACT.md`, tiers 1-3 are **held**: no
`creator`/`copyrightNotice`. So Search Console's "Missing field creator /
copyrightNotice" warnings stay on ~86% of root articles. Re-publishing those
photos inside our own card is also a rights exposure in its own right.

The article page's own editorial photo is out of scope; this plan only
changes the card.

## Options

1. **Owned editorial card (recommended first step).** Make tier 4 the default
   and make it good enough to stand in for the photo: headline, the
   correct subject line, sport accent, a large typographic team/sport field
   on the right half, and one real number from the story (score, line or stat)
   when the article carries one. No third-party pixels → `owned`,
   "© <year> PropBetEdge". This is immediate and site-wide.
2. **Credited photo card (later, per sport).** Resolve the story's primary
   player to an identity-verified Wikimedia Commons photo, as WNBA (166
   approved), UFC (566), Tennis and Golf already do. That composite is
   `owned_composite` with "Photo: <author> / <license>". MLB, NFL, NBA and NHL
   have no such catalog yet; build one before this option is usable.
3. **Keep press photos** and accept the held state and the warnings.

## Bugs found while investigating

- The tier-4 card for
  `/news/nhl/cooper-s-frustration-after-5-1-loss-signals-deeper-tampa-bay-malaise-than-season-opener-blow-2026-10-02`
  captions a Tampa Bay story "Igor Shesterkin · New York Rangers": the
  subject line names the wrong entity. That is the failure `selectShareSubject`
  says it prevents. Fix before tier 4 becomes the default.
- The bare tier-4 card (no headline) leaves the right half empty. Option 1 has
  to fill it, or share previews get worse.

## Acceptance for option 1

- 1200×630 at all four variants (`og`, `16x9`, `4x3`, `1x1`)
- side-by-side review against current tier-1 cards for the same articles
- subject line verified against the article's tagged primary entity
- `X-Pbe-Card-Tier: 4` on every article; JSON-LD reports owned
- no change to article pages or their editorial photos
