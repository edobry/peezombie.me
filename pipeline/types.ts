/** Shared domain types for the corpus pipeline. */

/** A quote-tweet link to another user's status. */
export interface OtherQuote {
  user: string;
  id: string;
}

/** A tweet as it appears in the raw Twitter archive export. */
export interface RawTweet {
  id_str: string;
  created_at: string;
  full_text: string;
  favorite_count: string | number;
  retweet_count: string | number;
  in_reply_to_status_id_str?: string;
  in_reply_to_user_id_str?: string;
  in_reply_to_screen_name?: string;
  lang: string;
  entities?: {
    urls?: Array<{ expanded_url?: string }>;
    user_mentions?: Array<{ screen_name: string }>;
    hashtags?: Array<{ text: string }>;
    media?: unknown[];
  };
  extended_entities?: { media?: unknown[] };
}

/** A tweet after normalization by parse.ts. */
export interface Tweet {
  id: string;
  created: string;
  text: string;
  favs: number;
  rts: number;
  replyToId: string | null;
  replyToUser: string | null;
  replyToScreen: string | null;
  isRT: boolean;
  urls: string[];
  selfQuotes: string[];
  otherQuotes: OtherQuote[];
  mentions: string[];
  hashtags: string[];
  hasMedia: boolean;
  lang: string;
}

/** A reconstructed self-reply thread. */
export interface Thread {
  rootId: string;
  rootText: string;
  isReplyToOther: boolean;
  replyToScreen: string | null;
  size: number;
  totalFavs: number;
  maxFavs: number;
  started: string;
  ended: string;
  spanDays: number;
  tweetIds: string[];
  selfQuoteOut: string[];
}

/** A thread-to-thread edge in the self-quote graph. */
export interface ThreadLink {
  from: string;
  to: string;
}

/** A note-tweet (long-form) record from the archive. */
export interface NoteTweet {
  noteTweetId: string;
  [key: string]: unknown;
}

/** Editorial metadata for one node, from analysis/corpus-catalog.md via make-tags. */
export interface TagMeta {
  title?: string;
  tags?: string[];
  type?: string;
  grade?: string;
}

/** A tweet as rendered into the garden payload (short keys — this ships to the browser). */
export interface GardenTweet {
  id: string;
  d: string;
  f: number;
  x: string;
  q: string[];
  m?: boolean;
}

/** A node in the garden graph: either a thread or a standalone tweet. */
export interface GardenNode {
  id: string;
  kind: "thread" | "tweet";
  size: number;
  favs: number;
  started: string;
  span?: number;
  reply?: string | null;
  title: string | null;
  tags: string[];
  type: string | null;
  grade: string | null;
  tweets: GardenTweet[];
  x?: number;
  y?: number;
  r?: number;
}

/** A directed self-quote edge between two nodes. */
export interface GardenEdge {
  from: string;
  to: string;
}

/** A quoted tweet rendered as an inline quote-card. */
export interface QuotedText {
  x: string;
  d: string;
  node: string;
  inNode: boolean;
}

/** Output of concepts.ts. */
export interface ConceptIndex {
  concepts: string[];
  perTweet: Record<string, number[]>;
}

/** One tweet in the concept weave. */
export interface CorpusEntry {
  id: string;
  d: string;
  f: number;
  x: string;
  c: number[];
  th: string | null;
  m?: boolean;
}

/** The full payload inlined into site/index.html. */
export interface GardenData {
  generated: string;
  account: string;
  nodes: GardenNode[];
  edges: GardenEdge[];
  quoted: Record<string, QuotedText>;
  concepts: string[];
  corpus: CorpusEntry[];
}

/** One curated row parsed out of analysis/corpus-catalog.md by make-tags. */
export interface CatalogTag {
  title: string;
  tags: string[];
  type: string;
  grade: number;
  gist: string;
}
