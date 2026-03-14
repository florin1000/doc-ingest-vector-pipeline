import { OpenAI } from "openai";
import { EmbeddedChunk, EmbeddingChunkInput } from "../types/chunk";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY. Set it in the environment or in .env before running ingestion."
    );
  }

  return new OpenAI({ apiKey });
}

export async function embedBatch<T extends EmbeddingChunkInput>(
  chunks: T[]
): Promise<EmbeddedChunk<T>[]> {
  if (!chunks.length) {
    return [];
  }

  for (const chunk of chunks) {
    if (!chunk.text.trim()) {
      throw new Error("Empty text chunk detected before embedding.");
    }
  }

  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks.map((chunk) => chunk.text),
  });

  if (response.data.length !== chunks.length) {
    throw new Error(
      `Embedding count mismatch: got ${response.data.length}, expected ${chunks.length}.`
    );
  }

  const embeddingsByIndex = new Map<number, number[]>(
    response.data.map((item) => [item.index, item.embedding])
  );

  return chunks.map((chunk, index) => {
    const embedding = embeddingsByIndex.get(index);
    if (!embedding) {
      throw new Error(`Missing embedding for input index ${index}.`);
    }

    return { chunk, embedding };
  });
}

export async function embedOne(text: string): Promise<number[]> {
  if (!text.trim()) {
    throw new Error("Empty text received in embedOne.");
  }

  const [embedded] = await embedBatch([{ text }]);
  if (!embedded) {
    throw new Error("No embedding returned for single input.");
  }

  return embedded.embedding;
}

