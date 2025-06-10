import type { Dayjs } from 'dayjs';
import { saveAs } from 'file-saver';
interface WRPlotHeader {
  id: number;
  name: string;
  countryCode: string;
  timezone: number;
  latitude: string; // e.g., 'N14 09'
  longitude: string; // e.g., 'W180 00'
  altitude: number;
}

interface WRPlotRecord {
  ts: Dayjs;
  dir: number;
  speed: number;
}

const generateWRPlotFile = (
  data: WRPlotRecord[],
  header: WRPlotHeader
) => {
  // Línea de encabezado
  const headerLine = `~    ${header.id} ${header.name.padEnd(20)} ${header.countryCode}  ${header.timezone}  ${header.latitude}  ${header.longitude}  ${header.altitude}`;

  // Línea de cabecera de columnas
  const columnHeader = `~YR MO DA HR I    1    2       3       4       5  6  7     8     9  10   11  12    13     14     15        16   17     18   19  20      21`;

  const lines = [headerLine, columnHeader];

  data.forEach((record) => {
    const yr = record.ts.format('YY');
    const mo = record.ts.format('M');
    const da = record.ts.format('D');
    const hr = record.ts.format('H');
    const i = '0';

    // El resto de columnas vacías (con valores 9999 o similares)
    const emptyColumns = '9999 9999 9999 ?0 9999 ?0 9999 ?0 99 99 9999. 9999. 999 9999';

    const dir = record.dir.toFixed(0).padStart(3, ' ');
    const spd = record.speed.toFixed(1).padStart(4, ' ');

    // Línea final con dirección y velocidad
    const line = `${yr}  ${mo}  ${da}  ${hr} ${i} ${emptyColumns} ${dir}   ${spd} 99999. 999999 999999999 9999 99999. 9999 999`;
    lines.push(line);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `WRPlot_${header.name.replace(/\s+/g, '_')}.txt`);
};

export default generateWRPlotFile;
