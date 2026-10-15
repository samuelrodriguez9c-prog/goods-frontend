// Formatos propios de Pedidos y Clientes. Los generales (cop, num, pl, fecha, hace) vienen de products/shared/formato.ts.
import { fecha, hace } from '../../products/shared/formato';

/** `#1042` */
export const pnum = (n: number) => '#' + n;
/** `+57 300 412 8890` */
export const tel = (t: string | null | undefined) => {
  const d = String(t ?? '').replace(/\D/g, '');
  return /^57\d{10}$/.test(d) ? `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : d ? '+' + d : '';
};
/** `9:40 a. m.` */
export const hora = (iso: string) => {
  const d = new Date(iso);
  const m = String(d.getMinutes()).padStart(2, '0'), ap = d.getHours() >= 12 ? 'p. m.' : 'a. m.';
  return `${d.getHours() % 12 || 12}:${m} ${ap}`;
};
/** `8 oct 2026 · 9:40 a. m.` */
export const completa = (iso: string) => fecha(iso) + ' · ' + hora(iso);
/** `hace 12 min` · `hace 3 h` · `ayer` · `hace 6 días` */
export const relativo = (iso: string, hoy: Date) => {
  const h = (hoy.getTime() - new Date(iso).getTime()) / 36e5;
  if (h < 1) return `hace ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 24 && new Date(iso).getDate() === hoy.getDate()) return `hace ${Math.round(h)} h`;
  return hace(iso, hoy);
};
/** Iniciales de cliente: hasta 2 palabras que empiezan con letra. */
export const iniCliente = (n: string) =>
  (n || '?').split(/\s+/).filter((w) => /^[A-Za-zÁÉÍÓÚÑ]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
export const soloDigitos = (s: string) => String(s ?? '').replace(/\D/g, '');
export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
