import { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import dayjs, { Dayjs } from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
dayjs.extend(isSameOrAfter);
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  Container, Typography, Button, Box, Paper, Snackbar, Alert, MenuItem, Select, FormControl, InputLabel, TextField
} from '@mui/material';

interface WindRecord {
  Fecha: string;
  Año: string;
  Mes: string;
  Día: string;
  Hora: string;
  Dirección: string;
  Velocidad: string;
  Interpolado: string;
}

interface ApiData {
  date: string;
  windspeedmph: number;
  winddir: number;
}

const STATIONS: Record<string, string> = {
  '': '',
  'CISA LES': import.meta.env.VITE_MAC_CISA_LES,
  'Santa Cruz 1': import.meta.env.VITE_MAC_SANTA_CRUZ_1,
  'Santa Cruz 2': import.meta.env.VITE_MAC_SANTA_CRUZ_2,
  'UPCO': import.meta.env.VITE_MAC_UPCO,
};

const referenceHeight = 11;

export default function App() {
  const [loading, setLoading] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<Dayjs>(dayjs().subtract(1, 'week').startOf('week'));
  const [endDate, setEndDate] = useState<Dayjs>(dayjs().subtract(1, 'week').endOf('week'));
  const [station, setStation] = useState<string>('');
  const [newHeight, setNewHeight] = useState<number>(11);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'error' | 'success' }>({ open: false, message: '', severity: 'error' });

  const API_KEY = import.meta.env.VITE_API_KEY;
  const APP_KEY = import.meta.env.VITE_APP_KEY;

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const changeStationHeight = (windSpeed: number) => {
    return windSpeed * (newHeight / referenceHeight) ** 0.2;
  };

  const handleExport = async () => {
    const now = dayjs();
    if (!startDate || !endDate) {
      setSnackbar({ open: true, message: 'Seleccione ambas fechas.', severity: 'error' });
      return;
    }

    if (!station) {
      setSnackbar({ open: true, message: 'Seleccione una estación.', severity: 'error' });
      return;
    }

    if (startDate.isSameOrAfter(endDate)) {
      setSnackbar({ open: true, message: 'La fecha de inicio debe ser menor que la fecha de fin.', severity: 'error' });
      return;
    }

    if (startDate.isSameOrAfter(now, 'day') || endDate.isSameOrAfter(now, 'day')) {
      setSnackbar({ open: true, message: 'No se pueden seleccionar fechas actuales o futuras.', severity: 'error' });
      return;
    }

    const adjustedStart = startDate.startOf('day');
    const adjustedEnd = endDate.endOf('day');

    setLoading(true);
    try {
      let allRecords: WindRecord[] = [];

      for (let d = adjustedStart; d.isBefore(adjustedEnd); d = d.add(1, 'day')) {
        const url = `https://api.ambientweather.net/v1/devices/${station}`;
        const params = {
          apiKey: API_KEY,
          applicationKey: APP_KEY,
          endDate: d.endOf('day').toISOString(),
          limit: 288,
        };

        const response = await axios.get<ApiData[]>(url, { params });

        const rawData = response.data.map((entry) => ({
          timestamp: dayjs(entry.date),
          windspeed: entry.windspeedmph ?? null,
          winddir: entry.winddir ?? null,
        }));

        const hourlyMap: Record<string, typeof rawData> = {};
        rawData.forEach((entry) => {
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

        let lastReal: { speed: number; dir: number } | null = null;
        let pendingInterpolated: WindRecord[] = [];

        for (let i = 0; i < 24; i++) {
          const h = d.startOf('day').add(i, 'hour');
          const key = h.format('YYYY-MM-DD HH:00');
          const current = hourlyAverages[key];

          if (current && current.speed !== null && current.dir !== null) {
            if (lastReal && pendingInterpolated.length > 0) {
              const avgSpeed = (lastReal.speed + current.speed) / 2;
              const avgDir = (lastReal.dir + current.dir) / 2;

              for (const p of pendingInterpolated) {
                allRecords.push({
                  ...p,
                  Velocidad: changeStationHeight(avgSpeed).toFixed(3),
                  Dirección: avgDir.toFixed(3),
                  Interpolado: "Interpolado"
                });
              }
              pendingInterpolated = [];
            }

            const record: WindRecord = {
              Fecha: h.format('DD/MM/YYYY HH:mm'),
              Año: h.format('YYYY'),
              Mes: h.format('MM'),
              Día: h.format('DD'),
              Hora: h.format('HH'),
              Dirección: current.dir.toFixed(3),
              Velocidad: changeStationHeight(current.speed).toFixed(3),
              Interpolado: "",
            };
            allRecords.push(record);
            lastReal = { speed: current.speed, dir: current.dir };
          } else {
            if (lastReal) {
              pendingInterpolated.push({
                Fecha: h.format('DD/MM/YYYY HH:mm'),
                Año: h.format('YYYY'),
                Mes: h.format('MM'),
                Día: h.format('DD'),
                Hora: h.format('HH'),
                Dirección: '',
                Velocidad: '',
                Interpolado: "Interpolado"
              });
            }
          }
        }
        await delay(1000);
      }

      const worksheet = XLSX.utils.json_to_sheet(allRecords);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos Viento');
      XLSX.writeFile(workbook, `viento_${adjustedStart.format('YYYY_MM_DD')}_a_${adjustedEnd.format('YYYY_MM_DD')}.xlsx`);

      setSnackbar({ open: true, message: 'Archivo exportado correctamente.', severity: 'success' });

    } catch (err) {
      console.error('Error al obtener/exportar datos:', err);
      setSnackbar({ open: true, message: 'Ocurrió un error al exportar los datos.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Container maxWidth="md" sx={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 6, width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Exportar datos de viento
          </Typography>
          <Box display="flex" flexDirection="column" gap={3} mb={3} width="100%">
            <FormControl fullWidth>
              <InputLabel>Estación</InputLabel>
              <Select
                value={station}
                label="Estación"
                onChange={(e) => setStation(e.target.value)}
              >
                {Object.entries(STATIONS).map(([label, mac]) => (
                  label ? <MenuItem key={mac} value={mac}>{label}</MenuItem> : null
                ))}
              </Select>
            </FormControl>
            <DatePicker
              label="Fecha inicio"
              format="DD/MM/YYYY"
              value={startDate}
              onChange={(newDate) => newDate && setStartDate(newDate.startOf('day'))}
              slotProps={{ textField: { fullWidth: true } }}
            />
            <DatePicker
              label="Fecha fin"
              format="DD/MM/YYYY"
              value={endDate}
              onChange={(newDate) => newDate && setEndDate(newDate.endOf('day'))}
              slotProps={{ textField: { fullWidth: true } }}
            />
            <TextField
              label="Altura de referencia (m)"
              value={referenceHeight}
              InputProps={{ readOnly: true }}
              fullWidth
            />
            <TextField
              label="Altura deseada (m)"
              type="number"
              value={newHeight}
              onChange={(e) => setNewHeight(parseFloat(e.target.value))}
              fullWidth
            />
          </Box>
          <Button
            variant="contained"
            color="primary"
            onClick={handleExport}
            disabled={loading}
            size="large"
            fullWidth
          >
            {loading ? 'Procesando...' : 'Generar Excel'}
          </Button>
        </Paper>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </LocalizationProvider>
  );
}
