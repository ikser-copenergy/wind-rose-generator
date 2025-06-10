import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import type { WindRecord } from "../types/WindRecord";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const referenceHeight = 11.88;

const changeStationHeight = (windSpeed: number, newHeight: number) => {
  return windSpeed * ( (newHeight / referenceHeight) ** 0.25 );
};

interface ApiData {
  date: string;
  windspeedmph: number;
  winddir: number;
}

export async function fetchAndProcessWindData(
  station: string,
  startDate: Dayjs,
  endDate: Dayjs,
  newHeight: number,
  apiKey: string,
  appKey: string
): Promise<WindRecord[]> {
  let allRecords: WindRecord[] = [];

  for (let d = startDate; d.isBefore(endDate); d = d.add(1, "day")) {
    const url = `https://api.ambientweather.net/v1/devices/${station}`;
    const params = {
      apiKey,
      applicationKey: appKey,
      endDate: d.endOf("day").toISOString(),
      limit: 288,
    };

    const response = await axios.get<ApiData[]>(url, { params });
    const mphToMps = 2.23694;//Constante de conversion de millas por hora a metros por segundo
    const rawData = response.data.map((entry) => ({
      timestamp: dayjs(entry.date).utcOffset(-360),
      windspeed: (entry.windspeedmph ?? null)/mphToMps,
      winddir: entry.winddir ?? null,
    }));

    const hourlyMap: Record<string, typeof rawData> = {};
    rawData.forEach((entry) => {
      const hourKey = entry.timestamp.startOf("hour").format("YYYY-MM-DD HH:00");
      if (!hourlyMap[hourKey]) hourlyMap[hourKey] = [];
      hourlyMap[hourKey].push(entry);
    });

    const hourlyAverages: Record<string, { ts: Dayjs; speed: number | null; dir: number | null }> = {};
    for (const key in hourlyMap) {
      const group = hourlyMap[key];
      const ts = dayjs(key);

      const validSpeed = group.map((e) => e.windspeed).filter((v) => v !== null) as number[];
      const validDir = group.map((e) => e.winddir).filter((v) => v !== null) as number[];

      const avgSpeed = validSpeed.length > 0 ? validSpeed.reduce((a, b) => a + b, 0) / validSpeed.length : null;
      const avgDir = validDir.length > 0 ? validDir.reduce((a, b) => a + b, 0) / validDir.length : null;

      hourlyAverages[key] = { ts, speed: avgSpeed, dir: avgDir };
    }

    let lastReal: { speed: number; dir: number } | null = null;
    let pendingInterpolated: WindRecord[] = [];

    for (let i = 0; i < 24; i++) {
      const h = d.startOf("day").add(i, "hour");
      const key = h.format("YYYY-MM-DD HH:00");
      const current = hourlyAverages[key];

      if (current && current.speed !== null && current.dir !== null) {
        if (lastReal && pendingInterpolated.length > 0) {
          const avgSpeed = (lastReal.speed + current.speed) / 2;
          const avgDir = (lastReal.dir + current.dir) / 2;

          for (const p of pendingInterpolated) {
            allRecords.push({
              ...p,
              Velocidad: changeStationHeight(avgSpeed, newHeight).toFixed(3),
              Dirección: avgDir.toFixed(3),
              Interpolado: "Interpolado",
            });
          }
          pendingInterpolated = [];
        }

        const record: WindRecord = {
          Fecha: h.format("DD/MM/YYYY HH:mm"),
          Año: h.format("YYYY"),
          Mes: h.format("MM"),
          Día: h.format("DD"),
          Hora: h.format("HH"),
          Dirección: current.dir.toFixed(3),
          Velocidad: changeStationHeight(current.speed, newHeight).toFixed(3),
          Interpolado: "",
        };
        allRecords.push(record);
        lastReal = { speed: current.speed, dir: current.dir };
      } else {
        if (lastReal) {
          pendingInterpolated.push({
            Fecha: h.format("DD/MM/YYYY HH:mm"),
            Año: h.format("YYYY"),
            Mes: h.format("MM"),
            Día: h.format("DD"),
            Hora: h.format("HH"),
            Dirección: "",
            Velocidad: "",
            Interpolado: "Interpolado",
          });
        }
      }
    }
    await delay(500);
  }

  return allRecords;
}
