# Embedding Ingestion Demo

A TypeScript ingestion pipeline that parses documents, chunks text, creates OpenAI embeddings, and stores vectors in both Elasticsearch and PostgreSQL (`pgvector`).

## Stack

- Node.js + TypeScript
- OpenAI Embeddings (`text-embedding-3-small`)
- Elasticsearch (`dense_vector`)
- PostgreSQL + `pgvector`
- Docker Compose for local infra

## Project Structure

- `src/pipelines`: ingestion orchestration
- `src/parsers`: document parsers
- `src/splitters`: chunking strategies (`fixed`, `recursive`)
- `src/embeddings`: OpenAI embedding client
- `src/stores`: Elasticsearch + pgvector writers
- `scripts`: runnable commands
- `setup`: DB/index bootstrap scripts

## Quick Start

1. Start infrastructure:

```bash
docker compose up -d
```

2. Initialize Elasticsearch index:

```bash
npm run setup:es-index
```

3. Initialize pgvector schema:

```bash
docker compose exec -T postgres psql -U postgres -d vectordb < setup/schema.sql
```

4. Configure environment:

```bash
cp .env.example .env
```

Set `OPENAI_API_KEY` in `.env`.

5. Run ingestion:

```bash
npm run ingest:pdf
```

## Useful Commands

- Type check: `npm run check`
- Custom ingest run:

```bash
npx ts-node scripts/runIngestPdf.ts \
  --source pdf \
  --file ./original_docs/1706.03762v7.pdf \
  --tenant tenant_A \
  --splitter fixed
```

- OCR from pre-generated images:

```bash
npx ts-node scripts/runIngestPdf.ts \
  --source ocr \
  --file ./original_docs/1706.03762v7.pdf \
  --tenant tenant_A \
  --splitter fixed \
  --ocr-dir ./original_docs/1706_03762v7_images
```

- HTML ingestion:

```bash
npx ts-node scripts/runIngestPdf.ts \
  --source html \
  --url https://en.wikipedia.org/wiki/Transformer_(deep_learning_architecture) \
  --tenant tenant_A \
  --splitter recursive
```

## Notes

- Rerunning ingestion for the same `docId + tenantId` replaces previous chunks in both stores.
- Keep `.env` out of git; rotate API keys if they were ever exposed.
