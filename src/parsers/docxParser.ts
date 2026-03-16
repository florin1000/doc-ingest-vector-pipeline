import fs from "fs";
import mammoth from "mammoth";
import { normalizeWhitespace } from "../utils/textNormalization";

export interface ParsedDocx {
  text: string;
  pages: number;
  warnings: string[];
}

export async function parseDocxFile(filePath: string): Promise<ParsedDocx> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`DOCX file does not exist: ${filePath}`);
  }

  const result = await mammoth.extractRawText({ path: filePath });
  const warnings = result.messages
    .filter((message) => message.type === "warning")
    .map((message) => message.message);

  return {
    text: normalizeWhitespace(result.value),
    pages: 1,
    warnings,
  };
}
