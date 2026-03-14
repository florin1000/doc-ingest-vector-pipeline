import { loadDotEnv } from "../src/config/loadEnv";
import { ingestPdfPipeline } from "../src/pipelines/ingestPdfPipeline";
import { closeElasticsearchClient } from "../src/stores/elasticsearchStore";
import { closePgPool } from "../src/stores/pgvectorStore";

interface CliOptions {
  filePath: string;
  tenantId: string;
  splitter: "fixed" | "recursive";
  skipEs: boolean;
  skipPg: boolean;
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    filePath: "./original_docs/1706.03762v7.pdf",
    tenantId: "tenant_A",
    splitter: "fixed",
    skipEs: false,
    skipPg: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) {
      continue;
    }

    if (token === "--file" && argv[i + 1]) {
      options.filePath = argv[i + 1] as string;
      i += 1;
      continue;
    }

    if (token === "--tenant" && argv[i + 1]) {
      options.tenantId = argv[i + 1] as string;
      i += 1;
      continue;
    }

    if (token === "--splitter" && argv[i + 1]) {
      const splitter = argv[i + 1];
      if (splitter === "fixed" || splitter === "recursive") {
        options.splitter = splitter;
      }
      i += 1;
      continue;
    }

    if (token === "--skip-es") {
      options.skipEs = true;
      continue;
    }

    if (token === "--skip-pg") {
      options.skipPg = true;
    }
  }

  return options;
}

async function main(): Promise<void> {
  loadDotEnv();
  const options = parseCliOptions(process.argv.slice(2));

  const result = await ingestPdfPipeline(options.filePath, {
    tenantId: options.tenantId,
    splitter: options.splitter,
    writeToElasticsearch: !options.skipEs,
    writeToPgvector: !options.skipPg,
  });

  console.log("\nDone");
  console.log(
    `docId=${result.docId} chunks=${result.chunkCount} pages=${result.pages} splitter=${result.splitter}`
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeElasticsearchClient();
    await closePgPool();
  });

