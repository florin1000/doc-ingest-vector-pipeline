import fs from "fs";
import { PDFParse } from "pdf-parse";

export interface ParsedPdf {
  text: string;
  pages: number;
}

export async function parsePdfFile(filePath: string): Promise<ParsedPdf> {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });

  try {
    const parsed = await parser.getText();
    return {
      text: parsed.text,
      pages: parsed.total,
    };
  } finally {
    await parser.destroy();
  }
}

