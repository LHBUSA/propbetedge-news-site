/* PropBetEdge Global (Issue #67): Japanese and Korean All Access pages and the
 * regional seller disclosures, from one source.
 *
 * Edge Middleware calls this module for the server HTML and head. The client
 * router renders the same HTML when it hydrates, so crawlers and browsers see
 * one page. The module is pure: no DOM, no network.
 *
 * The routes are:
 *   /ja/pro, /ko/pro                All Access, the membership page
 *   /es/pro                         PREPARED ONLY (not routed, 404 + noindex) until the
 *                                   Spanish legal text (B1/B2) and native review clear
 *   /ja/legal/tokushoho             特定商取引法に基づく表記 (Japan, Act on Specified Commercial Transactions)
 *   /ko/legal/business              사업자 정보 (Korea, E-Commerce Act seller disclosure)
 *
 * The commercial facts (price, interval, promo, Payment Link, billing portal) are
 * imported from pro-content.js and are never restated here. The checkout link
 * carries Stripe Payment Link URL parameters only:
 *   - `locale` opens Checkout in the reader's language;
 *   - `client_reference_id` is a non-personal attribution tag, pbe-<lang>-pro[-<via>],
 *     that lands on the Checkout Session for aggregate conversion reporting (Sigma).
 * Neither parameter changes the price, the product or any Stripe configuration.
 *
 * Japan and Korea regulate betting-related content, so these pages present
 * PropBetEdge as sports data and analysis. They carry no sportsbook, odds-operator
 * or referral link and no betting call to action, and they give no US-only helpline. */

import { ALL_ACCESS, SPORTS, NETWORK_PRODUCTS, CRYPTO_URL, ART, artSrcset, HERO_MOBILE_MEDIA, HERO_DESKTOP_MEDIA, SIGN_IN_URL } from '../pro-content.js';

import { createLocale, LOCALE_REGISTRY } from '../vendor/pbe-locale/pbe-locale.js';

export const SITE = 'https://propbetedge.ai';
export const INTL_PRO_LANGS = Object.freeze(['ja', 'ko']);
/* The shared network contract (pbe-locale/1.0.0). Only these two languages are public on propbetedge.ai. */
const L = createLocale({ ready: INTL_PRO_LANGS, site: SITE });
const HTML_LANG = Object.fromEntries(['en', ...INTL_PRO_LANGS, 'es'].map((c) => [c, LOCALE_REGISTRY[c].htmlLang]));
const OG_LOCALE = Object.fromEntries([...INTL_PRO_LANGS, 'es'].map((c) => [c, LOCALE_REGISTRY[c].og]));
const IN_LANGUAGE = Object.fromEntries([...INTL_PRO_LANGS, 'es'].map((c) => [c, LOCALE_REGISTRY[c].intl]));

export const DISCLOSURE_PATH = Object.freeze({ ja: '/ja/legal/tokushoho', ko: '/ko/legal/business' });

/* Prepared but NOT public: /es/pro is built from the same template so it can be
   reviewed, but it is not routed, not in hreflang, not in the sitemap and the
   middleware answers it with a real 404 + noindex until it is ready. It becomes
   public only when the owner moves 'es' into INTL_PRO_LANGS after the blockers
   below are cleared (Issue #67). */
export const PREPARED_PRO_LANGS = Object.freeze(['es']);
export const PREPARED_BLOCKERS = Object.freeze({
  es: Object.freeze([
    'B1: refund / 14-day withdrawal wording (EU/UK and other consumer law) reviewed by counsel',
    'B2: governing law and data-transfer statements reviewed by counsel',
    'Native-speaker review of the Spanish copy',
    'Owner approval to publish (route, hreflang, sitemap)',
  ]),
});

/** A prepared (not yet public) localized page, or null. Never served while not ready. */
export function preparedIntlRoute(pathname) {
  const p = String(pathname || '').replace(/\/+$/, '');
  const m = p.match(/^\/([a-z]{2})\/pro$/);
  if (m && PREPARED_PRO_LANGS.includes(m[1]) && !INTL_PRO_LANGS.includes(m[1])) return { kind: 'pro', lang: m[1], path: p, ready: false };
  return null;
}

export { VIA, viaFrom } from './attribution.js';
import { attributedCheckoutUrl } from './attribution.js';

/** Which localized page a path is, or null. */
export function intlRoute(pathname) {
  const p = String(pathname || '').replace(/\/+$/, '');
  const m = p.match(/^\/(ja|ko)\/pro$/);
  if (m) return { kind: 'pro', lang: m[1], path: p };
  if (p === DISCLOSURE_PATH.ja) return { kind: 'disclosure', lang: 'ja', path: p };
  if (p === DISCLOSURE_PATH.ko) return { kind: 'disclosure', lang: 'ko', path: p };
  return null;
}

/** The document language a path is served in. Every other route is English. */
export function documentLang(pathname) {
  return HTML_LANG[intlRoute(pathname)?.lang || 'en'];
}

/** Stripe Payment Link with the checkout language and the attribution tag.
 *  client_reference_id allows letters, digits, '-' and '_' only. */
export function checkoutUrlFor(lang, via = null) {
  return attributedCheckoutUrl(ALL_ACCESS.checkoutUrl, lang, via);
}

/** Reciprocal hreflang for the All Access page in every public language. */
export function proAlternates() {
  return L.alternateLinks('/pro');
}

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PRICE = `US$${ALL_ACCESS.priceUsd}`;

/* ------------------------------------------------------------------ copy */
/* Written for readers in Japan and Korea, not machine-translated. Product,
   brand and sport names stay in their published form. */
