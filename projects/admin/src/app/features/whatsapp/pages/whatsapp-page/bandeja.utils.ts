import { Conversacion, Mensaje, identificacion } from '../../../../core/whatsapp/whatsapp.model';
import { FiltroBandeja } from '../../shared/whatsapp-modulo.store';

/** Formatos y reglas de la Bandeja (rediseño 2026-10-13), compartidos por sus componentes. */

export const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

export type EstadoVentana = 'abierta' | 'vence' | 'cerrada';

/** ms que le quedan a la ventana de 24 h (0 = cerrada). */
export function restante(c: Conversacion, ahora: number): number {
  if (!c.ventanaAbierta || !c.ventanaHasta) return 0;
  return Math.max(0, new Date(c.ventanaHasta).getTime() - ahora);
}

/** Cerrada, por vencer (menos de 3 h) o abierta. */
export function estadoVentana(c: Conversacion, ahora: number): EstadoVentana {
  const r = restante(c, ahora);
  return !r ? 'cerrada' : r < 3 * HORA_MS ? 'vence' : 'abierta';
}

/** "21 h 07 min" / "45 min". */
export function ventanaFmt(ms: number): string {
  const m = Math.floor(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
}

/** Fracción de la ventana que queda (para el anillo y la barra). */
export function fraccionVentana(c: Conversacion, ahora: number): number {
  return Math.min(1, restante(c, ahora) / DIA_MS);
}

export function nombreChat(c: Conversacion): string {
  return c.contacto.nombre?.trim() || identificacion(c.contacto);
}

export function primerNombre(c: Conversacion | null): string {
  return c?.contacto.nombre?.trim().split(/\s+/)[0] ?? '';
}

/** "MF" (dos iniciales) o "#" si no tiene nombre. */
export function iniciales(c: Conversacion): string {
  const n = c.contacto.nombre?.trim();
  return n
    ? n
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
    : '#';
}

/** Avatar: ámbar si es un número sin nombre (nuevo), turquesa claro si no. */
export function claseAvatar(c: Conversacion): string {
  return c.contacto.nombre?.trim() ? 'bg-[#e0f7f5] text-[#00605b]' : 'bg-[#fff4d6] text-[#8a5a00]';
}

/** El asistente de IA está pausado en este chat. */
export function pausado(c: Conversacion, ahora: number): boolean {
  return !!c.asistentePausadoHasta && new Date(c.asistentePausadoHasta).getTime() > ahora;
}

/**
 * La IA atiende el chat: asistente prendido, sin pausa, sin habérselo pasado
 * al equipo y sin que una persona haya sido la última en escribirle.
 */
export function atiendeIa(c: Conversacion, asistenteActivo: boolean, ahora: number): boolean {
  if (!asistenteActivo || pausado(c, ahora) || c.pasadoAEquipo) return false;
  return c.ultimoMensajeDireccion === 'entrante' || c.ultimoMensajeAutor === 'bot';
}

/** Identifica el último mensaje del cliente en un chat: la sugerencia de la IA vale para ese mensaje. */
export function claveSugerencia(c: Conversacion): string {
  return `${c.id}|${c.ultimoMensajeEn ?? ''}`;
}

/** Filtros de la lista (los mismos que las métricas de la cabecera). */
export function pasaFiltro(c: Conversacion, f: FiltroBandeja, asistenteActivo: boolean, ahora: number): boolean {
  switch (f) {
    case 'sin':
      return c.ultimoMensajeDireccion === 'entrante';
    case 'vence':
      return estadoVentana(c, ahora) === 'vence';
    case 'ia':
      return atiendeIa(c, asistenteActivo, ahora);
    default:
      return true;
  }
}

export function inicioDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "14:05" */
export function hhmm(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "14:05" hoy, "ayer", "lun" esta semana, "3/10" antes. */
export function cuandoLista(iso: string | null, ahora: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  const dias = Math.floor((inicioDia(new Date(ahora)) - inicioDia(d)) / DIA_MS);
  if (dias <= 0) return hhmm(d);
  if (dias === 1) return 'ayer';
  if (dias < 7) return DIAS[d.getDay()];
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** Separador de día dentro del chat: "Hoy", "Ayer", "lunes, 5 de octubre". */
export function diaDe(iso: string): string {
  const d = new Date(iso);
  const dias = Math.floor((inicioDia(new Date()) - inicioDia(d)) / DIA_MS);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "28 sept" (o "hoy"). */
export function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (inicioDia(d) === inicioDia(new Date())) return 'hoy';
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** "marzo 2025" */
export function mesAnio(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
}

/** "$1,2 M", "$177 mil", "$9.500". */
export function copCorto(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
  if (n >= 10_000) return `$${Math.round(n / 1000).toLocaleString('es-CO')} mil`;
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/** "24 disponibles" / "Agotado · llega el jueves" / "Sin control de stock". */
export function stockTexto(p: { stock: number | null; reposicion?: string | null }): string {
  if (p.stock === null) return 'Sin control de stock';
  return p.stock ? `${p.stock} disponibles` : `Agotado${p.reposicion ? ' · ' + p.reposicion : ''}`;
}

/**
 * Prefijo del último mensaje en la lista, según de dónde salió: "IA: " (el
 * asistente), "Auto: " (palabra clave, bienvenida, fuera de horario,
 * promociones), "Campaña: " o "Tú: " (el equipo o el celular).
 */
export function prefijoUltimo(c: Conversacion): string {
  if (c.ultimoMensajeDireccion !== 'saliente') return '';
  if (c.ultimoMensajeOrigen === 'asistente_ia') return 'IA: ';
  if (c.ultimoMensajeOrigen === 'campana') return 'Campaña: ';
  return c.ultimoMensajeAutor === 'bot' ? 'Auto: ' : 'Tú: ';
}

/** Un elemento de la conversación: mensaje, aviso de sistema ("Pedido #… creado") o marca de traspaso. */
export type ItemChat =
  | { k: 'msg'; id: string; m: Mensaje; dia: string | null }
  | { k: 'sistema'; id: string; texto: string; dia: string | null }
  | { k: 'marca'; id: string; texto: string; hora: string; dia: string | null };

/** Aviso local (no viene del backend) que se intercala por hora en el chat. */
export interface MarcaLocal {
  id: string;
  k: 'sistema' | 'marca';
  texto: string;
  en: string;
}

export type BorradorPedido = Record<number, number>;
