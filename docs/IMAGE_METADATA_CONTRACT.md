# PropBetEdge image metadata contract

Canonical rules for every schema.org `ImageObject` on the PropBetEdge network.
Implementation: `src/image-metadata.js` (this repo). The same module is copied,
unchanged except for its path comment, into each site repo that emits
`ImageObject` JSON-LD.

## Normalized record

```
{ url, contentUrl, width, height, caption, creditText, creator_name,
  creator_type, copyrightNotice, license, acquireLicensePage, source_url,
  source_type }
```

`imageObject(record)` is the only code that turns a record into JSON-LD.
Builders: `ownedImage`, `licensedImage`, `thirdPartyImage`, `compositeImage`.

## Rights rules

| source_type | When | creator | copyrightNotice | license / acquireLicensePage |
|---|---|---|---|---|
| `owned` | PropBetEdge logo, static brand cards, generated cards with no third-party pixels | Organization `PropBetEdge` | `© <year> PropBetEdge` | none |
| `cc_licensed` | Commons / CC photo **with a recorded author and license** | the recorded author (Person, or Organization when the name is an outlet/agency/club) | `<author> / <license>` | license URL / Commons file page |
| `owned_composite` | PropBetEdge card embedding other images, every part known | Organization `PropBetEdge` | `© <year> PropBetEdge. Photo: <author> / <license>` | ShareAlike license URL when the photo is SA (the card is an adaptation) |
| `owned_composite` (held) | card embedding any part with unknown rights (press photo, provider headshot, team/league mark, flag) | — | — | — |
| `third_party` | press photo, provider headshot, team/league mark | only what the source itself published | only what the source itself published | only what the source itself published |

Never:

- `© PropBetEdge` on pixels PropBetEdge did not make.
- `© ESPN` (or any host) inferred from the URL a file was fetched from.
- A guessed photographer.

A held image keeps `url`, `contentUrl`, `width`, `height`, `caption`; it just
carries no rights claim. Search Console may keep reporting "Missing field
creator / copyrightNotice" on held images — that is the truthful state until a
real rights record exists for the embedded image.

## Year

Generated per-article cards use the article's publication year. Static brand
art uses `PBE_BRAND_YEAR` (2026).

## Ownership posture

The public-facing owner of PropBetEdge art is **PropBetEdge** — the name the
site footer uses (`© <year> PropBetEdge`). PropTechUSA.ai is listed as the
parent organization in the Organization node, not as image creator.
