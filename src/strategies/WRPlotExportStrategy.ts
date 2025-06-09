import type { ExportStrategy } from "./ExportStrategy";
import type { WindRecord, WRPlotHeader } from "../types/WindRecord";
import generateWRPlotFile from "../utils/generateWRPlotFile";
import dayjs from "dayjs";

export class WRPlotExportStrategy implements ExportStrategy {
  export(data: WindRecord[]): void {
    const header:WRPlotHeader = {
      id: 1,
      name: "LA ESPERANZA",
      countryCode: "IN",
      timezone: -6,
      latitude: "N14 09",
      longitude: "W180 00",
      altitude: 1700,
    };
    const wrPlotData = data
      .map((r) => ({
        ts: dayjs(`${r.Año}-${r.Mes}-${r.Día} ${r.Hora}:00`),
        dir: parseFloat(r.Dirección),
        speed: parseFloat(r.Velocidad),
      }))
      .filter((r) => !isNaN(r.dir) && !isNaN(r.speed));

    generateWRPlotFile(wrPlotData, header);
  }
}
