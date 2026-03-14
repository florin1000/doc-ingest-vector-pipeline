export interface Chunk {
  text: string;
  chunkIndex: number;
  tokenCount: number;
}

export interface EmbeddingChunkInput {
  text: string;
}

export interface EmbeddedChunk<T extends EmbeddingChunkInput> {
  chunk: T;
  embedding: number[];
}

