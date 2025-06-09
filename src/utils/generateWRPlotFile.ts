import type dayjs from "dayjs";
import type { WRPlotHeader } from "../types/WindRecord";

interface WRPlotRecord {
  ts: dayjs.Dayjs;
  dir: number;
  speed: number;
}


function formatWRPlotLine(record: WRPlotRecord): string {
  const y = record.ts.year() % 100;
  const mo = record.ts.month() + 1;
  const d = record.ts.date();
  const h = record.ts.hour();

  const dir = Math.round(record.dir).toString().padStart(3, ' ');
  const speed = record.speed.toFixed(1).toString().padStart(4, ' ');

  return (
    ` ${y.toString().padStart(2, ' ')} ` +
    `${mo.toString().padStart(2, ' ')} ` +
    `${d.toString().padStart(2, ' ')} ` +
    `${h.toString().padStart(2, ' ')} ` +
    `0 9999 9999 9999 ?0 9999 ?0 9999 ?0 99 99 ` +
    `9999. 9999. 999 9999 ` +
    `${dir}   ${speed} ` +
    `99999. 999999 999999999 9999 99999. 9999 999`
  );
}

function generateWRPlotFile(data: WRPlotRecord[], header: WRPlotHeader): void {
  const line1 = `~    ${header.id.toString().padStart(1)} ${header.name.padEnd(24)}${header.countryCode.padStart(3)} ${header.timezone.toString().padStart(3)}  ${header.latitude}  ${header.longitude}  ${header.altitude.toString().padStart(4)}`;
  const line2 = `~YR MO DA HR I    1    2       3       4       5  6  7     8     9  10   11  12    13     14     15        16   17     18   19  20      21`;

  const headerLines = [line1, line2];

  const body = data.map(formatWRPlotLine);

  const content = [...headerLines, ...body].join("\r\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "wrplot_data.txt";
  a.click();

  URL.revokeObjectURL(url);
}

export default generateWRPlotFile;
