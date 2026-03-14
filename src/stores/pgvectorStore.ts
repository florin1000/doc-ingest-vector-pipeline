import { Pool } from "pg";
import { ChunkDocument } from "../types/storage";

let pgPool: Pool | null = null;

function getPgPool(): Pool {
  if (!pgPool) {
    const connectionString =
      process.env.PG_URL ?? "postgresql://postgres:postgres@localhost:5433/vectordb";
    pgPool = new Pool({ connectionString });
  }

  return pgPool;
}

const UPSERT_SQL = `
  INSERT INTO chunks (
    chunk_id, doc_id, chunk_index, tenant_id,
    source, source_type, date_updated, text, embedding
  ) VALUES (
    $1, $2, $3, $4,
    $5, $6, $7, $8, $9::vector
  )
  ON CONFLICT (chunk_id) DO UPDATE SET
    doc_id = EXCLUDED.doc_id,
    chunk_index = EXCLUDED.chunk_index,
    tenant_id = EXCLUDED.tenant_id,
    source = EXCLUDED.source,
    source_type = EXCLUDED.source_type,
    date_updated = EXCLUDED.date_updated,
    text = EXCLUDED.text,
    embedding = EXCLUDED.embedding
`;

export async function upsertChunksToPgvector(
  documents: ChunkDocument[]
): Promise<void> {
  if (!documents.length) {
    return;
  }

  const { docId, tenantId } = documents[0];
  const client = await getPgPool().connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "DELETE FROM chunks WHERE doc_id = $1 AND tenant_id = $2",
      [docId, tenantId]
    );

    for (const document of documents) {
      await client.query(UPSERT_SQL, [
        document.chunkId,
        document.docId,
        document.chunkIndex,
        document.tenantId,
        document.source,
        document.sourceType,
        document.dateUpdated,
        document.text,
        `[${document.embedding.join(",")}]`,
      ]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePgPool(): Promise<void> {
  if (!pgPool) {
    return;
  }

  await pgPool.end();
  pgPool = null;
}
