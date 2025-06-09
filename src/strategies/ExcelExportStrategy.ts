import type { ExportStrategy } from "./ExportStrategy";
import type { WindRecord } from "../types/WindRecord";
import * as XLSX from "xlsx";

export class ExcelExportStrategy implements ExportStrategy {
  export(data: WindRecord[], start: string, end: string): void {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datos Viento");
    XLSX.writeFile(workbook, `viento_${start}_a_${end}.xlsx`);
  }
}
