# Architecture

## Ingestion Flow

1. Parse source document (`pdf-parse` for regular PDFs).
2. Split text into chunks (`fixed` or `recursive` splitter).
3. Generate embeddings with OpenAI (`text-embedding-3-small`).
4. Persist chunks + vectors to:
   - Elasticsearch (`knowledge_hub`)
   - PostgreSQL + pgvector (`chunks` table)

## Module Layout

- `src/parsers`: source-specific extractors.
- `src/splitters`: chunking strategies.
- `src/embeddings`: embedding providers.
- `src/stores`: sink-specific persistence (ES / pgvector).
- `src/pipelines`: orchestration logic.
- `scripts`: runnable entrypoints.

## Storage Model

Each chunk uses a stable identity:

- `docId = sanitize(filePath)`
- `chunkId = ${docId}_chunk_${index}`

This keeps writes idempotent across reruns for the same document.

