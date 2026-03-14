import { Client } from "@elastic/elasticsearch";
import { ChunkDocument } from "../types/storage";

let esClient: Client | null = null;

function getElasticsearchClient(): Client {
  if (!esClient) {
    const node = process.env.ES_NODE ?? "http://localhost:9200";
    esClient = new Client({ node });
  }

  return esClient;
}

function getIndexName(): string {
  return process.env.ES_INDEX ?? "knowledge_hub";
}

export async function upsertChunksToElasticsearch(
  documents: ChunkDocument[]
): Promise<void> {
  if (!documents.length) {
    return;
  }

  const { docId, tenantId } = documents[0];
  const indexName = getIndexName();
  const client = getElasticsearchClient();

  await client.deleteByQuery({
    index: indexName,
    query: {
      bool: {
        filter: [{ term: { doc_id: docId } }, { term: { tenant_id: tenantId } }],
      },
    },
    conflicts: "proceed",
    refresh: true,
  });

  const operations = documents.flatMap((doc) => [
    { index: { _index: indexName, _id: doc.chunkId } },
    {
      text: doc.text,
      embedding: doc.embedding,
      doc_id: doc.docId,
      chunk_id: doc.chunkId,
      chunk_index: doc.chunkIndex,
      token_count: doc.tokenCount,
      tenant_id: doc.tenantId,
      source: doc.source,
      source_type: doc.sourceType,
      date_updated: doc.dateUpdated,
    },
  ]);

  await client.bulk({ operations, refresh: true });
}

export async function closeElasticsearchClient(): Promise<void> {
  if (!esClient) {
    return;
  }

  await esClient.close();
  esClient = null;
}
