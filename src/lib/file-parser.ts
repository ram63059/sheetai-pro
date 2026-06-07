import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedFileData {
  headers: string[];
  rows: string[][];
  totalRows: number;
  totalColumns: number;
}

export function parseCSV(file: File): Promise<ParsedFileData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        const allRows = results.data as string[][];
        if (allRows.length === 0) {
          reject(new Error("Empty CSV file"));
          return;
        }
        const headers = allRows[0].map((h, i) => h?.trim() ? h : `Column ${i + 1}`);
        const rows = allRows.slice(1).filter((row) =>
          row.some((cell) => cell !== "" && cell != null)
        );
        resolve({
          headers,
          rows,
          totalRows: rows.length,
          totalColumns: headers.length,
        });
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}

export function parseXLSX(file: File): Promise<ParsedFileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, {
          header: 1,
          defval: "",
        });

        if (jsonData.length === 0) {
          reject(new Error("Empty spreadsheet"));
          return;
        }

        const headers = jsonData[0].map((h, i) => {
          const str = String(h || "").trim();
          return str ? str : `Column ${i + 1}`;
        });
        const rows = jsonData.slice(1).map((row) => row.map(String));

        resolve({
          headers,
          rows,
          totalRows: rows.length,
          totalColumns: headers.length,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseFile(file: File): Promise<ParsedFileData> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".tsv")) {
    return parseCSV(file);
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseXLSX(file);
  } else {
    throw new Error("Unsupported file format. Please upload a CSV or XLSX file.");
  }
}

/**
 * Generates a context string from the parsed data for sending to Gemini.
 * Sends ONLY headers and data types to save massive amounts of tokens.
 */
export function generateDataContext(
  data: ParsedFileData,
  maxSampleRows: number = 20
): string {
  const sampleRows = data.rows.slice(0, maxSampleRows);

  // Infer column types from sample rows
  const columnTypes = data.headers.map((header, colIdx) => {
    const sampleValues = sampleRows
      .map((row) => row[colIdx])
      .filter((v) => v !== "" && v != null);

    if (sampleValues.length === 0) return `${header} (empty)`;

    const allNumbers = sampleValues.every((v) => !isNaN(Number(v)));
    const allDates = sampleValues.every(
      (v) => !isNaN(Date.parse(v)) && isNaN(Number(v))
    );

    if (allNumbers) return `${header} (numeric)`;
    if (allDates) return `${header} (date)`;
    return `${header} (text)`;
  });

  let context = `## Spreadsheet Schema\n`;
  context += `- Total rows: ${data.totalRows}\n`;
  context += `- Total columns: ${data.totalColumns}\n`;
  context += `- Columns: ${columnTypes.join(", ")}\n`;

  // Include sample data so the AI can see actual values and write accurate expressions
  const previewRows = sampleRows.slice(0, 5);
  if (previewRows.length > 0) {
    context += `\n## Sample Data (first ${previewRows.length} rows)\n`;
    context += `| ${data.headers.join(" | ")} |\n`;
    context += `| ${data.headers.map(() => "---").join(" | ")} |\n`;
    for (const row of previewRows) {
      const cells = data.headers.map((_, i) => {
        const val = (row[i] || "").replace(/\|/g, "\\|").substring(0, 60);
        return val || "(empty)";
      });
      context += `| ${cells.join(" | ")} |\n`;
    }
  }

  // Include unique values for text columns (helps AI write correct filter expressions)
  context += `\n## Unique Values Per Column (up to 15 samples)\n`;
  for (let colIdx = 0; colIdx < data.headers.length; colIdx++) {
    const uniqueVals = [...new Set(
      sampleRows.map((row) => (row[colIdx] || "").trim()).filter(Boolean)
    )].slice(0, 15);
    if (uniqueVals.length > 0 && uniqueVals.length <= 15) {
      context += `- **${data.headers[colIdx]}**: ${uniqueVals.map(v => `"${v}"`).join(", ")}\n`;
    }
  }

  return context;
}

/**
 * Export data as a CSV string and trigger download.
 */
export function exportToCSV(headers: string[], rows: string[][], filename: string = "export.csv") {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => {
        // Escape cells containing commas, quotes, or newlines
        if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data as an XLSX file and trigger download.
 */
export function exportToXLSX(headers: string[], rows: string[][], filename: string = "export.xlsx") {
  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
