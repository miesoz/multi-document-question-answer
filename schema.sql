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
CREATE TABLE IF NOT EXISTS chunks (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content     TEXT NOT NULL,
  UNIQUE (document_id, chunk_index)
);
