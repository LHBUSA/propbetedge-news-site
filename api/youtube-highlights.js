const SPORTS = Object.freeze({
  mlb: { label: 'MLB', handle: 'MLB', channelId: 'UCoLrcjPV5PbUrUyXq5mjc_A' },
  nfl: { label: 'NFL', handle: 'NFL', channelId: 'UCDVYQ4Zhbm3S2dlz7P1GBDg' },
  nba: { label: 'NBA', handle: 'NBA', channelId: null },
  nhl: { label: 'NHL', handle: 'NHL', channelId: 'UCqFMzb-4AUf6WAIbl132QKA' },
});

const USER_AGENT = 'Mozilla/5.0 (compatible; PropBetEdge/1.0; +https://propbetedge.ai)';
const FEED_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const sport = String(req.query?.sport || '').toLowerCase();
  const meta = SPORTS[sport];
  const limit = Math.min(8, Math.max(1, Number.parseInt(req.query?.limit, 10) || 6));

  if (!meta) {
    return res.status(400).json({ ok: false, error: 'unsupported_sport' });
  }

  try {
    const { xml, channelId } = await fetchOfficialFeed(meta);
    const videos = await selectEmbeddableHighlights(parseFeed(xml, sport), sport, limit);

    return res.status(200).json({
      ok: true,
      sport,
      league: meta.label,
      source: 'youtube_official_channel_feed',
      channel: {
        id: channelId,
        handle: `@${meta.handle}`,
        name: videos[0]?.channelName || meta.label,
        url: `https://www.youtube.com/@${meta.handle}`,
      },
      generated_at: new Date().toISOString(),
      count: videos.length,
      videos,
    });
  } catch (error) {
    console.warn('[youtube-highlights]', sport, error?.message || error);
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(502).json({ ok: false, sport, error: 'youtube_feed_unavailable' });
  }
}

async function fetchOfficialFeed(meta) {
  const candidates = [meta.channelId].filter(Boolean);
  let lastError = null;

  for (const channelId of candidates) {
    try {
      const xml = await fetchFeed(channelId);
      return { xml, channelId };
    } catch (error) {
      lastError = error;
    }
  }

  const resolved = await resolveChannelId(meta.handle);
  if (resolved && !candidates.includes(resolved)) {
    const xml = await fetchFeed(resolved);
    return { xml, channelId: resolved };
  }

  throw lastError || new Error('official YouTube channel could not be resolved');
}

async function fetchFeed(channelId) {
  const response = await fetch(`${FEED_BASE}${encodeURIComponent(channelId)}`, {
    headers: {
      accept: 'application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.5',
      'user-agent': USER_AGENT,
    },
  });

  if (!response.ok) throw new Error(`youtube feed ${response.status}`);
  const xml = await response.text();
  if (!xml.includes('<entry>')) throw new Error('youtube feed returned no entries');
  return xml;
}

async function resolveChannelId(handle) {
  const response = await fetch(`https://www.youtube.com/@${encodeURIComponent(handle)}/videos`, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`youtube channel ${response.status}`);

  const html = await response.text();
  const patterns = [
    /"channelId":"(UC[A-Za-z0-9_-]{22})"/,
    /"browseId":"(UC[A-Za-z0-9_-]{22})"/,
    /<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[A-Za-z0-9_-]{22})["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  throw new Error('youtube channel id not found');
}

function parseFeed(xml, sport) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match, index) => {
    const block = match[1];
    const videoId = tag(block, 'yt:videoId');
    const title = tag(block, 'title');
    const publishedAt = tag(block, 'published');
    const updatedAt = tag(block, 'updated');
    const channelName = tag(block, 'name') || `${sport.toUpperCase()} Official`;
    const thumbnail = attr(block, 'media:thumbnail', 'url')
      || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);

    if (!videoId || !title) return null;

    return {
      sport,
      videoId,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
      thumbnail,
      channelName,
      publishedAt: publishedAt || updatedAt || null,
      rank: index,
    };
  }).filter(Boolean);

  return entries;
}

async function selectEmbeddableHighlights(videos, sport, limit) {
  const ranked = selectHighlights(videos, sport, Math.max(limit * 2, limit));

  // YouTube's Atom feed tells us what exists, not whether the owner allows
  // third-party playback. Verify the actual embed page server-side before the
  // browser ever receives the playlist. This avoids client-side IFrame API
  // races/postMessage origin errors and prevents known-unplayable videos from
  // being selected as the featured card.
  const checks = await Promise.all(
    ranked.map(async (video) => ({
      video,
      embeddable: await verifyYouTubeEmbed(video.videoId),
    }))
  );

  const playable = checks.filter((row) => row.embeddable === true).map((row) => ({
    ...row.video,
    embeddable: true,
  }));

  // If YouTube changes its embed HTML and none can be positively verified,
  // fail closed for the on-site player instead of shipping a broken iframe.
  return playable.slice(0, limit);
}

