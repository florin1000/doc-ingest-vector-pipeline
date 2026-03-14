// Node 18 compatibility for undici used by @elastic/elasticsearch v9.
if (typeof globalThis.File === "undefined") {
  globalThis.File = class File {};
}

const { Client } = require("@elastic/elasticsearch");

async function main() {
  const es = new Client({ node: "http://localhost:9200" });

  try {
    await es.indices.create({
      index: "knowledge_hub",
      mappings: {
        properties: {
          text: { type: "text" }, // BM25 keyword search
          embedding: {
            type: "dense_vector",
            dims: 1536,
            index: true,
            similarity: "cosine",
          }, // semantic search
          doc_id: { type: "keyword" },
          chunk_id: { type: "keyword" },
          chunk_index: { type: "integer" },
          token_count: { type: "integer" },
          tenant_id: { type: "keyword" },
          source: { type: "keyword" },
          source_type: { type: "keyword" },
          section: { type: "keyword" },
          page_start: { type: "integer" },
          language: { type: "keyword" },
          date_updated: { type: "date" },
        },
      },
    });

    console.log("ES index created");
  } catch (error) {
    if (error?.meta?.body?.error?.type === "resource_already_exists_exception") {
      console.log("ES index already exists: knowledge_hub");
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error("Failed to create ES index:", error.message);
  process.exit(1);
});
