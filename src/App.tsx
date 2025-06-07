// Requisitos: React + Vite + Axios + xlsx + TypeScript
// 1. Ejecutar en consola:
//    npm create vite@latest ambient-weather-excel --template react-ts
//    cd ambient-weather-excel
//    npm install axios xlsx dayjs
//    npm run dev

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

    // Solo últimos 3 días para pruebas
    const startDate = endDate.subtract(3, 'day');

    // Para exportar el mes anterior completo, usar esto en su lugar:
    // const startDate = now.subtract(1, 'month').startOf('month');
    // const endDate = startDate.endOf('month');

    setLoading(true);
    try {
      let allData: { date: string; timestamp: Dayjs; windspeed: number; winddir: number }[] = [];
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
            
          let formatedData = {
            date: d.date,
            timestamp: ts,
            windspeed: d.windspeedmph,
            winddir: d.winddir,
          }
          
          return formatedData;

        });

        allData.push(...processed);
        await delay(1000); // Espera 1 segundo para evitar el error 429
      }

      // Agrupar por hora
      const hourlyMap: Record<string, typeof allData> = {};
      allData.forEach((entry) => {
        const hourKey = entry.timestamp.startOf('hour').format('YYYY-MM-DD HH:00');
        if (!hourlyMap[hourKey]) hourlyMap[hourKey] = [];
        hourlyMap[hourKey].push(entry);
      });

      // Promediar datos por hora
      const hourlyAverages: Record<string, { ts: Dayjs; speed: number; dir: number }> = {};
      for (const key in hourlyMap) {
        const group = hourlyMap[key];
        const ts = dayjs(key);
        const avgSpeed = group.reduce((a, b) => a + b.windspeed, 0) / group.length;
        const avgDir = group.reduce((a, b) => a + b.winddir, 0) / group.length;
        hourlyAverages[key] = { ts, speed: avgSpeed, dir: avgDir };
      }

      const filledRecords: WindRecord[] = [];
      for (let h = startDate.startOf('hour'); h.isBefore(endDate.endOf('day')); h = h.add(1, 'hour')) {
        const key = h.format('YYYY-MM-DD HH:00');
        const current = hourlyAverages[key];

        if (current) {
          filledRecords.push({
            fecha: h.format('YYYY/MM/DD HH:mm'),
            año: h.format('YYYY'),
            mes: h.format('MM'),
            dia: h.format('DD'),
            hora: h.format('HH'),
            direccion: current.dir.toFixed(3),
            velocidad: current.speed.toFixed(3),
          });
        } else {
          const prev = filledRecords[filledRecords.length - 1];
          let next: { velocidad: number; direccion: number } | undefined;

          for (let i = 1; i <= 48; i++) {
            const futureKey = h.add(i, 'hour').format('YYYY-MM-DD HH:00');
            if (hourlyAverages[futureKey]) {
              next = {
                velocidad: hourlyAverages[futureKey].speed,
                direccion: hourlyAverages[futureKey].dir,
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