const COPY = {
  ja: {
    title: 'PropBetEdge All Access｜スポーツ＆マーケット分析メンバーシップ',
    description: `月額${PRICE}のひとつのメンバーシップで、PropBetEdgeネットワークのすべてへ。MLB、F1、ゴルフを含む10競技に加え、Predictions、Compare、Markets、会員専用のCommand Centerを利用できます。競技ごとに開発した独自モデルとライブ分析。`,
    breadcrumb: 'All Access',
    kicker: 'PropBetEdge All Access',
    h1a: 'ひとつのメンバーシップで、',
    h1b: 'スポーツ分析ネットワークのすべてを。',
    dek: '10競技＋Predictions＋Compare＋Markets。ライブデータ、独自モデル、予測市場のデータ、競技ごとのリサーチを、ひとつの会員資格で利用できます。',
    per: '/ 月',
    cta: 'All Accessに登録する',
    signIn: '会員ログイン',
    promo: `会員を継続している間、コード <strong>${ALL_ACCESS.promoCode}</strong> で${ALL_ACCESS.promoPercent}%オフ`,
    currency: '料金は米ドル建てです。お支払いはStripeの安全な決済画面で行います。',
    unlockH: `${PRICE}で使えるもの`,
    products: {
      members: ['Command Center', '会員専用のワークスペース'],
      compare: ['Compare', '予測市場の価格を契約ごとに比較'],
      markets: ['Markets', '株式・暗号資産・マクロ・AI'],
      predictions: ['Predictions', '成績記録つきのモデル確率'],
    },
    sportsLine: `${SPORTS.length}の競技プロダクト`,
    networkEyebrow: 'ネットワーク',
    networkH: 'ロゴを10個並べただけの、ひとつの製品ではありません。',
    networkP: '各競技はそれぞれ専用に作られたプロダクトです。ライブ体験、データ、モデル、DNAリサーチを競技ごとに持ち、対応競技ではPBEcastも利用できます。All Accessはそれらをつなぐ層で、その上にCommand Center、Compare、Markets、Predictionsがあります。',
    featuredEyebrow: '日本のファンに',
    featuredH: 'MLB、F1、ゴルフから始めましょう。',
    featuredP: 'まずはこの3競技から。いずれもAll Accessに含まれています。',
    featured: ['mlb', 'f1', 'golf'],
    edges: {
      mlb: 'モデル、対戦分析、本塁打候補、奪三振分析、ライブの試合状況。',
      nfl: 'PBE Picks、選手DNA、対戦分析、ライブのフットボール分析。',
      nba: '試合モデル、選手分析、対戦、ライブの試合状況、リサーチ。',
      nhl: 'PBE Picks、ゴールテンダー分析、選手分析、ライブのホッケー。',
      wnba: 'WinBA、選手DNA、選手成績の分析、ライブ報道、独自ニュース。',
      ufc: '試合分析、Fighter DNA、対戦カード、戦績、大会週の分析。',
      tennis: 'ATP・WTAのライブスコア、Match DNA、ランキング、対戦、リサーチ。',
      soccer: '世界の試合分析、選手DNA、チームリサーチ、ライブの試合、モデル。',
      golf: '選手DNA、コースDNA、天候、対戦、トーナメント、メジャーの歴史。',
      f1: 'ドライバー、コンストラクター、サーキットの分析、順位、対戦、天候。',
    },
    open: (label) => `${label}を開く →`,
    productsEyebrow: 'All Accessの機能',
    productsH: '競技の上にある、4つのプレミアム機能。',
    stories: {
      compare: ['予測市場', 'Compare', '価格を見て、契約内容を確かめる。', '予測市場の価格を契約ごとに並べ、条件の違いも表示します。本当の価格差と、似ているだけの別の契約を取り違えないための機能です。', 'Compareを見る'],
      predictions: ['独自モデル', 'Predictions', '根拠のある確率と、その記録。', '独自モデルの確率をライブの市場データと比較し、結果が確定した後に採点した記録を残します。', 'Predictionsを見る'],
      markets: ['マーケット分析', 'Markets', '株式、暗号資産、マクロ、AIの市場分析。同じライブデータに対する強気・弱気・定量の3つの見方と、ライブ市場で採点されるBTCの15分ナウキャスト。', 'Marketsを見る', '暗号資産ナウキャスト ↗'],
      members: ['会員専用', 'Command Center', 'ライブの試合、会員向け分析、マルチビュー、ネットワーク全体へのナビゲーションをひとつのワークスペースに。Platinum Directでは、ご意見がPropBetEdgeの開発チームに直接届きます。', 'Command Centerを開く'],
    },
    tapes: { markets: ['株式', '暗号資産', 'マクロ', 'AI'], members: ['ライブの試合', 'マルチビュー', 'Live Market Wire', 'Platinum Direct'] },
    sportsEyebrow: `全${SPORTS.length}競技`,
    sportsH: 'すべての競技に、その競技のためのプロダクトを。',
    whyEyebrow: 'PropBetEdgeが選ばれる理由',
    whyH: 'ただの予想サービスではありません。',
    whyP: '確率は不確実さを表すもので、約束ではありません。PropBetEdgeが提供するのは、その裏側にある分析の過程です。',
    why: [
      ['独自モデル', '競技ごとに自社開発したエンジン。ひとつの汎用モデルを10競技に使い回すことはしません。'],
      ['透明な成績記録', '公式の予想は試合前に確定し、結果に対して採点され、的中も外れもそのまま記録に残ります。'],
      ['予測市場の分析', '予測市場の価格を契約ごとに比較し、独自モデルの確率と並べて表示します。'],
      ['競技に合わせたライブ体験', '各競技に合ったライブ体験、データ、使い方をそのまま残し、ひとつのダッシュボードに押し込めません。'],
      ['DNAリサーチ', '競技に応じて選手、試合、サーキット、コースのDNAを提供。数字の裏にあるプロフィールです。'],
      ['PBEcast', '対応競技では、試合の進行に合わせて動くライブ体験を提供します。'],
    ],
    whyLast: ['ネットワーク全体をひとつのメンバーシップで', '上のすべての機能と下のすべての競技を、ひとつのログインで。'],
    termsH: 'お申し込みの内容',
    terms: [
      ['サービス', 'PropBetEdge All Access（デジタルのスポーツ分析メンバーシップ）'],
      ['料金', `月額${PRICE}（米ドル建て）。コード${ALL_ACCESS.promoCode}の適用時は、会員を継続している間${ALL_ACCESS.promoPercent}%オフ。`],
      ['契約期間と更新', '1か月ごとの自動更新です。初回は申込時に、以降は毎月同じ日に請求されます。'],
      ['提供時期', '決済完了後、ただちにご利用いただけます。'],
      ['解約', 'Stripeのカスタマーポータルからいつでも解約でき、次回以降の更新と請求が止まります。'],
      ['返金', 'デジタルサービスのため、アクセス開始後の料金は、法令で求められる場合を除き返金できません。'],
    ],
    finalH: 'ネットワークは成長を続けます。メンバーシップはそのすべてに対応します。',
    finalPrice: `月額${PRICE}・ひとつのAll Accessメンバーシップ`,
    copy: 'コピー',
    copied: 'コピーしました',
    copyAria: `プロモーションコード ${ALL_ACCESS.promoCode} をコピー`,
    offerAria: 'All Accessの特典',
    offerLine: `会員を継続している間${ALL_ACCESS.promoPercent}%オフ`,
    codeLabel: 'コード',
    memberLink: '会員の方はこちらからログイン ↗',
    manage: '契約の管理・解約 ↗',
    disclosureLink: '特定商取引法に基づく表記',
    englishDocs: [['/terms', '利用規約（英語）'], ['/privacy', 'プライバシーポリシー（英語）'], ['/support', 'サポート（英語）']],
    responsible: 'PropBetEdgeはスポーツ情報・分析サービスです。賭博の場を提供したり、賭けを勧誘したりするものではありません。モデルの確率は結果を保証するものではありません。',
    langNav: '言語',
    heroAlt: '夜の街並みの横で照明に照らされたスタジアムと、その上に浮かぶライブの市場チャート。',
    networkAlt: '夜の街の中心にある照明に照らされたスタジアムと、それをつなぐ光の線。',
    compareAlt: 'スタジアムのフィールドをはさんで向かい合う、青と金の2つの市場画面。',
    predictionsAlt: '確率曲線とチャートに囲まれて輝く地球。',
  },
  ko: {
    title: 'PropBetEdge All Access | 스포츠·마켓 분석 멤버십',
    description: `월 ${PRICE} 멤버십 하나로 PropBetEdge 네트워크 전체를 이용하세요. MLB, 골프를 포함한 10개 종목과 Predictions, Compare, Markets, 회원 전용 Command Center까지. 종목별로 개발한 자체 모델과 라이브 분석.`,
    breadcrumb: 'All Access',
    kicker: 'PropBetEdge All Access',
    h1a: '멤버십 하나로',
    h1b: '스포츠 분석 네트워크 전체를.',
    dek: '10개 종목 + Predictions + Compare + Markets. 라이브 데이터, 자체 모델, 예측 시장 데이터, 종목별 리서치를 멤버십 하나로 이용할 수 있습니다.',
    per: '/ 월',
    cta: 'All Access 가입하기',
    signIn: '회원 로그인',
    promo: `회원을 유지하는 동안 코드 <strong>${ALL_ACCESS.promoCode}</strong>로 ${ALL_ACCESS.promoPercent}% 할인`,
    currency: '요금은 미국 달러로 청구됩니다. 결제는 Stripe의 안전한 결제 화면에서 진행됩니다.',
    unlockH: `${PRICE}로 이용할 수 있는 것`,
    products: {
      members: ['Command Center', '회원 전용 워크스페이스'],
      compare: ['Compare', '예측 시장 가격을 계약별로 비교'],
      markets: ['Markets', '주식·암호화폐·거시경제·AI'],
      predictions: ['Predictions', '성적 기록이 있는 모델 확률'],
    },
    sportsLine: `${SPORTS.length}개 종목 프로덕트`,
    networkEyebrow: '네트워크',
    networkH: '로고 10개를 붙인 하나의 제품이 아닙니다.',
    networkP: '각 종목은 그 종목을 위해 만든 별도의 프로덕트입니다. 라이브 경험, 데이터, 모델, DNA 리서치를 종목마다 갖추고 있으며, 지원 종목에서는 PBEcast도 이용할 수 있습니다. All Access는 이들을 연결하는 층이며, 그 위에 Command Center, Compare, Markets, Predictions가 있습니다.',
    featuredEyebrow: '한국 팬을 위해',
    featuredH: 'MLB, 골프, 축구부터 시작하세요.',
    featuredP: '먼저 이 세 종목부터 살펴보세요. 모두 All Access에 포함되어 있습니다.',
    featured: ['mlb', 'golf', 'soccer'],
    edges: {
      mlb: '모델, 매치업 분석, 홈런 후보, 탈삼진 분석, 라이브 경기 상황.',
      nfl: 'PBE Picks, 선수 DNA, 매치업, 라이브 풋볼 분석.',
      nba: '경기 모델, 선수 분석, 매치업, 라이브 경기 상황, 리서치.',
      nhl: 'PBE Picks, 골리 분석, 선수 분석, 라이브 하키.',
      wnba: 'WinBA, 선수 DNA, 선수 기록 분석, 라이브 보도, 자체 뉴스.',
      ufc: '경기 분석, Fighter DNA, 대진, 전적, 대회 주간 분석.',
      tennis: 'ATP·WTA 라이브 스코어, Match DNA, 랭킹, 매치업, 리서치.',
      soccer: '전 세계 경기 분석, 선수 DNA, 팀 리서치, 라이브 경기, 모델.',
      golf: '선수 DNA, 코스 DNA, 날씨, 매치업, 토너먼트, 메이저 역사.',
      f1: '드라이버, 컨스트럭터, 서킷 분석, 순위, 매치업, 날씨.',
    },
    open: (label) => `${label} 열기 →`,
    productsEyebrow: 'All Access 기능',
    productsH: '종목 위에 있는 4가지 프리미엄 기능.',
    stories: {
      compare: ['예측 시장', 'Compare', '가격을 보고, 계약 내용을 확인하세요.', '예측 시장 가격을 계약별로 나란히 보여 주고 조건의 차이도 표시합니다. 실제 가격 차이를, 비슷해 보이기만 하는 다른 계약과 혼동하지 않도록 돕습니다.', 'Compare 보기'],
      predictions: ['자체 모델', 'Predictions', '근거 있는 확률, 그리고 그 기록.', '자체 모델의 확률을 라이브 시장 데이터와 비교하고, 결과가 확정된 뒤 채점한 기록을 남깁니다.', 'Predictions 보기'],
      markets: ['마켓 분석', 'Markets', '주식, 암호화폐, 거시경제, AI 시장 분석. 같은 라이브 데이터에 대한 강세·약세·퀀트의 세 가지 관점과, 라이브 시장으로 채점되는 BTC 15분 나우캐스트.', 'Markets 보기', '암호화폐 나우캐스트 ↗'],
      members: ['회원 전용', 'Command Center', '라이브 경기, 회원용 분석, 멀티뷰, 네트워크 전체 내비게이션을 하나의 워크스페이스에서. Platinum Direct를 통해 의견이 PropBetEdge 개발팀에 바로 전달됩니다.', 'Command Center 열기'],
    },
    tapes: { markets: ['주식', '암호화폐', '거시경제', 'AI'], members: ['라이브 경기', '멀티뷰', 'Live Market Wire', 'Platinum Direct'] },
    sportsEyebrow: `전체 ${SPORTS.length}개 종목`,
    sportsH: '모든 종목에, 그 종목을 위한 프로덕트를.',
    whyEyebrow: 'PropBetEdge를 선택하는 이유',
    whyH: '흔한 픽 구독 서비스가 아닙니다.',
    whyP: '확률은 불확실성을 나타낼 뿐, 약속이 아닙니다. PropBetEdge는 그 뒤에 있는 분석 과정을 투명하게 제공합니다.',
    why: [
      ['자체 모델', '종목마다 자체 개발한 엔진. 하나의 범용 모델을 10개 종목에 돌려 쓰지 않습니다.'],
      ['투명한 성적 기록', '공식 픽은 경기 전에 확정되고, 결과로 채점되며, 적중과 실패 모두 기록에 남습니다.'],
      ['예측 시장 분석', '예측 시장 가격을 계약별로 비교하고 자체 모델의 확률과 나란히 보여 줍니다.'],
      ['종목에 맞춘 라이브 경험', '각 종목에 맞는 라이브 경험, 데이터, 사용 방식을 그대로 유지하며 하나의 대시보드에 밀어 넣지 않습니다.'],
      ['DNA 리서치', '종목에 따라 선수, 경기, 서킷, 코스 DNA를 제공합니다. 숫자 뒤에 있는 프로필입니다.'],
      ['PBEcast', '지원 종목에서는 경기 진행에 맞춰 움직이는 라이브 경험을 제공합니다.'],
    ],
    whyLast: ['네트워크 전체를 멤버십 하나로', '위의 모든 기능과 아래의 모든 종목을 로그인 하나로.'],
    termsH: '가입 내용',
    terms: [
      ['서비스', 'PropBetEdge All Access (디지털 스포츠 분석 멤버십)'],
      ['요금', `월 ${PRICE} (미국 달러). 코드 ${ALL_ACCESS.promoCode} 적용 시 회원을 유지하는 동안 ${ALL_ACCESS.promoPercent}% 할인.`],
      ['계약 기간과 갱신', '1개월 단위로 자동 갱신됩니다. 첫 결제는 가입 시, 이후 매월 같은 날짜에 청구됩니다.'],
      ['제공 시기', '결제 완료 후 바로 이용할 수 있습니다.'],
      ['해지', 'Stripe 고객 포털에서 언제든지 해지할 수 있으며, 다음 갱신부터 청구가 중단됩니다.'],
      ['환불', '디지털 서비스이므로 이용이 시작된 후의 요금은 관련 법령이 요구하는 경우를 제외하고 환불되지 않습니다.'],
    ],
    finalH: '네트워크는 계속 성장합니다. 멤버십은 그 모두를 포함합니다.',
    finalPrice: `월 ${PRICE} · All Access 멤버십 하나`,
    copy: '복사',
    copied: '복사됨',
    copyAria: `프로모션 코드 ${ALL_ACCESS.promoCode} 복사`,
    offerAria: 'All Access 혜택',
    offerLine: `회원 유지 기간 동안 ${ALL_ACCESS.promoPercent}% 할인`,
    codeLabel: '코드',
    memberLink: '이미 회원이신가요? 로그인 ↗',
    manage: '구독 관리·해지 ↗',
    disclosureLink: '사업자 정보',
    englishDocs: [['/terms', '이용약관(영문)'], ['/privacy', '개인정보 처리방침(영문)'], ['/support', '고객 지원(영문)']],
    responsible: 'PropBetEdge는 스포츠 정보·분석 서비스입니다. 도박의 장을 제공하거나 베팅을 권유하지 않습니다. 모델의 확률은 결과를 보장하지 않습니다.',
    langNav: '언어',
    heroAlt: '야경 도시 옆 조명이 켜진 경기장과 그 위로 떠오르는 라이브 시장 차트.',
    networkAlt: '밤의 도시 한가운데 조명이 켜진 경기장과 이를 잇는 빛의 선.',
    compareAlt: '경기장 바닥을 사이에 두고 마주한 파란색과 금색의 두 시장 화면.',
    predictionsAlt: '확률 곡선과 차트에 둘러싸여 빛나는 지구.',
  },
  /* PREPARED, NOT PUBLIC (see PREPARED_PRO_LANGS). Neutral Spanish for readers in
     the US, Latin America and Spain; native review owed. The consumer legal terms
     (renewal/cancellation wording, refunds and the EU/UK 14-day withdrawal right,
     governing law) are deliberately NOT written here: `legalPending` renders a
     marked placeholder until counsel-reviewed text replaces it (B1/B2). */
  es: {
    title: 'PropBetEdge All Access | Membresía de análisis deportivo',
    description: `Una sola membresía de ${PRICE} al mes para toda la red PropBetEdge: 10 deportes, incluidos fútbol, MLB y golf, más Predictions, Compare, Markets y el Command Center para miembros. Modelos propios y análisis en vivo.`,
    breadcrumb: 'All Access',
    kicker: 'PropBetEdge All Access',
    h1a: 'Una sola membresía.',
    h1b: 'Toda la red de análisis deportivo.',
    dek: '10 deportes + Predictions + Compare + Markets. Datos en vivo, modelos propios, datos de mercados de predicción e investigación de cada deporte con una sola membresía.',
    per: '/ mes',
    cta: 'Suscribirme a All Access',
    signIn: 'Iniciar sesión',
    promo: `${ALL_ACCESS.promoPercent}% de descuento mientras mantengas tu membresía activa, con el código <strong>${ALL_ACCESS.promoCode}</strong>`,
    currency: 'El precio está en dólares estadounidenses. El pago se realiza en la página segura de Stripe.',
    unlockH: `Qué incluye por ${PRICE}`,
    products: {
      members: ['Command Center', 'Tu espacio de trabajo como miembro'],
      compare: ['Compare', 'Precios de mercados de predicción, contrato por contrato'],
      markets: ['Markets', 'Acciones, cripto, macro e IA'],
      predictions: ['Predictions', 'Probabilidades de modelos con historial de resultados'],
    },
    sportsLine: `${SPORTS.length} productos deportivos`,
    networkEyebrow: 'La red',
    networkH: 'No es un solo producto con diez logotipos.',
    networkP: 'Cada deporte es un producto creado para ese deporte, con su propia experiencia en vivo, sus datos, sus modelos y su investigación DNA, y PBEcast donde el deporte lo permite. All Access es la capa que los une, con Command Center, Compare, Markets y Predictions por encima.',
    featuredEyebrow: 'Para la afición hispanohablante',
    featuredH: 'Empieza por el fútbol, el golf y la MLB.',
    featuredP: 'Fútbol y golf ya tienen edición en español. Los tres están incluidos en All Access.',
    featured: ['soccer', 'golf', 'mlb'],
    /* Sports with a public Spanish edition link to it. */
    sportUrl: { soccer: 'https://soccer.propbetedge.ai/es/', golf: 'https://golf.propbetedge.ai/es/' },
    edges: {
      mlb: 'Modelos, enfrentamientos, candidatos a jonrón, análisis de ponches y contexto del partido en vivo.',
      nfl: 'PBE Picks, Player DNA, enfrentamientos y análisis de fútbol americano en vivo.',
      nba: 'Modelos de partido, análisis de jugadores, enfrentamientos, contexto en vivo e investigación.',
      nhl: 'PBE Picks, análisis de porteros, análisis de jugadores y hockey en vivo.',
      wnba: 'WinBA, Player DNA, análisis de estadísticas de jugadoras, cobertura en vivo y noticias propias.',
      ufc: 'Análisis de combates, Fighter DNA, carteleras, récords y análisis de la semana del evento.',
      tennis: 'Marcadores en vivo de la ATP y la WTA, Match DNA, rankings, enfrentamientos e investigación.',
      soccer: 'Análisis de partidos de todo el mundo, Player DNA, investigación de equipos, partidos en vivo y modelos.',
      golf: 'Player DNA, Course DNA, clima, enfrentamientos, torneos e historia de los majors.',
      f1: 'Análisis de pilotos, constructores y circuitos, clasificaciones, enfrentamientos y clima.',
    },
    open: (label) => `Abrir ${label} →`,
    productsEyebrow: 'Funciones de All Access',
    productsH: 'Cuatro funciones premium por encima de los deportes.',
    stories: {
      compare: ['Mercados de predicción', 'Compare', 'Mira el precio y revisa el contrato.', 'Compara los precios de los mercados de predicción contrato por contrato y muestra en qué difieren sus condiciones, para no confundir una diferencia de precio real con un contrato que solo se parece.', 'Ver Compare'],
      predictions: ['Modelos propios', 'Predictions', 'Probabilidades con fundamento y su historial.', 'Las probabilidades de nuestros modelos se comparan con los datos del mercado en vivo y se califican cuando se conoce el resultado.', 'Ver Predictions'],
      markets: ['Análisis de mercados', 'Markets', 'Análisis de acciones, cripto, macro e IA: tres lecturas (alcista, bajista y cuantitativa) de los mismos datos en vivo, y un nowcast de BTC a 15 minutos que se califica contra el mercado en vivo.', 'Ver Markets', 'Nowcast de cripto ↗'],
      members: ['Solo para miembros', 'Command Center', 'Partidos en vivo, análisis para miembros, multivista y navegación por toda la red en un solo espacio de trabajo. Con Platinum Direct, tus comentarios llegan directamente al equipo que desarrolla PropBetEdge.', 'Abrir Command Center'],
    },
    tapes: { markets: ['Acciones', 'Cripto', 'Macro', 'IA'], members: ['Partidos en vivo', 'Multivista', 'Live Market Wire', 'Platinum Direct'] },
    sportsEyebrow: `Los ${SPORTS.length} deportes`,
    sportsH: 'Cada deporte, con un producto hecho para ese deporte.',
    whyEyebrow: 'Por qué PropBetEdge',
    whyH: 'No es otro servicio de pronósticos.',
    whyP: 'Una probabilidad expresa incertidumbre, no una promesa. PropBetEdge te muestra el análisis que hay detrás.',
    why: [
      ['Modelos propios', 'Motores desarrollados para cada deporte. No usamos un modelo genérico para los diez.'],
      ['Historial transparente', 'Las selecciones oficiales se fijan antes del partido, se califican con el resultado y los aciertos y fallos quedan registrados.'],
      ['Análisis de mercados de predicción', 'Comparamos los precios de los mercados de predicción contrato por contrato y los mostramos junto a las probabilidades de nuestros modelos.'],
      ['Experiencia en vivo de cada deporte', 'Cada deporte conserva su propia experiencia en vivo, sus datos y su forma de uso, sin meterlo todo en un solo panel.'],
      ['Investigación DNA', 'Según el deporte, DNA de jugadores, partidos, circuitos y campos: el perfil que hay detrás del número.'],
      ['PBEcast', 'En los deportes compatibles, una experiencia en vivo que avanza con el partido.'],
    ],
    whyLast: ['Toda la red con una sola membresía', 'Todas las funciones de arriba y todos los deportes de abajo, con un solo inicio de sesión.'],
    termsH: 'Lo que contratas',
    terms: [
      ['Servicio', 'PropBetEdge All Access (membresía digital de información y análisis deportivo)'],
      ['Precio', `${PRICE} al mes, en dólares estadounidenses. Con el código ${ALL_ACCESS.promoCode}, ${ALL_ACCESS.promoPercent}% de descuento mientras mantengas tu membresía activa.`],
    ],
    /* B1/B2: renewal, cancellation, refund / right of withdrawal and governing-law
       text for Spanish-speaking consumers. Replace with counsel-reviewed copy; the
       page can never be made public while this is set (tests/global-intl.test.mjs). */
    legalPending: { blockers: ['B1', 'B2'], text: 'PENDIENTE DE REVISIÓN LEGAL (B1/B2): renovación, cancelación, reembolsos y derecho de desistimiento, y ley aplicable. Este texto se sustituirá por la versión revisada antes de publicar la página.' },
    finalH: 'La red sigue creciendo. Tu membresía ya la incluye.',
    finalPrice: `${PRICE} al mes · una sola membresía All Access`,
    copy: 'Copiar',
    copied: 'Copiado',
    copyAria: `Copiar el código promocional ${ALL_ACCESS.promoCode}`,
    offerAria: 'Oferta de All Access',
    offerLine: `${ALL_ACCESS.promoPercent}% de descuento mientras sigas activo`,
    codeLabel: 'Código',
    memberLink: '¿Ya eres miembro? Inicia sesión ↗',
    manage: 'Gestionar o cancelar la suscripción ↗',
    disclosureLink: null,
    englishDocs: [['/terms', 'Términos de uso (en inglés)'], ['/privacy', 'Política de privacidad (en inglés)'], ['/support', 'Soporte (en inglés)']],
    responsible: 'PropBetEdge es un servicio de información y análisis deportivo. No es una casa de apuestas ni invita a apostar. Las probabilidades de los modelos no garantizan resultados.',
    langNav: 'Idioma',
    heroAlt: 'Un estadio iluminado junto a una ciudad de noche, con gráficos de mercado en vivo flotando encima.',
    networkAlt: 'Un estadio iluminado en el centro de una ciudad de noche, unido por líneas de luz.',
    compareAlt: 'Dos pantallas de mercado, una azul y otra dorada, frente a frente sobre el campo de un estadio.',
    predictionsAlt: 'Un globo terráqueo luminoso rodeado de curvas de probabilidad y gráficos.',
  },
};

