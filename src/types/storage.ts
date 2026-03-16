export interface ChunkDocument {
  chunkId: string;
  docId: string;
  chunkIndex: number;
  tokenCount: number;
  tenantId: string;
  source: string;
  sourceType: "pdf" | "url" | "docx";
  dateUpdated: string;
  text: string;
  embedding: number[];
}
