import fs from "fs";
import * as XLSX from "xlsx";
import { normalizeWhitespace } from "../utils/textNormalization";

export interface ParsedXlsx {
  text: string;
  pages: number;
  sheetCount: number;
  rowCount: number;
  warnings: string[];
}

function rowToSentence(row: Record<string, unknown>): string {
  const fields = Object.entries(row)
    .map(([key, value]) => [key.trim(), String(value ?? "").trim()] as const)
    .filter(([key, value]) => key.length > 0 && !key.startsWith("__EMPTY") && value.length > 0);

  return fields.map(([key, value]) => `${key}: ${value}`).join("; ");
}

export async function parseXlsxFile(filePath: string): Promise<ParsedXlsx> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`XLSX file does not exist: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const warnings: string[] = [];
  const lines: string[] = [];
  let totalRows = 0;

  if (!workbook.SheetNames.length) {
    throw new Error("XLSX file has no sheets.");
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      warnings.push(`Missing sheet object for: ${sheetName}`);
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    if (!rows.length) {
      warnings.push(`Sheet "${sheetName}" has no data rows.`);
      continue;
    }

    lines.push(`Sheet: ${sheetName}`);
    for (let index = 0; index < rows.length; index += 1) {
      const sentence = rowToSentence(rows[index] ?? {});
      if (!sentence) {
        continue;
      }
      lines.push(`Row ${index + 1}: ${sentence}`);
      totalRows += 1;
    }
  }

  return {
    text: normalizeWhitespace(lines.join("\n")),
    pages: workbook.SheetNames.length,
    sheetCount: workbook.SheetNames.length,
    rowCount: totalRows,
    warnings,
  };
}