/** True when a language's page carries an unreviewed-legal placeholder. Such a page
 *  must never be public: intlHead refuses to build an indexable head for it. */
export const hasLegalPlaceholder = (lang) => Boolean(COPY[lang]?.legalPending);

/* ------------------------------------------------------------- disclosure */
/* Only facts PropBetEdge already publishes (operator, city, contact address,
   price and policies, see /terms and /privacy). Where the law allows details to
   be supplied on request, the page says so instead of inventing them. */
const DISCLOSURE = {
  ja: {
    title: '特定商取引法に基づく表記｜PropBetEdge',
    description: 'PropBetEdge All Access（月額US$29のデジタルのスポーツ分析メンバーシップ）の特定商取引法に基づく表記。販売事業者、料金、支払方法、提供時期、解約と返金について。',
    h1: '特定商取引法に基づく表記',
    intro: 'PropBetEdge All Accessの通信販売に関する表示です。',
    rows: [
      ['販売事業者', 'Local Home Buyers LLC（屋号：PropTechUSA.ai）'],
      ['運営統括責任者', '請求があった場合には、遅滞なく開示いたします。'],
      ['所在地', '米国ミネソタ州セントポール。番地を含む所在地は、請求があった場合に遅滞なく開示いたします。'],
      ['電話番号', '請求があった場合には、遅滞なく開示いたします。お問い合わせはメールでお受けしています。'],
      ['メールアドレス', '<a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a>'],
      ['サービス名', 'PropBetEdge All Access（デジタルのスポーツ情報・分析メンバーシップ）'],
      ['販売価格', `月額${PRICE}（米ドル建て）。お申し込みページと決済画面に表示されます。プロモーションコード${ALL_ACCESS.promoCode}の適用時は、会員を継続している間${ALL_ACCESS.promoPercent}%オフになります。現在、日本の消費税は請求していません。`],
      ['商品代金以外の必要料金', 'インターネット接続料金と通信料金はお客様のご負担です。外貨建ての決済に伴う為替レートと手数料は、ご利用のカード会社の規定によります。'],
      ['お支払い方法', 'クレジットカードなど、Stripeの決済画面に表示されるお支払い方法。'],
      ['お支払い時期', '初回はお申し込み時にお支払いいただきます。以降は1か月ごとに、毎月同じ日に自動で請求されます。'],
      ['提供時期', '決済完了後、ただちにご利用いただけます。'],
      ['契約期間と自動更新', '1か月ごとに自動更新される定期購入契約です。解約の手続きをされるまで毎月更新されます。'],
      ['解約方法', `<a href="${ALL_ACCESS.manageUrl}" rel="noopener">Stripeのカスタマーポータル</a>から、いつでも解約できます。解約後は次回以降の更新と請求が止まり、それまでの期間はご利用いただけます。日割りでの返金はありません。`],
      ['返品・返金', 'デジタルサービスの性質上、アクセス開始後の料金は、法令で求められる場合を除き返金できません。二重請求、解約後の請求、確認された請求やアクセスの誤りは、メールでご連絡ください。調査のうえ訂正いたします。'],
      ['動作環境', '最新版のChrome、Safari、Edge、Firefoxなどのウェブブラウザ。'],
      ['表現およびサービスに関する注意', 'PropBetEdgeはスポーツ情報・分析サービスです。賭博の場を提供したり、賭けを勧誘したりするものではありません。モデルの確率や予想は、結果や利益を保証するものではありません。'],
    ],
    back: 'All Accessに戻る',
    note: '利用規約とプライバシーポリシーの正文は英語です。',
  },
  ko: {
    title: '사업자 정보 | PropBetEdge',
    description: 'PropBetEdge All Access(월 US$29 디지털 스포츠 분석 멤버십)의 사업자 정보와 거래 조건. 판매자, 요금, 결제, 제공 시기, 해지와 환불 안내.',
    h1: '사업자 정보',
    intro: 'PropBetEdge All Access 통신판매에 관한 사업자 정보와 거래 조건입니다.',
    rows: [
      ['상호', 'Local Home Buyers LLC (상호명: PropTechUSA.ai)'],
      ['소재지', '미국 미네소타주 세인트폴'],
      ['이메일', '<a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a>'],
      ['사업자등록번호 · 통신판매업 신고번호', '해당 없음 (대한민국에 사업장이 없는 미국 사업자)'],
      ['서비스', 'PropBetEdge All Access (디지털 스포츠 정보·분석 멤버십)'],
      ['요금', `월 ${PRICE} (미국 달러). 가입 페이지와 결제 화면에 표시됩니다. 프로모션 코드 ${ALL_ACCESS.promoCode} 적용 시 회원을 유지하는 동안 ${ALL_ACCESS.promoPercent}% 할인됩니다.`],
      ['추가 비용', '인터넷 접속 요금과 통신 요금은 고객 부담입니다. 외화 결제에 따른 환율과 수수료는 이용하시는 카드사의 기준에 따릅니다.'],
      ['결제 방법', '신용카드 등 Stripe 결제 화면에 표시되는 결제 수단.'],
      ['결제 시기', '첫 결제는 가입 시 이루어지며, 이후 1개월마다 매월 같은 날짜에 자동으로 청구됩니다.'],
      ['제공 시기', '결제 완료 후 바로 이용할 수 있습니다.'],
      ['계약 기간과 자동 갱신', '1개월 단위로 자동 갱신되는 정기 결제입니다. 해지할 때까지 매월 갱신됩니다.'],
      ['해지 방법', `<a href="${ALL_ACCESS.manageUrl}" rel="noopener">Stripe 고객 포털</a>에서 언제든지 해지할 수 있습니다. 해지 후에는 다음 갱신부터 청구가 중단되며, 남은 기간까지는 이용할 수 있습니다. 일할 환불은 없습니다.`],
      ['청약철회 · 환불', '디지털 서비스이므로 이용이 시작된 후의 요금은 관련 법령이 요구하는 경우를 제외하고 환불되지 않습니다. 이중 청구, 해지 후 청구, 확인된 청구·이용 오류는 이메일로 알려 주시면 확인 후 바로잡습니다.'],
      ['이용 환경', '최신 버전의 Chrome, Safari, Edge, Firefox 등 웹 브라우저.'],
      ['서비스 안내', 'PropBetEdge는 스포츠 정보·분석 서비스입니다. 도박의 장을 제공하거나 베팅을 권유하지 않습니다. 모델의 확률이나 예측은 결과나 수익을 보장하지 않습니다.'],
    ],
    back: 'All Access로 돌아가기',
    note: '이용약관과 개인정보 처리방침의 정본은 영문입니다.',
  },
};

