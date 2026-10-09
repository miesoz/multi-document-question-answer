-- Database tables. Safe to run more than once.

-- One row per uploaded document. `content` holds the full original text.
CREATE TABLE IF NOT EXISTS documents (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per chunk (a piece of a document, about 1,000 characters).
-- Deleting a document deletes its chunks.
--
-- `text_search_vec` holds the chunk's words in searchable form: filler words
-- dropped, the rest cut to their root. Postgres fills it in whenever a chunk
-- is added or changed.
CREATE TABLE IF NOT EXISTS chunks (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id     BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index     INT NOT NULL,
  content         TEXT NOT NULL,
  text_search_vec TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  UNIQUE (document_id, chunk_index)
);

-- Maps each word to the chunks that contain it, so keyword search is fast.
CREATE INDEX IF NOT EXISTS chunks_text_search_idx
  ON chunks USING GIN (text_search_vec);
