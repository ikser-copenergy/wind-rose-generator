import { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import dayjs, { Dayjs } from 'dayjs';

interface WindRecord {
  fecha: string;
  año: string;
  mes: string;
  dia: string;
  hora: string;
  direccion: string;
  velocidad: string;
  interpolado: string;
}

interface ApiData {
  date: string;
  windspeedmph: number;
  winddir: number;
}

export default function App() {
  const [loading, setLoading] = useState<boolean>(false);

  const API_KEY = import.meta.env.VITE_API_KEY;
  const APP_KEY = import.meta.env.VITE_APP_KEY;
  const MAC_ADDRESS = import.meta.env.VITE_MAC_ADDRESS;

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const handleExport = async () => {
    const now = dayjs();
    const endDate = now.startOf('day');
    const startDate = endDate.subtract(3, 'day');

    setLoading(true);
    try {
      let allData: { date: string; timestamp: Dayjs; windspeed: number | null; winddir: number | null }[] = [];
      for (let d = startDate; d.isBefore(endDate); d = d.add(1, 'day')) {
        const url = `https://api.ambientweather.net/v1/devices/${MAC_ADDRESS}`;
        const params = {
          apiKey: API_KEY,
          applicationKey: APP_KEY,
          endDate: d.endOf('day').toISOString(),
          limit: 288,
        };

        const response = await axios.get<ApiData[]>(url, { params });

        const processed = response.data.map((d) => {
          const ts = dayjs(d.date);
          return {
            date: d.date,
            timestamp: ts,
            windspeed: d.windspeedmph ?? null,
            winddir: d.winddir ?? null,
          };
        });

        allData.push(...processed);
        await delay(1000);
      }

      const hourlyMap: Record<string, typeof allData> = {};
      allData.forEach((entry) => {
        const hourKey = entry.timestamp.startOf('hour').format('YYYY-MM-DD HH:00');
        if (!hourlyMap[hourKey]) hourlyMap[hourKey] = [];
        hourlyMap[hourKey].push(entry);
      });

      const hourlyAverages: Record<string, { ts: Dayjs; speed: number | null; dir: number | null }> = {};
      for (const key in hourlyMap) {
        const group = hourlyMap[key];
        const ts = dayjs(key);

        const validSpeed = group.map(e => e.windspeed).filter(v => v !== null) as number[];
        const validDir = group.map(e => e.winddir).filter(v => v !== null) as number[];

        const avgSpeed = validSpeed.length > 0 ? validSpeed.reduce((a, b) => a + b, 0) / validSpeed.length : null;
        const avgDir = validDir.length > 0 ? validDir.reduce((a, b) => a + b, 0) / validDir.length : null;

        hourlyAverages[key] = { ts, speed: avgSpeed, dir: avgDir };
      }

      const filledRecords: WindRecord[] = [];
      const totalHours = endDate.endOf('day').diff(startDate.startOf('hour'), 'hour');

      for (let i = 0; i <= totalHours; i++) {
        const h = startDate.startOf('hour').add(i, 'hour');
        const key = h.format('YYYY-MM-DD HH:00');
        const current = hourlyAverages[key];

        if (current && current.speed !== null && current.dir !== null) {
          filledRecords.push({
            fecha: h.format('YYYY/MM/DD HH:mm'),
            año: h.format('YYYY'),
            mes: h.format('MM'),
            dia: h.format('DD'),
            hora: h.format('HH'),
            direccion: current.dir.toFixed(3),
            velocidad: current.speed.toFixed(3),
            interpolado: "",
          });
        } else {
          const prev = filledRecords[filledRecords.length - 1];
          let next: { velocidad: number; direccion: number } | undefined;

          for (let j = 1; j <= 48; j++) {
            const futureKey = h.add(j, 'hour').format('YYYY-MM-DD HH:00');
            const future = hourlyAverages[futureKey];
            if (future && future.speed !== null && future.dir !== null) {
              next = {
                velocidad: future.speed,
                direccion: future.dir,
              };
              break;
            }
          }

          if (prev && next) {
            filledRecords.push({
              fecha: h.format('YYYY/MM/DD HH:mm'),
              año: h.format('YYYY'),
              mes: h.format('MM'),
              dia: h.format('DD'),
              hora: h.format('HH'),
              direccion: ((parseFloat(prev.direccion) + next.direccion) / 2).toFixed(3),
              velocidad: ((parseFloat(prev.velocidad) + next.velocidad) / 2).toFixed(3),
              interpolado: "Interpolado",
            });
          }
        }
      }

      const worksheet = XLSX.utils.json_to_sheet(filledRecords);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos viento');
      XLSX.writeFile(workbook, `viento_${startDate.format('YYYY_MM_DD')}_a_${endDate.subtract(1, 'hour').format('YYYY_MM_DD')}.xlsx`);

    } catch (err) {
      console.error('Error al obtener/exportar datos:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold mb-4">Exportar viento (últimos 3 días)</h1>
      <button
        onClick={handleExport}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        disabled={loading}
      >
        {loading ? 'Procesando...' : 'Generar Excel'}
      </button>
    </div>
  );
}