async function verifyYouTubeEmbed(videoId) {
  if (!videoId) return false;

  const url = new URL(`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`);
  url.searchParams.set('hl', 'en');
  url.searchParams.set('origin', 'https://propbetedge.ai');

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': USER_AGENT,
        referer: 'https://propbetedge.ai/',
      },
      redirect: 'follow',
    });

    if (!response.ok) return false;
    const html = await response.text();

    // Current YouTube embed responses expose either playableInEmbed or a
    // playabilityStatus object. Require positive evidence of embed playback.
    if (/["']playableInEmbed["']\s*:\s*true/i.test(html)) return true;

    const statusMatch = html.match(/["']playabilityStatus["']\s*:\s*\{[^{}]*["']status["']\s*:\s*["']([A-Z_]+)["']/i);
    if (statusMatch?.[1] === 'OK') {
      if (/["']playableInEmbed["']\s*:\s*false/i.test(html)) return false;
      if (/embedding disabled|not available on this app|watch on youtube/i.test(html)) return false;
      return true;
    }

    return false;
  } catch (error) {
    console.warn('[youtube-highlights] embed verification failed', videoId, error?.message || error);
    return false;
  }
}

function selectHighlights(videos, sport, limit) {
  // The NFL channel mixes normal clips with rights-restricted long-form uploads
  // (notably full-game replays). Those entries can appear in the public Atom
  // feed yet reject third-party iframe playback with YouTube error 101/150.
  // Keep the on-site player sourced from clip-style uploads that are intended
  // for distribution, rather than selecting a known blocked replay as featured.
  const sourceSafeVideos = videos.filter((video) => isOnsitePlaybackCandidate(video, sport));
  const candidates = sourceSafeVideos.length >= Math.min(3, limit) ? sourceSafeVideos : videos;

  const ranked = candidates.map((video, index) => {
    const actionScore = highlightScore(video.title, sport);
    const recencyBoost = Math.max(0, 15 - index);
    return { ...video, _score: actionScore + recencyBoost, _actionScore: actionScore };
  });

  const explicit = ranked.filter((video) => video._actionScore >= 8);
  const pool = explicit.length >= Math.min(3, limit) ? explicit : ranked;

  return pool
    .sort((a, b) => b._score - a._score || Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
    .slice(0, limit)
    .map(({ _score, _actionScore, rank, ...video }) => video);
}

function isOnsitePlaybackCandidate(video, sport) {
  if (sport !== 'nfl') return true;

  const text = String(video?.title || '').toLowerCase();

  // NFL full-game / condensed-game inventory is frequently rights-restricted
  // from third-party embeds even when it is visible on youtube.com.
  if (/\bfull game\b/.test(text)) return false;
  if (/\bcondensed game\b/.test(text)) return false;
  if (/\bgame of the week\b/.test(text) && /\bfull\b/.test(text)) return false;

  return true;
}

function highlightScore(title, sport) {
  const text = String(title || '').toLowerCase();
  let score = 0;

  const common = [
    [/highlight/, 24],
    [/top plays?/, 20],
    [/best plays?/, 18],
    [/game recap/, 18],
    [/full game/, sport === 'nfl' ? -40 : 13],
    [/\bvs\.?\b/, 8],
    [/walk[- ]?off/, 10],
    [/overtime|\bot\b/, 8],
  ];
  const sportTerms = {
    nfl: [
      [/touchdown|\btd\b/, 16],
      [/week \d+/, 9],
      [/pick[- ]?six|interception|sack|catch|run/, 8],
    ],
    nhl: [
      [/goal|save|shootout|hat trick/, 12],
      [/preseason/, 6],
      [/fight/, 8],
    ],
    mlb: [
      [/home run|homer|grand slam/, 14],
      [/strikeout|walk[- ]?off|web gem/, 9],
    ],
    nba: [
      [/dunk|poster|buzzer|game winner/, 12],
      [/handles|block|three|3-pointer/, 8],
    ],
  };

  for (const [pattern, points] of [...common, ...(sportTerms[sport] || [])]) {
    if (pattern.test(text)) score += points;
  }

  const negatives = [
    [/press conference|presser/, 18],
    [/podcast/, 16],
    [/schedule release/, 14],
    [/interview/, 10],
    [/draft/, 9],
    [/ranking/, 7],
  ];
  for (const [pattern, points] of negatives) {
    if (pattern.test(text)) score -= points;
  }

  return score;
}

function tag(block, name) {
  const match = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>', 'i'));
  return match?.[1] ? decodeXml(stripCdata(match[1])).trim() : '';
}

function attr(block, tagName, attrName) {
  const match = block.match(new RegExp("<" + tagName + "[^>]*\\s" + attrName + "=[\"']([^\"']+)[\"'][^>]*>", "i"));
  return match?.[1] ? decodeXml(match[1]).trim() : '';
}

function stripCdata(value) {
  return String(value || '').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function decodeXml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
