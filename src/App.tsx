import { useState } from "react";
import dayjs, { Dayjs } from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
dayjs.extend(isSameOrAfter);
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import {
  Container, Typography, Button, Box, Paper, Snackbar, Alert, MenuItem, Select,
  FormControl, InputLabel, TextField, type SelectChangeEvent,
} from "@mui/material";

import { fetchAndProcessWindData } from "./services/fetchAndProcessWindData";
import type { WindRecord } from "./types/WindRecord";
import type { ExportStrategy } from "./strategies/ExportStrategy";
import { ExcelExportStrategy } from "./strategies/ExcelExportStrategy";
import { WRPlotExportStrategy } from "./strategies/WRPlotExportStrategy";

const STATIONS: Record<string, string> = {
  "": "",
  "CISA LES": import.meta.env.VITE_MAC_CISA_LES,
  "Santa Cruz 1": import.meta.env.VITE_MAC_SANTA_CRUZ_1,
  "Santa Cruz 2": import.meta.env.VITE_MAC_SANTA_CRUZ_2,
  "UPCO": import.meta.env.VITE_MAC_UPCO,
};

export default function App() {
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState<Dayjs>(dayjs().subtract(1, "week").startOf("week"));
  const [endDate, setEndDate] = useState<Dayjs>(dayjs().subtract(1, "week").endOf("week"));
  const [station, setStation] = useState("");
  const [newHeight, setNewHeight] = useState(11.88);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "error" as "error" | "success" });

  const API_KEY = import.meta.env.VITE_API_KEY;
  const APP_KEY = import.meta.env.VITE_APP_KEY;

  const handleExport = async (strategy: ExportStrategy) => {
    if (!startDate || !endDate) {
      setSnackbar({ open: true, message: "Seleccione ambas fechas.", severity: "error" });
      return;
    }

    if (!station) {
      setSnackbar({ open: true, message: "Seleccione una estación.", severity: "error" });
      return;
    }

    if (startDate.isSameOrAfter(endDate)) {
      setSnackbar({ open: true, message: "La fecha de inicio debe ser menor que la fecha de fin.", severity: "error" });
      return;
    }

    const now = dayjs();
    if (startDate.isSameOrAfter(now, "day") || endDate.isSameOrAfter(now, "day")) {
      setSnackbar({ open: true, message: "No se pueden seleccionar fechas actuales o futuras.", severity: "error" });
      return;
    }

    setLoading(true);
    try {
      const data: WindRecord[] = await fetchAndProcessWindData(
        station,
        startDate.startOf("day"),
        endDate.endOf("day"),
        newHeight,
        API_KEY,
        APP_KEY
      );

      await strategy.export(data, startDate.format("YYYY-MM-DD"), endDate.format("YYYY-MM-DD"));
      setSnackbar({ open: true, message: "Exportación completada correctamente.", severity: "success" });
    } catch (error) {
      console.error("Error al exportar datos:", error);
      setSnackbar({ open: true, message: "Ocurrió un error durante la exportación.", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Container maxWidth="md" sx={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Paper elevation={3} sx={{ p: 6, width: "100%", maxWidth: 500, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Exportar datos de viento
          </Typography>
          <Box display="flex" flexDirection="column" gap={3} mb={3} width="100%">
            <FormControl fullWidth>
              <InputLabel>Estación</InputLabel>
              <Select value={station} label="Estación" onChange={(e: SelectChangeEvent<string>) => setStation(e.target.value)}>
                {Object.entries(STATIONS).map(([label, mac]) =>
                  label ? <MenuItem key={mac} value={mac}>{label}</MenuItem> : null
                )}
              </Select>
            </FormControl>

            <DatePicker
              label="Fecha inicio"
              format="DD/MM/YYYY"
              value={startDate}
              onChange={(newDate) => newDate && setStartDate(newDate.startOf("day"))}
              slotProps={{ textField: { fullWidth: true } }}
            />

            <DatePicker
              label="Fecha fin"
              format="DD/MM/YYYY"
              value={endDate}
              onChange={(newDate) => newDate && setEndDate(newDate.endOf("day"))}
              slotProps={{ textField: { fullWidth: true } }}
            />

            <TextField
              label="Altura de referencia (m)"
              value={11.88}
              InputProps={{ readOnly: true }}
              fullWidth
              disabled
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
            onClick={() => handleExport(new ExcelExportStrategy())}
            disabled={loading}
            fullWidth
          >
            {loading ? "Procesando..." : "Generar Excel"}
          </Button>

          <Button
            variant="outlined"
            color="secondary"
            onClick={() => handleExport(new WRPlotExportStrategy())}
            disabled={loading}
            fullWidth
            sx={{ mt: 2 }}
          >
            Generar WRPlot
          </Button>
        </Paper>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </LocalizationProvider>
  );
}
