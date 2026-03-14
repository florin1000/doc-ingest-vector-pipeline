CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunks (
  chunk_id     TEXT PRIMARY KEY,
  doc_id       TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL,
  tenant_id    TEXT NOT NULL,
  source       TEXT,
  source_type  TEXT,
  section      TEXT,
  page_start   INTEGER,
  language     TEXT DEFAULT 'en',
  date_updated TIMESTAMPTZ DEFAULT NOW(),
  text         TEXT NOT NULL,
  embedding    vector(1536)
);

-- Index for fast ANN search
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);

-- Index for tenant filtering
CREATE INDEX ON chunks (tenant_id);
CREATE INDEX ON chunks (doc_id);