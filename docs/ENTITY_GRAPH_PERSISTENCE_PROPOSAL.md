# PropBetEdge content graph — persistence proposal

**Status: PROPOSED. Nothing here has been applied.**
No migration has been run, no Supabase row has been written, and
`propbet-news-api` has not been redeployed. This document exists so the
persistence step can be reviewed and approved on its own merits, after the
render-time implementation has proven itself in production.

---

## 1. Why this is a proposal and not a change

The content graph shipped in `src/entity-graph/*` derives every article's
entity manifest at render time from a committed entity dictionary. That was a
deliberate choice, and it is worth being clear about what it already gives us,
because it determines how urgent this proposal is:

| Property | Derived today | Would persistence improve it? |
|---|---|---|
| Covers the full archive | Yes — every article, immediately | No |
| Identical on server and client | Yes — one module, both callers | No |
| Real entity ids only | Yes | No |
| Zero risk to `published_at` | Yes — the pipeline never writes | No |
| Survives a dictionary rebuild | Yes, by recomputation | Persistence would *freeze* the answer |
| Cost per article render | One index lookup, no I/O | Marginally cheaper |
| Resolves free agents, coaches, retired players | **No** | **Yes** — a stored id outlives the roster |
| Queryable ("every article about player X") | Only via the newsroom's name tags | **Yes** — id-keyed, exact |
| Generator owns entity identity | No — the renderer infers it | **Yes** |

The two rows in bold are the real case for persisting. Everything else already
works. This is an improvement, not a repair.

### The concrete gap persistence closes

Measured on the live archive: **4.4% of tagged entity mentions do not resolve**
against a current-roster dictionary. Inspected, they fall into four groups:

1. **Coaches, executives and analysts** — "Aaron Boone", "Torey Lovullo",
   "Steve Ballmer". Correctly unresolved; they are not players and must never
   link to a player page. Persistence does not help and should not.
2. **Team units** — "Baltimore Ravens defense". Correctly unresolved.
3. **Genuine namesakes** — "Max Muncy" (two active MLB players), "Elias
   Pettersson" (two active NHL players). Deliberately withheld unless the
   article's own team tags break the tie. Persistence *does* fix these, because
   the generator knows which player it wrote about.
4. **Off-roster players** — free agents, DFA'd players, retirees. A roster
   snapshot cannot see them; a stored id can.

Groups 3 and 4 are the entire benefit. They are worth having, and they are not
worth a rushed production migration.

---

## 2. Migration

> **Confirm the base table name before applying.** The news API reads the view
> `v_news_with_takes`; the underlying table is not visible from the Worker
> source in this repo. `news_views.article_id` implies `news_articles`, but that
> must be verified against the live schema rather than assumed. Every statement
> below is written to be re-runnable.

```sql
-- migrations/0001_article_entity_manifest.sql
-- PropBetEdge content graph: persisted entity manifest + SEO contract.
-- Additive only. No existing column is altered, renamed or backfilled in place.

begin;

alter table public.news_articles
  add column if not exists entities        jsonb,
  add column if not exists seo             jsonb,
  add column if not exists entities_version text,
  add column if not exists entities_built_at timestamptz;

comment on column public.news_articles.entities is
  'Deterministic entity manifest: {players:[{id,name,sport}],teams:[{id}],games:[{id,sport}]}. '
  'Ids only — display names, URLs and imagery are derived at render time so a '
  'roster change never has to rewrite history.';

comment on column public.news_articles.seo is
  'Optional per-article SEO overrides: {canonical_url, meta_title, meta_description, share_image_url}. '
  'NULL means "derive", which is the normal case.';

-- Query support for entity -> articles. GIN over the jsonb path lets
-- "every article about player 4432737" be an index scan instead of a filter.
create index if not exists news_articles_entities_gin
  on public.news_articles using gin (entities jsonb_path_ops);

create index if not exists news_articles_entities_built_at
  on public.news_articles (entities_built_at)
  where entities is not null;

commit;
```

### What the migration deliberately does NOT do

- It does not touch `published_at`, `updated_at`, `title`, `summary`, `body`,
  `body_html`, `source`, `source_url` or any take column.
- It does not set `updated_at` on backfill. A metadata backfill must never
  resurface an old story as new in the Google News sitemap, which reads
  `published_at` for `news:publication_date` and `updated_at` for `lastmod`.
  **The backfill writer must explicitly exclude `updated_at` from its payload**,
  because PostgREST will happily fire an `updated_at` trigger otherwise. Verify
  whether a `moddatetime` trigger exists on the table before writing a single
  row; if it does, the backfill must disable it for the duration or write
  through a function that preserves the original value.
- It adds no NOT NULL and no default, so existing rows stay valid and the
  renderer's "derive when absent" path keeps serving them unchanged.

---

## 3. Manifest payload shape

Ids only. This is the single most important design decision in the proposal:
storing display names, URLs or image links would freeze a snapshot of
2026 rosters into permanent rows and guarantee drift.

