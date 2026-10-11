-- Community deck submissions + votes (moderation required before publish)
-- Status: pending | published | rejected | revise
CREATE TABLE IF NOT EXISTS community_decks (
  id TEXT PRIMARY KEY NOT NULL,
  google_sub TEXT NOT NULL,
  submitter_name TEXT NOT NULL,
  name TEXT NOT NULL,
  note TEXT NOT NULL,
  code TEXT NOT NULL,
  colors TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  checklist TEXT,
  reject_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  published_at TEXT,
  votes_up INTEGER NOT NULL DEFAULT 0,
  votes_down INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_community_decks_status ON community_decks(status);
CREATE INDEX IF NOT EXISTS idx_community_decks_created ON community_decks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_decks_sub ON community_decks(google_sub);

CREATE TABLE IF NOT EXISTS community_votes (
  deck_id TEXT NOT NULL,
  google_sub TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (deck_id, google_sub)
);

CREATE INDEX IF NOT EXISTS idx_community_votes_deck ON community_votes(deck_id);
