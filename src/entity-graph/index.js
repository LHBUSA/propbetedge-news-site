/**
 * src/entity-graph/index.js
 *
 * Barrel for the PropBetEdge content graph.
 *
 * The browser imports this lazily (`await import('../entity-graph/index.js')`)
 * so the entity dictionary is a separate chunk: pages that never render an
 * article — the homepage, archives, leaders — never download it, and the
 * article page fetches it in parallel with its own API call rather than
 * blocking the first paint behind it.
 */

export * from './entities.js';
export * from './manifest.js';
export * from './games.js';
export * from './article-seo.js';
export * from './article-body.js';
export * from './linkify.js';
export * from './in-this-story.js';
export * from './share-bar.js';
export * from './share-image.js';
export * from './related.js';
