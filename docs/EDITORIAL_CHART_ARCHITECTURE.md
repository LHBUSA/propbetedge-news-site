# Editorial charts — architecture decision

**Status: DECIDED, NOT IMPLEMENTED.** Recorded now so the decision survives the
gap between the entity-hub reconciliation and the chart build. No chart code
exists yet, by instruction.

---

## The decision that constrains everything else

> A published `article.visuals` entry stores **frozen values plus provenance
> and a `source_hash`**. It never resolves a statistical value from a live hub
> snapshot at read time.

An article published on 21 September saying *"Olivia Miles leads at 87"* must
still show 87 in five years, even though the live leaderboard moved to 84 the
following week. Rendering a published chart from a live source would silently
rewrite history and make the prose contradict its own graphic.

So there are two distinct things, and they must never be confused:

| | reads from | changes over time |
|---|---|---|
| **Live product page** (`/player/:sport/:id`) | `pbe-entity-hub` KV snapshot | yes, by design |
| **Published editorial chart** (`article.visuals`) | values copied at publish | **never** |

The hub is the *source* a chart is built from at publication. It is not a
runtime dependency of a published chart. A chart that still needs the hub after
publication is a bug.

## Why the hub already gives this for free

The snapshot envelope built for the entity hub carries exactly what a frozen
chart needs to be auditable years later:

```
source_product   source_route   source_ids
observed_at      fetched_at     refreshed_at
source_hash      completeness   schema_version
```

At publish time the chart planner copies the values it plotted **and** that
provenance block into the article. `source_hash` then answers "were these
numbers the ones the hub held at that moment", which is the difference between
a chart you can defend and a chart you merely remember making.

## Consequences to honour when building

1. **No live reads in a published article.** The renderer receives values, not
   an entity reference to resolve.
2. **Nulls stay null.** The hub already refuses to coerce a blank upstream cell
   to zero (see the NBA blank-cell fix); the chart layer must not undo that.
   `Number(null) === 0` is the specific failure to test against.
3. **A frozen chart records the season it belongs to.** The NBA adapter bug —
   summing preseason, regular season and playoffs into one figure labelled
   "Season to date" — is exactly the class of error a chart makes permanent and
   highly visible.
4. **Unsupported is not zero.** An NFL lineman has no passing yards because the
   product does not cover him, not because he threw for none. A chart must not
   plot `unsupported` as a data point.
5. **Chart failure must not block publication.** Validation rejects the chart,
   the article still ships, and the rejection is counted.

## Not yet decided

Chart types, eligibility scoring, the renderer, and which article kinds qualify
— all of that follows the reconciliation and will be designed against the real
`article.visuals` contract rather than sketched here.
