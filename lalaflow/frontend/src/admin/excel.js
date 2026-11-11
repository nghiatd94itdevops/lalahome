const HEADER_COLOUR = "#6B4423";
const SHEET_NAME_LIMIT = 31;
const LANDSCAPE_FROM_COLUMNS = 8;

export const excelDate = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "");

// sheets: [{ name, columns: [{ header, key | value(row), width, number }], rows }]
export async function downloadWorkbook(fileName, sheets) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const normalized = sheets.map(({ name, columns, rows }) => ({
    sheet: name.slice(0, SHEET_NAME_LIMIT),
    stickyRowsCount: 1,
    orientation: columns.length >= LANDSCAPE_FROM_COLUMNS ? "landscape" : "portrait",
    columns: columns.map((column) => ({ width: column.width || 18 })),
    data: [
      columns.map((column) => ({ value: column.header, fontWeight: "bold", color: "#FFFFFF", backgroundColor: HEADER_COLOUR, align: "center", wrap: true })),
      ...rows.map((row) =>
        columns.map((column) => {
          const raw = typeof column.value === "function" ? column.value(row) : row[column.key];
          const value = raw == null ? "" : column.number ? Number(raw || 0) : String(raw);
          return { value, type: column.number ? Number : String, format: column.number ? "#,##0" : undefined, align: column.number ? "right" : "left", wrap: true };
        }),
      ),
    ],
  }));
  await writeExcelFile(normalized, { fontFamily: "Arial", fontSize: 10 }).toFile(fileName);
}
