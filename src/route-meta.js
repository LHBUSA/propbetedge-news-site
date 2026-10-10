/* Client head metadata for SPA routes. Shared by the full router (src/router.js)
 * and the lean All Access entry (src/pro-entry.js), so both write the same tags. */
import { NETWORK_SOCIAL_IMAGE } from './social.js';

const DEFAULT_OG_IMAGE = NETWORK_SOCIAL_IMAGE.url;

export function setMeta({ title, description, canonical, ogImage }) {
  if (title) document.title = title;
  if (description) {
    setOrCreateMeta('name', 'description', description);
    setOrCreateMeta('property', 'og:description', description);
    setOrCreateMeta('name', 'twitter:description', description);
  }
  if (title) {
    setOrCreateMeta('property', 'og:title', title);
    setOrCreateMeta('name', 'twitter:title', title);
  }
  if (canonical) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;
    setOrCreateMeta('property', 'og:url', canonical);
  }

  const socialImage = ogImage || DEFAULT_OG_IMAGE;
  setOrCreateMeta('property', 'og:image', socialImage);
  setOrCreateMeta('name', 'twitter:image', socialImage);
  setOrCreateMeta('property', 'og:image:secure_url', socialImage);
  // The shipped type/size/alt describe the network card only.
  if (socialImage !== DEFAULT_OG_IMAGE) {
    document.querySelectorAll('meta[property="og:image:type"],meta[property="og:image:width"],meta[property="og:image:height"]')
      .forEach((el) => el.remove());
  }
  const imageAlt = socialImage === DEFAULT_OG_IMAGE ? NETWORK_SOCIAL_IMAGE.alt : (title || 'PropBetEdge');
  setOrCreateMeta('property', 'og:image:alt', imageAlt);
  setOrCreateMeta('name', 'twitter:image:alt', imageAlt);
}

function setOrCreateMeta(attr, name, value) {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}
