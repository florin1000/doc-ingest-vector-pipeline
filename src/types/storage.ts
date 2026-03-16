export interface ChunkDocument {
  chunkId: string;
  docId: string;
  chunkIndex: number;
  tokenCount: number;
  tenantId: string;
  source: string;
  sourceType: "pdf" | "url";
  dateUpdated: string;
  text: string;
  embedding: number[];
}
