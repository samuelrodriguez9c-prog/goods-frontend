/** Formatos del módulo Productos (es-CO, igual que el prototipo). */
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const aFecha = (d: string | Date) => (typeof d === 'string' && d.length === 10 ? new Date(d + 'T09:00:00') : new Date(d));

/** `$1.234.567` · `−$500` */
export const cop = (n: number) => (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('es-CO');
/** `1.234` */
export const num = (n: number) => Math.round(n).toLocaleString('es-CO');
/** `8 oct 2026` */
export const fecha = (d: string | Date) => {
  const x = aFecha(d);
  return `${x.getDate()} ${MES[x.getMonth()]} ${x.getFullYear()}`;
};
/** `8 oct` */
export const fechaCorta = (d: string | Date) => {
  const x = aFecha(d);
  return `${x.getDate()} ${MES[x.getMonth()]}`;
};
export const dias = (d: string | Date, hoy = new Date()) => Math.max(0, Math.floor((hoy.getTime() - aFecha(d).getTime()) / 864e5));
/** `hoy` · `ayer` · `hace 6 días` */
export const hace = (d: string | Date, hoy = new Date()) => {
  const n = dias(d, hoy);
  return n === 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`;
};
/** `C-0013` */
export const codigoCompra = (id: number) => 'C-' + String(id).padStart(4, '0');
/** `3 productos` / `1 producto` */
export const pl = (n: number, uno: string, varios: string) => `${num(n)} ${n === 1 ? uno : varios}`;
export const pct = (x: number) => Math.round(x * 100) + ' %';
export const slug = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
export const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
/** Normaliza para buscar sin tildes ni mayúsculas. */
export const norm = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Margen (precio − costo) / precio. `null` si no hay costo. */
export const margen = (precio: number, costo: number | null) => (costo == null || !precio ? null : (precio - costo) / precio);