/* ------------------------------------------------------------------ head */
export function intlHead(route) {
  const lang = route.lang;
  const isPro = route.kind === 'pro';
  const c = isPro ? COPY[lang] : DISCLOSURE[lang];
  const canonical = `${SITE}${route.path}`;
  const image = `${SITE}/social/all-access-1200x630.png?v=20260926t`;
  // A prepared (not public) page, or one still carrying the legal placeholder, is
  // never indexable and never announced as a translation, even if it were rendered.
  const isPublic = INTL_PRO_LANGS.includes(lang) && route.ready !== false && !hasLegalPlaceholder(lang);
  return {
    lang: HTML_LANG[lang],
    title: c.title,
    description: c.description,
    canonical,
    robots: isPublic ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
    image,
    // The disclosures exist in one language each, so they announce no alternates.
    alternates: isPro && isPublic ? proAlternates() : [],
    socialTags: [
      ['og:type', 'website'],
      ['og:site_name', 'PropBetEdge'],
      ['og:locale', OG_LOCALE[lang]],
      ['og:title', c.title],
      ['og:description', c.description],
      ['og:url', canonical],
      ['og:image', image],
      ['og:image:secure_url', image],
      ['og:image:type', 'image/png'],
      ['og:image:width', '1200'],
      ['og:image:height', '630'],
      ['og:image:alt', 'PropBetEdge All Access'],
      ['twitter:card', 'summary_large_image'],
      ['twitter:title', c.title],
      ['twitter:description', c.description],
      ['twitter:image', image],
      ['twitter:image:alt', 'PropBetEdge All Access'],
    ],
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: c.title,
        description: c.description,
        inLanguage: IN_LANGUAGE[lang],
        isPartOf: { '@id': `${SITE}/#website` },
        publisher: { '@id': `${SITE}/#organization` },
        ...(isPro ? { about: { '@id': `${SITE}/pro#product` }, translationOfWork: { '@id': `${SITE}/pro#webpage` } } : {}),
      }],
    },
  };
}

