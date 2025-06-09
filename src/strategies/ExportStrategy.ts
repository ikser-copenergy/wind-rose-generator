import type { WindRecord } from "../types/WindRecord";

export interface ExportStrategy {
  export(data: WindRecord[], start: string, end: string): void;
}
