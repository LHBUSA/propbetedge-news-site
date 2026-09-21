# PropBetEdge news site — open issues

Tracked separately so unrelated repairs do not get folded into whatever release
happens to be in flight.

---

## P1 — ESPN CORS breaks the live score strip

**Status: OPEN. Not part of the entity-hub work.**

Every article page on propbetedge.ai logs **16 console errors**, all of the
form:

```
Access to fetch at 'https://site.api.espn.com/apis/site/v2/sports/.../scoreboard?dates=…'
from origin 'https://propbetedge.ai' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### What it is

`src/api-sports.js` calls `site.api.espn.com` directly from the browser to feed
the header score ticker. ESPN has stopped sending `Access-Control-Allow-Origin`
for this origin, so every one of those calls fails and the ticker renders empty.

### What it is not

It is **not** caused by the content graph, the share bar or the entity hub.
`git diff 835444a..HEAD -- src/api-sports.js src/components/score-strip.js`
is empty; the last commit to touch those files is `9dfd9d9`, well before any of
this work. It was recorded during content-graph QA and deliberately left alone.

### Why it matters

- the score strip is blank on every page
- 16 console errors per page view is noise that hides real errors from anyone
  debugging something else

### The fix is already proven elsewhere in the network

The NBA product hit exactly this and documented it in
`nba-propbetedge/docs/NBA_SOURCE_MATRIX.md` (measured 2026-09-11): ESPN answers
Cloudflare egress with 403 and browser origins with a missing CORS header,
while **`site.web.api.espn.com` serves byte-identical payloads** and does
answer. Their fix was an owned relay.

Two options, both already patterns in this network:

1. Point `src/api-sports.js` at `site.web.api.espn.com`. Smallest change;
   verify it actually sends the CORS header for this origin before relying on it.
2. Route the ticker through an owned same-origin relay, the way the NBA product
   does with `/api/nba-provider`. More robust, and it keeps provider quirks out
   of the browser.

Either way it is a self-contained change to the score strip and should ship on
its own, with its own QA, rather than riding along inside an entity release.

---

## P2 — NFL team enrichment awaits a key

`propsports-api /v1/nfl/*` needs `PROPSPORTS_API_KEY`, set as a **Cloudflare
Worker secret on `pbe-entity-hub`** and nowhere else. Until it exists, NFL teams
are stored at `identity_only`: real name, slug, abbreviation and logo, with no
roster, record or standings. No ESPN fallback, and nothing fabricated.

NFL **players** are unaffected — `nfl.propbetedge.ai/api/player-career` is open
and already backfilled.