/* ------------------------------------------------------------------ html */
function picture(key, alt, sizes) {
  const a = ART[key];
  const name = a.name || key;
  return `<picture class="pbe-pro-pic">
      <source type="image/avif" srcset="${artSrcset(key, 'avif')}" sizes="${sizes}">
      <source type="image/webp" srcset="${artSrcset(key, 'webp')}" sizes="${sizes}">
      <img src="/pro/${name}-${a.widths.at(-1)}.webp" width="${a.w}" height="${a.h}" alt="${esc(alt)}" loading="lazy" decoding="async">
    </picture>`;
}

function heroPicture(alt) {
  const m = ART.heroMobile, d = ART.hero;
  return `<picture class="pbe-pro-pic pbe-pro-hero-pic">
      <source media="${HERO_MOBILE_MEDIA}" type="image/avif" srcset="${artSrcset('heroMobile', 'avif')}" sizes="100vw" width="${m.w}" height="${m.h}">
      <source media="${HERO_MOBILE_MEDIA}" type="image/webp" srcset="${artSrcset('heroMobile', 'webp')}" sizes="100vw" width="${m.w}" height="${m.h}">
      <source media="${HERO_DESKTOP_MEDIA}" type="image/avif" srcset="${artSrcset('hero', 'avif')}" sizes="100vw">
      <source media="${HERO_DESKTOP_MEDIA}" type="image/webp" srcset="${artSrcset('hero', 'webp')}" sizes="100vw">
      <img src="/pro/hero-1600.webp" width="${d.w}" height="${d.h}" alt="${esc(alt)}" fetchpriority="high" decoding="async">
    </picture>`;
}

