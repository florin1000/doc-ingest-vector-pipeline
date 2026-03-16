import { Chunk } from "../types/chunk";
import { normalizeWhitespace } from "../utils/textNormalization";

const DEFAULT_MAX_CHUNK_TOKENS = 512;
const DEFAULT_TOKEN_TO_WORD_RATIO = 0.75;
const DEFAULT_OVERLAP_RATIO = 0.2;

interface FixedTokenWindowOptions {
  maxChunkTokens?: number;
  tokenToWordRatio?: number;
  overlapRatio?: number;
}

export function fixedTokenWindowSplitter(
  text: string,
  options: FixedTokenWindowOptions = {}
): Chunk[] {
  if (text.trim().length === 0) {
    return [];
  }

  const maxChunkTokens = options.maxChunkTokens ?? DEFAULT_MAX_CHUNK_TOKENS;
  const tokenToWordRatio = options.tokenToWordRatio ?? DEFAULT_TOKEN_TO_WORD_RATIO;
  const overlapRatio = options.overlapRatio ?? DEFAULT_OVERLAP_RATIO;

  const maxWords = Math.floor(maxChunkTokens * tokenToWordRatio);
  const overlapWords = Math.floor(maxWords * overlapRatio);
  const step = maxWords - overlapWords;

  if (maxWords <= 0 || step <= 0) {
    return [];
  }

  const words = normalizeWhitespace(text).split(/\s+/);
  const chunks: Chunk[] = [];

  for (let start = 0, index = 0; start < words.length; start += step, index += 1) {
    const chunkWords = words.slice(start, start + maxWords);
    if (!chunkWords.length) {
      continue;
    }

    chunks.push({
      text: chunkWords.join(" "),
      chunkIndex: index,
      tokenCount: Math.ceil(chunkWords.length / tokenToWordRatio),
    });
  }

  return chunks;
}

export default fixedTokenWindowSplitter;
