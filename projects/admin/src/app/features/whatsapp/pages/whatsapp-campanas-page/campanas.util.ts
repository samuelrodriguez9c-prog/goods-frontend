import { Campana, EstadoCampana } from '../../../../core/whatsapp/whatsapp.model';
import { COSTO_PLANTILLA, cop } from '../../shared/secciones';

/** Estado de una campaña: texto, punto y tinta del texto. */
export const ESTADO_CAMPANA: Record<EstadoCampana, { texto: string; punto: string; tinta: string }> = {
  programada: { texto: 'Programada', punto: '#3b82f6', tinta: 'text-[#1d4ed8]' },
  enviando: { texto: 'Enviando', punto: '#00a39b', tinta: 'text-[#00605b]' },
  enviada: { texto: 'Enviada', punto: '#c4c4c4', tinta: 'text-[#374151]' },
  cancelada: { texto: 'Cancelada', punto: '#d4d4d4', tinta: 'text-[#6b7280]' },
  fallida: { texto: 'No se envió', punto: '#ef4444', tinta: 'text-[#b42318]' },
};

/** Costo aproximado por mensaje de promoción (COP). */
export const COSTO_PROMO = COSTO_PLANTILLA['MARKETING'];

export const esProxima = (c: Campana) => c.estado === 'programada' || c.estado === 'enviando';

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** "9:00" */
export const hora = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

/** "sáb 3 oct" */
export function fechaCorta(iso: string): string {
  const d = new Date(iso);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** Para la tarjeta-calendario de una programada: "vie" · 16 · "oct" · "9:00" · "3 días". */
export function calendario(iso: string) {
  const d = new Date(iso);
  return { dia: DIAS[d.getDay()], num: d.getDate(), mes: MESES[d.getMonth()], hora: hora(d), falta: falta(d) };
}

function falta(d: Date): string {
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return 'unos minutos';
  const min = Math.round(ms / 6e4);
  if (min < 60) return min <= 1 ? '1 minuto' : `${min} minutos`;
  const h = Math.round(ms / 36e5);
  if (h < 24) return h <= 1 ? '1 hora' : `${h} horas`;
  const dias = Math.round(h / 24);
  return dias === 1 ? '1 día' : `${dias} días`;
}

/** Clientes a los que les llega (o les llegaría, si aún no sale: el alcance de hoy). */
export function clientesDe(c: Campana, alcance: number): number {
  return c.resumen.enviados || c.resumen.destinatarios || (c.estado === 'programada' ? alcance : 0);
}

/** "≈ $7.696 COP estimado" */
export function costoCampana(c: Campana, alcance: number): string {
  return `≈ ${cop(clientesDe(c, alcance) * COSTO_PROMO)} COP${c.estado === 'programada' ? ' estimado' : ''}`;
}

/** Valor para un `<input type="datetime-local">` en hora local. */
export function aLocal(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