const LANG_LABEL = { en: 'EN', ja: '日本語', ko: '한국어', es: 'Español' };

/* Language links reload the page (data-pbe-reload) so <html lang> and the head always match the document. */
function topBar(lang, current) {
  const c = COPY[lang];
  // Public languages only; a prepared page also lists itself (it is never linked from the public ones).
  const langs = ['en', ...INTL_PRO_LANGS, ...(INTL_PRO_LANGS.includes(lang) ? [] : [lang])];
  const links = langs.map((l) => {
    const href = l === 'en' ? '/pro' : `/${l}/pro`;
    const here = current === 'pro' && l === lang;
    return `<a href="${href}" hreflang="${l}" lang="${l}" data-pbe-reload${here ? ' aria-current="page"' : ''}>${LANG_LABEL[l]}</a>`;
  }).join('');
  return `<header class="pbe-intl-top">
      <div class="pbe-pro-wrap pbe-intl-top-inner">
        <a class="pbe-intl-brand" href="/${lang}/pro" data-pbe-reload>PropBetEdge</a>
        <nav class="pbe-intl-langs" aria-label="${esc(c.langNav)}">${links}</nav>
      </div>
    </header>`;
}

function footer(lang) {
  const c = COPY[lang];
  return `<footer class="pbe-intl-foot">
      <div class="pbe-pro-wrap">
        <nav class="pbe-intl-foot-links" aria-label="PropBetEdge">
          ${DISCLOSURE_PATH[lang] ? `<a href="${DISCLOSURE_PATH[lang]}" data-pbe-reload>${esc(c.disclosureLink)}</a>` : ''}
          ${c.englishDocs.map(([href, label]) => `<a href="${href}" data-pbe-reload>${esc(label)}</a>`).join('')}
          <a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a>
        </nav>
        <p class="pbe-intl-responsible">${esc(c.responsible)}</p>
        <p class="pbe-intl-operator">© PropBetEdge · Local Home Buyers LLC d/b/a PropTechUSA.ai</p>
      </div>
    </footer>`;
}

