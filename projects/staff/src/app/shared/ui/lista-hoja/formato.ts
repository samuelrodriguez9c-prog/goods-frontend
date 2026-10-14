/** Formatos compartidos por los módulos con lista + hoja (2026-10-05). */

export const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIA_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const fecha = (iso: string) => new Date(iso.length > 10 ? iso : iso + 'T12:00:00');
const medianoche = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** `$1.234.567` · `−$19.000` (nunca `$-0`) */
export const plata = (n: number) => {
  const r = Math.round(n);
  return (r < 0 ? '−' : '') + '$' + Math.abs(r).toLocaleString('es-CO');
};

/** `$89k` · `$1,24 M` */
export const corto = (n: number) =>
  (n < 0 ? '−' : '') + '$' + (Math.abs(n) >= 1_000_000 ? (Math.abs(n) / 1_000_000).toFixed(2).replace('.', ',') + ' M' : Math.round(Math.abs(n) / 1000) + 'k');

/** `+$40.000` / `−$19.000` */
export const signo = (n: number) => (n >= 0 ? '+' : '−') + plata(Math.abs(n));

export const pct = (x: number, dec = 1) => (x * 100).toFixed(dec).replace('.', ',') + '%';

/** `5 oct` */
export const fmt = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = fecha(iso);
  return `${d.getDate()} ${MES_CORTO[d.getMonth()]}`;
};

/** `5 oct 2026` */
export const fmtY = (iso: string | null | undefined) => (iso ? `${fmt(iso)} ${fecha(iso).getFullYear()}` : '—');

/** Días desde hoy (positivo = futuro, negativo = pasado). */
export const dias = (iso: string | null | undefined) =>
  iso ? Math.round((medianoche(fecha(iso)) - medianoche(new Date())) / 86_400_000) : 0;

/** `hoy` · `ayer` · `hace 6 días` */
export const hace = (iso: string) => {
  const d = -dias(iso);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
};

/** `Hoy 15:30` · `Mañana 10:00` · `jue 9 oct 11:00` */
export const cuando = (iso: string) => {
  const d = dias(iso);
  const f = fecha(iso);
  const hh = `${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`;
  return `${d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `${DIA_CORTO[f.getDay()]} ${fmt(iso)}`} ${hh}`;
};

/** `1 pago` / `3 pagos` */
export const pl = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

/** Trazo de 84×28 para las líneas de las métricas (mismo de la cabecera v2). */
export const linea = (serie: number[]) => {
  const mx = Math.max(...serie, 1);
  return serie.map((v, i) => (i ? 'L' : 'M') + (i * 84) / Math.max(1, serie.length - 1) + ' ' + (26 - (v / mx) * 22)).join(' ');
};
