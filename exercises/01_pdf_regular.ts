import { loadDotEnv } from "../src/config/loadEnv";
import { ingestPdfPipeline } from "../src/pipelines/ingestPdfPipeline";
import { closeElasticsearchClient } from "../src/stores/elasticsearchStore";
import { closePgPool } from "../src/stores/pgvectorStore";

async function main(): Promise<void> {
  loadDotEnv();

  await ingestPdfPipeline("./original_docs/1706.03762v7.pdf", {
    tenantId: "tenant_A",
    splitter: "fixed",
    writeToElasticsearch: true,
    writeToPgvector: true,
  });

  console.log("Done");
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await closeElasticsearchClient();
    await closePgPool();
  });