```json
{
  "version": 1,
  "players": [{ "id": "4432737", "sport": "nba", "name": "Jaden Bradley" }],
  "teams":   [{ "id": "TOR",     "sport": "nba" }],
  "games":   [{ "id": "401872936", "sport": "nfl" }]
}
```

`name` is carried for human debugging only. The renderer already ignores it:
`adoptPersistedManifest()` in `src/entity-graph/manifest.js` looks the id up in
the dictionary and **drops any entity whose id does not resolve**, reporting it
as `persisted_id_unknown`. A bad row therefore degrades to the derived path
rather than emitting a broken link. That behaviour is already implemented and
already under test.

---

## 4. `propbet-news-api` change

One line in `shapeArticle()`:

```js
function shapeArticle(row) {
  return {
    // …unchanged…
    entities: row.entities || null,
    seo: row.seo || null,
  };
}
```

That is the whole API change. The site needs nothing else: the renderer already
prefers `article.entities` when present and falls back to derivation when it is
absent or unusable.

**Deployment note.** `workers/propbet-news-api/src/index.js` in
`propbetedge-workers` is a *captured reconstruction* of the deployed bundle
(`no_bundle = true`, per its `wrangler.toml`). It is readable source, but the
deploy path is `wrangler versions upload` + `wrangler versions deploy`, and the
current production version (`eee27b78-cd08-469a-b5a4-aca2393068cf`, deployment
`540514a8-5dff-4417-ad6e-3dbbf71119ab`) must be captured as the rollback target
before anything is uploaded.

---

## 5. Generator contract

The separation the renderer already enforces, stated for the generator:

> The generator identifies **entities**. The renderer creates **links**.
> Prose generation must never emit HTML anchors.

Target article shape:

```jsonc
{
  // …existing fields, unchanged…
  "entities": {
    "version": 1,
    "players": [{ "id": "4432737", "sport": "nba", "name": "Jaden Bradley" }],
    "teams":   [{ "id": "TOR", "sport": "nba" }],
    "games":   [{ "id": "401872936", "sport": "nba" }]
  },
  "seo": {
    "canonical_url":    null,   // null = derive (normal)
    "meta_title":       null,
    "meta_description": null,
    "share_image_url":  null
  }
}
```

Rules for the generator:

1. Emit an id **only** when it is certain. An omitted entity is recovered by
   the renderer's derivation; a wrong id produces a wrong link, which
   derivation would never have produced.
2. Ids must come from the same sources the routes resolve against: MLB StatsAPI
   person ids, ESPN athlete ids for NFL/NBA, NHL api-web ids, ESPN team
   abbreviations, ESPN event ids.
3. `seo` fields stay null unless an editor deliberately overrides one.
4. The generator never writes anchors, never writes `share_image_url` pointing
   at a third-party CDN, and never sets `updated_at` to "now" for a metadata-only
   change.

**The generator source is not in any repository on this machine.** It writes to
Supabase directly and is not in `propbetedge-news-site`, `propbetedge-workers`
or `propbetedge-v2`. Implementing this contract requires locating that pipeline
first; that is a prerequisite of this proposal, not a detail of it.

---

## 6. Rollout, with a proof step before the switch

The renderer already prefers persisted data, which means a bad backfill would
take effect the moment it lands. The rollout therefore proves equivalence
*before* trusting it, not after.

1. **Apply the migration.** Additive; no behaviour change, because every
   `entities` is NULL and the renderer derives as it does today.
2. **Deploy the API change.** Still no behaviour change, for the same reason.
3. **Shadow backfill.** Write `entities` for one league only, in a single
   batch, with `updated_at` explicitly excluded from the payload.
4. **Prove it.** Re-run `node scripts/entity-backfill.mjs --sport <league>` and
   confirm: the failure budget is still all zeros, `published_at` is unchanged
   for every row, and the persisted manifests resolve to the same canonical URLs
   the derived ones did — except where they *deliberately* differ, which should
   be only the namesake and off-roster cases this proposal exists to fix.
5. **Compare the sitemap.** Diff `/news-sitemap.xml` before and after. Any
   change to a `news:publication_date` is a stop-and-revert.
6. Only then extend to the remaining leagues, one at a time.

### Rollback

Each step reverses independently:

- Backfill: `update public.news_articles set entities = null where …` — the
  renderer immediately returns to derivation.
- API: `wrangler versions deploy` back to the captured version id.
- Migration: `alter table … drop column if exists entities, drop column if
  exists seo, …` — safe once no row depends on it.

No step requires the next one, and none of them can alter editorial copy or a
publication timestamp.

---

## 7. Open questions for the owner

1. What is the base table behind `v_news_with_takes`, and does it carry an
   `updated_at` trigger?
2. Where does the article generator run? It is not in any local repository.
3. Should namesake disambiguation (group 3 above) be persisted by the generator,
   or resolved by an editor tool? The generator has the context; an editor has
   the judgement.
