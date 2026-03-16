import { embedBatch } from "../embeddings/openaiEmbedder";
import { parseDocxFile } from "../parsers/docxParser";
import { parseHtmlUrl } from "../parsers/htmlParser";
import { parseImageFolderWithOcr } from "../parsers/ocrImageParser";
import { parsePdfFile } from "../parsers/pdfParser";
import { parseXlsxFile } from "../parsers/xlsxParser";
import { fixedTokenWindowSplitter } from "../splitters/fixedTokenWindow";
import { recursiveDelimiterSplitter } from "../splitters/recursiveSplitter";
import { upsertChunksToElasticsearch } from "../stores/elasticsearchStore";
import { upsertChunksToPgvector } from "../stores/pgvectorStore";
import { ChunkDocument } from "../types/storage";

type SplitterName = "fixed" | "recursive";
export type IngestionSource = "pdf" | "ocr" | "html" | "docx" | "xlsx";

export interface IngestPdfOptions {
  tenantId: string;
  splitter?: SplitterName;
  source?: IngestionSource;
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
  input: string,
  options: IngestPdfOptions
): Promise<IngestPdfResult> {
  const splitter = options.splitter ?? "fixed";
  const source = options.source ?? "pdf";
  const writeToElasticsearch = options.writeToElasticsearch ?? true;
  const writeToPgvector = options.writeToPgvector ?? true;
  let extractedText = "";
  let extractedPages = 0;
  let sourceRef = input;
  let sourceType: "pdf" | "url" | "docx" | "xlsx" = "pdf";

  if (source === "html") {
    console.log("Step 1: Parse HTML");
    const parsedHtml = await parseHtmlUrl(input);
    extractedText = parsedHtml.text;
    extractedPages = 1;
    sourceRef = parsedHtml.url;
    sourceType = "url";
    console.log(`Extracted text length: ${parsedHtml.text.length} chars`);
    console.log("Preview:", parsedHtml.text.slice(0, 500));
  } else if (source === "docx") {
    console.log("Step 1: Parse DOCX");
    const parsedDocx = await parseDocxFile(input);
    extractedText = parsedDocx.text;
    extractedPages = parsedDocx.pages;
    sourceType = "docx";
    console.log(`Extracted text length: ${parsedDocx.text.length} chars`);
    console.log(`DOCX warnings: ${parsedDocx.warnings.length}`);
    console.log("Preview:", parsedDocx.text.slice(0, 500));
  } else if (source === "xlsx") {
    console.log("Step 1: Parse XLSX");
    const parsedXlsx = await parseXlsxFile(input);
    extractedText = parsedXlsx.text;
    extractedPages = parsedXlsx.pages;
    sourceType = "xlsx";
    console.log(`Extracted text length: ${parsedXlsx.text.length} chars`);
    console.log(`Sheets: ${parsedXlsx.sheetCount}, rows: ${parsedXlsx.rowCount}`);
    console.log(`XLSX warnings: ${parsedXlsx.warnings.length}`);
    console.log("Preview:", parsedXlsx.text.slice(0, 500));
  } else {
    console.log("Step 1-1: Parse PDF");
    const parsed = await parsePdfFile(input);
    extractedText = parsed.text;
    extractedPages = parsed.pages;
    console.log(`Extracted text length: ${parsed.text.length} chars`);
    console.log(`Pages: ${parsed.pages}`);
    console.log("Preview:", parsed.text.slice(0, 500));

    if (source === "ocr") {
      if (!options.ocrImageDir) {
        throw new Error("OCR source requires --ocr-dir");
      }

      console.log("Step 1-2: OCR");
      const ocrParsed = await parseImageFolderWithOcr(options.ocrImageDir);
      console.log(`OCR text length: ${ocrParsed.text.length} chars`);
      console.log(`OCR pages: ${ocrParsed.pages}`);
      console.log("OCR Preview:", ocrParsed.text.slice(0, 500));

      extractedText = ocrParsed.text;
      extractedPages = ocrParsed.pages;
    }
  }

  const minExtractedTextLength = source === "pdf" || source === "ocr" ? 100 : 20;
  if (extractedText.trim().length < minExtractedTextLength) {
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

  const docId = buildDocId(sourceRef);
  const nowIso = new Date().toISOString();
  const documents: ChunkDocument[] = embeddedChunks.map(({ chunk, embedding }, index) => ({
    chunkId: `${docId}_chunk_${index}`,
    docId,
    chunkIndex: chunk.chunkIndex,
    tokenCount: chunk.tokenCount,
    tenantId: options.tenantId,
    source: sourceRef,
    sourceType,
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
