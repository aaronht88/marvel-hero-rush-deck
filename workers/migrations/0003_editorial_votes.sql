-- Votes on static editorial decks (data/decks.json ids such as chain-fire).
-- Kept separate from community_votes so IDs never collide.
CREATE TABLE IF NOT EXISTS editorial_votes (
  deck_id TEXT NOT NULL,
  google_sub TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (deck_id, google_sub)
);

CREATE INDEX IF NOT EXISTS idx_editorial_votes_deck ON editorial_votes(deck_id);
