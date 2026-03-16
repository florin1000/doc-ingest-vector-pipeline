import { embedBatch } from "../embeddings/openaiEmbedder";
import { parseImageFolderWithOcr } from "../parsers/ocrImageParser";
import { parsePdfFile } from "../parsers/pdfParser";
import { fixedTokenWindowSplitter } from "../splitters/fixedTokenWindow";
import { recursiveDelimiterSplitter } from "../splitters/recursiveSplitter";
import { upsertChunksToElasticsearch } from "../stores/elasticsearchStore";
import { upsertChunksToPgvector } from "../stores/pgvectorStore";
import { ChunkDocument } from "../types/storage";

type SplitterName = "fixed" | "recursive";

export interface IngestPdfOptions {
  tenantId: string;
  splitter?: SplitterName;
  writeToElasticsearch?: boolean;
  writeToPgvector?: boolean;
  ocrImageDir?: string;
}

export interface IngestPdfResult {
  docId: string;
  pages: number;
  chunkCount: number;
  splitter: SplitterName;
}

function buildDocId(filePath: string): string {
  return filePath.replace(/[^a-z0-9]/gi, "_");
}

function selectSplitter(splitter: SplitterName) {
  if (splitter === "recursive") {
    return recursiveDelimiterSplitter;
  }

  return fixedTokenWindowSplitter;
}

export async function ingestPdfPipeline(
  filePath: string,
  options: IngestPdfOptions
): Promise<IngestPdfResult> {
  const splitter = options.splitter ?? "fixed";
  const writeToElasticsearch = options.writeToElasticsearch ?? true;
  const writeToPgvector = options.writeToPgvector ?? true;

  console.log("Step 1-1: Parse PDF");
  const parsed = await parsePdfFile(filePath);
  console.log(`Extracted text length: ${parsed.text.length} chars`);
  console.log(`Pages: ${parsed.pages}`);
  console.log("Preview:", parsed.text.slice(0, 500));

  let extractedText = parsed.text;
  let extractedPages = parsed.pages;

  if (options.ocrImageDir) {
    console.log("Step 1-2: OCR");
    const ocrParsed = await parseImageFolderWithOcr(options.ocrImageDir);
    console.log(`OCR text length: ${ocrParsed.text.length} chars`);
    console.log(`OCR pages: ${ocrParsed.pages}`);
    console.log("OCR Preview:", ocrParsed.text.slice(0, 500));

    extractedText = ocrParsed.text;
    extractedPages = ocrParsed.pages;
  }

  if (extractedText.trim().length < 100) {
    throw new Error("Text extraction returned almost nothing.");
  }

  console.log(`\nStep 2: Chunk (${splitter})`);
  const splitFn = selectSplitter(splitter);
  const chunks = splitFn(extractedText);
  console.log(`Created ${chunks.length} chunks`);

  if (!chunks.length) {
    throw new Error("No chunks produced from parsed text.");
  }

  console.log("\nStep 3: Embed (batched)");
  const embeddedChunks = await embedBatch(chunks);
  console.log(`Embedded ${embeddedChunks.length} chunks`);

  const docId = buildDocId(filePath);
  const nowIso = new Date().toISOString();
  const documents: ChunkDocument[] = embeddedChunks.map(({ chunk, embedding }, index) => ({
    chunkId: `${docId}_chunk_${index}`,
    docId,
    chunkIndex: chunk.chunkIndex,
    tokenCount: chunk.tokenCount,
    tenantId: options.tenantId,
    source: filePath,
    sourceType: "pdf",
    dateUpdated: nowIso,
    text: chunk.text,
    embedding,
  }));

  if (writeToElasticsearch) {
    console.log("\nStep 4: Store in Elasticsearch");
    await upsertChunksToElasticsearch(documents);
    console.log(`Stored ${documents.length} chunks in Elasticsearch`);
  }

  if (writeToPgvector) {
    console.log("\nStep 5: Store in PgVector");
    await upsertChunksToPgvector(documents);
    console.log(`Stored ${documents.length} chunks in pgvector`);
  }

  return {
    docId,
    pages: extractedPages,
    chunkCount: documents.length,
    splitter,
  };
}
