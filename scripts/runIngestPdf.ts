import { loadDotEnv } from "../src/config/loadEnv";
import { ingestPdfPipeline } from "../src/pipelines/ingestPdfPipeline";
import { closeElasticsearchClient } from "../src/stores/elasticsearchStore";
import { closePgPool } from "../src/stores/pgvectorStore";

type SourceName = "pdf" | "ocr" | "html" | "docx" | "xlsx";

interface CliOptions {
  source: SourceName;
  filePath: string;
  url?: string;
  tenantId: string;
  splitter: "fixed" | "recursive";
  skipEs: boolean;
  skipPg: boolean;
  ocrImageDir?: string;
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    source: "pdf",
    filePath: "./original_docs/1706.03762v7.pdf",
    url: undefined,
    tenantId: "tenant_A",
    splitter: "fixed",
    skipEs: false,
    skipPg: false,
    ocrImageDir: undefined,
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

    if (token === "--url" && argv[i + 1]) {
      options.url = argv[i + 1] as string;
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

    if (token === "--source" && argv[i + 1]) {
      const source = argv[i + 1];
      if (
        source === "pdf" ||
        source === "ocr" ||
        source === "html" ||
        source === "docx" ||
        source === "xlsx"
      ) {
        options.source = source;
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
      continue;
    }

    if (token === "--ocr-dir" && argv[i + 1]) {
      options.ocrImageDir = argv[i + 1] as string;
      i += 1;
    }
  }

  return options;
}

function resolveIngestionInput(options: CliOptions): string {
  if (options.source === "html") {
    if (!options.url) {
      throw new Error("HTML source requires --url");
    }
    return options.url;
  }

  return options.filePath;
}

async function main(): Promise<void> {
  loadDotEnv();
  const options = parseCliOptions(process.argv.slice(2));
  const ingestionInput = resolveIngestionInput(options);

  const result = await ingestPdfPipeline(ingestionInput, {
    tenantId: options.tenantId,
    splitter: options.splitter,
    source: options.source,
    writeToElasticsearch: !options.skipEs,
    writeToPgvector: !options.skipPg,
    ocrImageDir: options.source === "ocr" ? options.ocrImageDir : undefined,
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
