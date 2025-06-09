export interface WindRecord {
  Fecha: string;
  Año: string;
  Mes: string;
  Día: string;
  Hora: string;
  Dirección: string;
  Velocidad: string;
  Interpolado: string;
}

export interface WRPlotHeader {
  id: number;
  name: string;
  countryCode: string;
  timezone: number;
  latitude: string; // e.g., "N14 09"
  longitude: string; // e.g., "W180 00"
  altitude: number;
}

export interface Record {
  header:WRPlotHeader,
  body:WindRecord
}