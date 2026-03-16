import { Chunk } from "../types/chunk";
import { normalizeWhitespace } from "../utils/textNormalization";

const DEFAULT_MAX_CHUNK_TOKENS = 512;
const DEFAULT_TOKEN_TO_WORD_RATIO = 0.75;
const DEFAULT_OVERLAP_TOKENS = 0;
const DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " "];

interface RecursiveSplitterOptions {
  maxChunkTokens?: number;
  tokenToWordRatio?: number;
  overlapTokens?: number;
  separators?: string[];
}

function wordCount(text: string): number {
  if (!text.trim()) {
    return 0;
  }

  return text.trim().split(/\s+/).length;
}

function hardSplitByWords(text: string, maxWords: number): string[] {
  const words = text.trim().split(/\s+/);
  const segments: string[] = [];

  for (let i = 0; i < words.length; i += maxWords) {
    segments.push(words.slice(i, i + maxWords).join(" "));
  }

  return segments;
}

function recursiveSplitSegment(
  segment: string,
  separators: string[],
  maxWords: number,
  separatorIndex: number
): string[] {
  if (wordCount(segment) <= maxWords) {
    return [segment.trim()];
  }

  if (separatorIndex >= separators.length) {
    return hardSplitByWords(segment, maxWords);
  }

  const separator = separators[separatorIndex];
  const rawParts = segment.split(separator).map((part) => part.trim()).filter(Boolean);

  if (rawParts.length <= 1) {
    return recursiveSplitSegment(segment, separators, maxWords, separatorIndex + 1);
  }

  const merged: string[] = [];
  let current = "";

  for (const part of rawParts) {
    if (!current) {
      if (wordCount(part) <= maxWords) {
        current = part;
      } else {
        merged.push(
          ...recursiveSplitSegment(part, separators, maxWords, separatorIndex + 1)
        );
      }

      continue;
    }

    const candidate = `${current}${separator}${part}`;
    if (wordCount(candidate) <= maxWords) {
      current = candidate;
      continue;
    }

    merged.push(current);
    if (wordCount(part) <= maxWords) {
      current = part;
    } else {
      merged.push(
        ...recursiveSplitSegment(part, separators, maxWords, separatorIndex + 1)
      );
      current = "";
    }
  }

  if (current) {
    merged.push(current);
  }

  return merged.flatMap((part) => {
    if (wordCount(part) <= maxWords) {
      return part;
    }

    return recursiveSplitSegment(part, separators, maxWords, separatorIndex + 1);
  });
}

function applyWordOverlap(
  segments: string[],
  overlapWords: number,
  maxWords: number
): string[] {
  if (overlapWords <= 0) {
    return segments;
  }

  return segments.map((segment, index) => {
    if (index === 0) {
      return segment;
    }

    const previousWords = segments[index - 1].split(/\s+/);
    const currentWords = segment.split(/\s+/);
    const prefix = previousWords.slice(-overlapWords);
    const merged = [...prefix, ...currentWords];

    if (merged.length <= maxWords) {
      return merged.join(" ");
    }

    return merged.slice(merged.length - maxWords).join(" ");
  });
}

export function recursiveDelimiterSplitter(
  text: string,
  options: RecursiveSplitterOptions = {}
): Chunk[] {
  if (!text.trim()) {
    return [];
  }

  const normalized = normalizeWhitespace(text);
  const maxChunkTokens = options.maxChunkTokens ?? DEFAULT_MAX_CHUNK_TOKENS;
  const tokenToWordRatio = options.tokenToWordRatio ?? DEFAULT_TOKEN_TO_WORD_RATIO;
  const overlapTokens = options.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const separators = options.separators ?? DEFAULT_SEPARATORS;

  const maxWords = Math.floor(maxChunkTokens * tokenToWordRatio);
  const overlapWords = Math.floor(overlapTokens * tokenToWordRatio);

  if (maxWords <= 0) {
    return [];
  }

  const baseSegments = recursiveSplitSegment(normalized, separators, maxWords, 0);
  const segmentsWithOverlap = applyWordOverlap(baseSegments, overlapWords, maxWords);

  return segmentsWithOverlap.map((segment, index) => {
    const words = segment.split(/\s+/);

    return {
      text: segment,
      chunkIndex: index,
      tokenCount: Math.ceil(words.length / tokenToWordRatio),
    };
  });
}

export default recursiveDelimiterSplitter;
