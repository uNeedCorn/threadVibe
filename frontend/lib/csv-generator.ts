/**
 * CSV 生成工具
 *
 * 支援：
 * - 中文（BOM header）
 * - 特殊字元處理（逗號、換行、引號）
 * - 瀏覽器下載觸發
 */

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

/**
 * 格式化 CSV 欄位值
 * - 處理 null/undefined
 * - 處理包含逗號、換行、引號的值
 */
function formatCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const strValue = String(value);

  // 如果包含逗號、換行或引號，需要用引號包裹並轉義內部引號
  if (
    strValue.includes(",") ||
    strValue.includes("\n") ||
    strValue.includes("\r") ||
    strValue.includes('"')
  ) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }

  return strValue;
}

/**
 * 生成 CSV 內容
 */
export function generateCsvContent<T>(
  data: T[],
  columns: CsvColumn<T>[]
): string {
  // BOM for Excel 正確顯示中文
  const BOM = "\uFEFF";

  // Header row
  const headers = columns.map((col) => formatCsvValue(col.header)).join(",");

  // Data rows
  const rows = data.map((row) =>
    columns.map((col) => formatCsvValue(col.accessor(row))).join(",")
  );

  return BOM + [headers, ...rows].join("\n");
}

/**
 * 觸發瀏覽器下載 CSV
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
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
 * 生成並下載 CSV
 */
export function generateAndDownloadCsv<T>(
  data: T[],
  columns: CsvColumn<T>[],
  filename: string
): void {
  const content = generateCsvContent(data, columns);
  downloadCsv(content, filename);
}

/**
 * 格式化日期為 YYYY-MM-DD
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

/**
 * 格式化時間為 HH:00
 */
export function formatHour(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return `${value.toFixed(2)}%`;
}

/**
 * 截斷文字
 */
export function truncateText(
  text: string | null | undefined,
  maxLength: number = 100
): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}
