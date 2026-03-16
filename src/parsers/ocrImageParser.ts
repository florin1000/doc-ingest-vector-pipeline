import fs from "fs";
import path from "path";
import { createWorker } from "tesseract.js";
import { ParsedPdf } from "./pdfParser";

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".tif",
  ".tiff",
  ".bmp",
  ".webp",
]);

function listImageFiles(imageDir: string): string[] {
  const entries = fs.readdirSync(imageDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => path.join(imageDir, name));
}

export async function parseImageFolderWithOcr(imageDir: string): Promise<ParsedPdf> {
  if (!fs.existsSync(imageDir)) {
    throw new Error(`OCR image directory does not exist: ${imageDir}`);
  }

  const imagePaths = listImageFiles(imageDir);
  if (!imagePaths.length) {
    throw new Error(`No supported image files found in: ${imageDir}`);
  }

  const worker = await createWorker("eng");
  const pages: string[] = [];

  try {
    for (const imagePath of imagePaths) {
      const result = await worker.recognize(imagePath);
      pages.push(result.data.text.trim());
    }
  } finally {
    await worker.terminate();
  }

  return {
    text: pages.join("\n\n"),
    pages: imagePaths.length,
  };
}