function cta(lang, via, label, extra = '') {
  return `<a class="pbe-pro-cta ${extra}" href="${esc(checkoutUrlFor(lang, via))}" rel="noopener" data-pbe-placement="all_access_checkout" data-pbe-locale="${lang}"${via ? ` data-pbe-via="${esc(via)}"` : ''} data-pbe-price="${ALL_ACCESS.priceId}" data-pbe-link="${ALL_ACCESS.paymentLinkId}">${esc(label)}<span class="pbe-pro-cta-arrow" aria-hidden="true">→</span></a>`;
}

function termsBox(c) {
  return `<section class="pbe-intl-terms" aria-labelledby="pbe-intl-terms-h">
          <h2 id="pbe-intl-terms-h">${esc(c.termsH)}</h2>
          <dl>${c.terms.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          ${c.legalPending ? `<p class="pbe-intl-legal-pending" data-pbe-legal-placeholder="${esc(c.legalPending.blockers.join(','))}" role="note">${esc(c.legalPending.text)}</p>` : ''}
        </section>`;
}

const sport = (key) => SPORTS.find((s) => s.key === key);
const product = (key) => NETWORK_PRODUCTS.find((p) => p.key === key);

export function intlProHtml(lang, { via = null } = {}) {
  const c = COPY[lang];
  const story = (key, art, reverse) => {
    const [eyebrow, title, headline, body, action] = c.stories[key];
    const p = product(key);
    return `<article class="pbe-pro-story ${reverse ? 'is-reverse' : ''}" data-pbe-story="${key}">
          <a class="pbe-pro-story-media" href="${p.url}" rel="noopener" tabindex="-1" aria-hidden="true">${picture(art, c[`${art}Alt`], '(max-width: 960px) 100vw, 760px')}</a>
          <div class="pbe-pro-story-copy">
            <span class="pbe-pro-eyebrow">${esc(eyebrow)}</span>
            <h3>${esc(title)}</h3>
            <strong>${esc(headline)}</strong>
            <p>${esc(body)}</p>
            <div class="pbe-pro-story-links"><a class="pbe-pro-text-link" href="${p.url}" rel="noopener">${esc(action)} →</a></div>
          </div>
        </article>`;
  };
  const [mEyebrow, mTitle, mBody, mAction, mCrypto] = c.stories.markets;
  const [hEyebrow, hTitle, hBody, hAction] = c.stories.members;
  const sportCard = (s) => `<li class="pbe-pro-sport" data-sport="${s.key}">
          <a href="${c.sportUrl?.[s.key] || s.url}" rel="noopener">
            <span class="pbe-pro-sport-label">${esc(s.label)}</span>
            <span class="pbe-pro-sport-name">${esc(s.proName || s.name)}</span>
            <span class="pbe-pro-sport-edge">${esc(c.edges[s.key])}</span>
            <b>${esc(c.open(s.label))}</b>
          </a>
        </li>`;

  return `<div class="pbe-intl" lang="${lang}" data-pbe-page="pro-intl" data-pbe-locale="${lang}">
    ${topBar(lang, 'pro')}
    <main class="pbe-pro-main">
    <div class="pbe-pro" data-pbe-page="pro">
    <section class="pbe-pro-hero" aria-labelledby="pbe-pro-title">
      <div class="pbe-pro-hero-media">${heroPicture(c.heroAlt)}</div>
      <div class="pbe-pro-wrap pbe-pro-hero-inner">
        <div class="pbe-pro-hero-copy">
          <span class="pbe-pro-kicker">${esc(c.kicker)}</span>
          <h1 class="pbe-pro-title" id="pbe-pro-title"><span>${esc(c.h1a)}</span><span class="pbe-pro-title-gold">${esc(c.h1b)}</span></h1>
          <p class="pbe-pro-dek">${esc(c.dek)}</p>
          <div class="pbe-pro-buyline">
            <div class="pbe-pro-price"><span class="pbe-pro-price-amount">${PRICE}</span><span class="pbe-pro-price-per">${esc(c.per)}</span></div>
            <div class="pbe-pro-actions">
              ${cta(lang, via, c.cta, 'pbe-pro-cta-hero')}
              <a class="pbe-pro-cta-quiet" href="${SIGN_IN_URL}" rel="noopener" data-pbe-placement="all_access_sign_in">${esc(c.signIn)}</a>
            </div>
          </div>
          <p class="pbe-pro-hero-promo">${c.promo}</p>
          <p class="pbe-intl-currency">${esc(c.currency)}</p>
        </div>
      </div>
    </section>

    <section class="pbe-pro-wrap pbe-pro-unlock" aria-labelledby="pbe-pro-unlock-h">
      <h2 id="pbe-pro-unlock-h" class="pbe-pro-unlock-h">${esc(c.unlockH)}</h2>
      <ul class="pbe-pro-unlock-list">
        ${NETWORK_PRODUCTS.map((p) => `<li><a href="${p.url}" rel="noopener" data-pbe-product="${p.key}"><strong>${esc(c.products[p.key][0])}</strong><span>${esc(c.products[p.key][1])}</span></a></li>`).join('\n        ')}
        <li class="pbe-pro-unlock-sports"><a href="#sports"><strong>${esc(c.sportsLine)}</strong><span>${SPORTS.map((s) => esc(s.label)).join(' · ')}</span></a></li>
      </ul>
    </section>

    <section class="pbe-pro-wrap pbe-pro-section pbe-intl-featured" aria-labelledby="pbe-intl-featured-h">
      <header class="pbe-pro-section-head">
        <span class="pbe-pro-eyebrow">${esc(c.featuredEyebrow)}</span>
        <h2 id="pbe-intl-featured-h">${esc(c.featuredH)}</h2>
        <p>${esc(c.featuredP)}</p>
      </header>
      <ul class="pbe-pro-sports pbe-intl-featured-list">
        ${c.featured.map((k) => sportCard(sport(k))).join('\n        ')}
      </ul>
    </section>

    <section class="pbe-pro-wrap pbe-pro-network" aria-labelledby="pbe-pro-network-h">
      <div class="pbe-pro-network-media">${picture('network', c.networkAlt, '(max-width: 880px) 100vw, 520px')}</div>
      <div class="pbe-pro-network-copy">
        <span class="pbe-pro-eyebrow">${esc(c.networkEyebrow)}</span>
        <h2 id="pbe-pro-network-h">${esc(c.networkH)}</h2>
        <p>${esc(c.networkP)}</p>
      </div>
    </section>

    <section class="pbe-pro-wrap pbe-pro-section" id="products" aria-labelledby="pbe-pro-products-h">
      <header class="pbe-pro-section-head">
        <span class="pbe-pro-eyebrow">${esc(c.productsEyebrow)}</span>
        <h2 id="pbe-pro-products-h">${esc(c.productsH)}</h2>
      </header>
      <div class="pbe-pro-stories">
        ${story('compare', 'compare', false)}
        ${story('predictions', 'predictions', true)}
      </div>
      <div class="pbe-pro-duo">
        <article class="pbe-pro-panel pbe-pro-panel-markets" data-pbe-story="markets">
          <span class="pbe-pro-eyebrow">${esc(mEyebrow)}</span>
          <h3>${esc(mTitle)}</h3>
          <ul class="pbe-pro-tape">${c.tapes.markets.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
          <p>${esc(mBody)}</p>
          <div class="pbe-pro-story-links">
            <a class="pbe-pro-text-link" href="${product('markets').url}" rel="noopener">${esc(mAction)} →</a>
            <a class="pbe-pro-text-link is-secondary" href="${CRYPTO_URL}" rel="noopener">${esc(mCrypto)}</a>
          </div>
        </article>
        <article class="pbe-pro-panel pbe-pro-panel-hub" data-pbe-story="members">
          <span class="pbe-pro-eyebrow">${esc(hEyebrow)}</span>
          <h3>${esc(hTitle)}</h3>
          <ul class="pbe-pro-tape">${c.tapes.members.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
          <p>${esc(hBody)}</p>
          <div class="pbe-pro-story-links"><a class="pbe-pro-text-link" href="${product('members').url}" rel="noopener">${esc(hAction)} →</a></div>
        </article>
      </div>
    </section>

    <section class="pbe-pro-wrap pbe-pro-section pbe-pro-sports-section" id="sports" aria-labelledby="pbe-pro-sports-h">
      <header class="pbe-pro-section-head">
        <span class="pbe-pro-eyebrow">${esc(c.sportsEyebrow)}</span>
        <h2 id="pbe-pro-sports-h">${esc(c.sportsH)}</h2>
      </header>
      <ul class="pbe-pro-sports">
        ${SPORTS.map(sportCard).join('\n        ')}
      </ul>
    </section>

    <section class="pbe-pro-wrap pbe-pro-section pbe-pro-why" id="why" aria-labelledby="pbe-pro-why-h">
      <header class="pbe-pro-section-head">
        <span class="pbe-pro-eyebrow">${esc(c.whyEyebrow)}</span>
        <h2 id="pbe-pro-why-h">${esc(c.whyH)}</h2>
        <p>${esc(c.whyP)}</p>
      </header>
      <div class="pbe-pro-why-grid">
        ${c.why.map(([t, b], i) => `<article><span>0${i + 1}</span><h3>${esc(t)}</h3><p>${esc(b)}</p></article>`).join('\n        ')}
        <article class="is-gold"><span>0${c.why.length + 1}</span><h3>${esc(c.whyLast[0])}</h3><p>${esc(c.whyLast[1])}</p></article>
      </div>
    </section>

    <section class="pbe-pro-wrap pbe-pro-final-wrap">
      <div class="pbe-pro-final">
        <h2>${esc(c.finalH)}</h2>
        <p class="pbe-pro-final-price">${esc(c.finalPrice)}</p>
        ${termsBox(c)}
        ${cta(lang, via, c.cta, 'pbe-pro-cta-hero')}
        <div class="pbe-pro-offer" role="note" aria-label="${esc(c.offerAria)}">
          <span class="pbe-pro-offer-line">${esc(c.offerLine)}</span>
          <span class="pbe-pro-offer-code">${esc(c.codeLabel)} <code data-pbe-promo-code>${ALL_ACCESS.promoCode}</code>
            <button type="button" class="pbe-pro-copy" data-pbe-copy="${ALL_ACCESS.promoCode}" data-pbe-copy-done="${esc(c.copied)}" aria-label="${esc(c.copyAria)}">${esc(c.copy)}</button>
          </span>
        </div>
        <div class="pbe-pro-final-links">
          <a href="${SIGN_IN_URL}">${esc(c.memberLink)}</a>
          <a href="${ALL_ACCESS.manageUrl}" target="_blank" rel="noopener noreferrer">${esc(c.manage)}</a>
          ${DISCLOSURE_PATH[lang] ? `<a href="${DISCLOSURE_PATH[lang]}" data-pbe-reload>${esc(c.disclosureLink)}</a>` : ''}
        </div>
      </div>
    </section>
    </div>
    </main>
    ${footer(lang)}
  </div>`;
}

export function intlDisclosureHtml(lang) {
  const d = DISCLOSURE[lang];
  // Row values are trusted constants from this module; some carry links.
  return `<div class="pbe-intl" lang="${lang}" data-pbe-page="disclosure-intl" data-pbe-locale="${lang}">
    ${topBar(lang, 'disclosure')}
    <main class="pbe-intl-legal">
      <div class="pbe-pro-wrap pbe-intl-legal-inner">
        <h1>${esc(d.h1)}</h1>
        <p class="pbe-intl-legal-intro">${esc(d.intro)}</p>
        <dl class="pbe-intl-legal-table">
          ${d.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('\n          ')}
        </dl>
        <p class="pbe-intl-legal-note">${esc(d.note)}</p>
        <p><a class="pbe-pro-text-link" href="/${lang}/pro" data-pbe-reload>${esc(d.back)} →</a></p>
      </div>
    </main>
    ${footer(lang)}
  </div>`;
}

export function intlHtml(route, opts = {}) {
  return route.kind === 'pro' ? intlProHtml(route.lang, opts) : intlDisclosureHtml(route.lang);
}
