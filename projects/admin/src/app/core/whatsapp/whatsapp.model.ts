/** Espejos de `negocio/whatsapp` del backend (Fase 1 de PROPUESTA_WHATSAPP.md). */
export interface EstadoConexion {
  disponible: boolean;
  registroIntegrado: { appId: string; configId: string; graphVersion: string } | null;
  cuenta: {
    numero: string;
    nombreVisible: string | null;
    estado: 'conectada' | 'desconectada' | 'error';
    calidad: string | null;
    modo: 'registro_integrado' | 'manual';
    conectadaEn: string;
    ultimoError: string | null;
  } | null;
}

export interface Conversacion {
  id: number;
  /** `waId` puede faltar: un cliente con nombre de usuario de WhatsApp a veces llega sin número. */
  contacto: { nombre: string | null; waId: string | null; usuario: string | null; aceptaPromociones: boolean };
  /** El asistente de IA no responde en este chat hasta esta fecha (null = puede responder). */
  asistentePausadoHasta: string | null;
  ultimoMensajeEn: string | null;
  ultimoMensajeTexto: string | null;
  ultimoMensajeDireccion: 'entrante' | 'saliente' | null;
  noLeidos: number;
  ventanaHasta: string | null;
  ventanaAbierta: boolean;
}

export interface ListaConversaciones {
  data: Conversacion[];
  total: number;
  page: number;
  totalPaginas: number;
  conNoLeidos: number;
}

export type EstadoMensaje = 'recibido' | 'pendiente' | 'enviado' | 'entregado' | 'leido' | 'fallido';

export type OrigenMensaje = 'bienvenida' | 'fuera_horario' | 'palabra_clave' | 'asistente_ia' | 'promociones' | 'campana';

export interface Mensaje {
  id: number;
  direccion: 'entrante' | 'saliente';
  autor: 'cliente' | 'equipo' | 'celular' | 'bot';
  usuarioId: number | null;
  tipo: string;
  texto: string | null;
  /** `descargable`: el archivo se puede pedir a Meta (`GET /whatsapp/mensajes/:id/adjunto`). */
  media: { mime: string | null; nombre: string | null; descargable: boolean } | null;
  /** Si se mandó con una plantilla, su nombre. */
  plantilla: { nombre: string } | null;
  /** Qué lo generó, si no lo escribió una persona: respuesta automática, asistente de IA, alta/baja, campaña. */
  origen: OrigenMensaje | null;
  estado: EstadoMensaje;
  error: string | null;
  enviadoEn: string;
}

// ── Fase 3: plantillas, respuestas automáticas y rápidas ──

export type EstadoPlantilla = 'pendiente' | 'aprobada' | 'rechazada' | 'pausada' | 'deshabilitada';

export interface Plantilla {
  id: number;
  nombre: string;
  idioma: string;
  categoria: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  cuerpo: string;
  ejemplos: string[];
  estado: EstadoPlantilla;
  motivoRechazo: string | null;
  actualizadoEn: string;
}

export interface NuevaPlantilla {
  nombre: string;
  categoria: 'UTILITY' | 'MARKETING';
  idioma: string;
  cuerpo: string;
  ejemplos: string[];
}

export type HorarioSemanal = Record<string, { desde: string; hasta: string } | null>;

export interface Automatizacion<C> {
  id: number;
  activa: boolean;
  config: C;
}

export interface RespuestaRapida {
  id: number;
  atajo: string;
  texto: string;
}

export interface Automatizaciones {
  asistente: {
    config: Automatizacion<{ instrucciones: string }> | null;
    /** Goods tiene configurada la IA; si no, no se puede activar. */
    disponible: boolean;
    respuestasUltimas24h: number;
    limiteDiario: number;
  };
  bienvenida: Automatizacion<{ texto: string }> | null;
  fueraHorario: Automatizacion<{ texto: string; zonaHoraria: string; horario: HorarioSemanal }> | null;
  palabrasClave: Automatizacion<{ palabras: string[]; texto: string }>[];
  respuestasRapidas: RespuestaRapida[];
  enlaceTienda: string | null;
}

// ── Campañas ──

export type EstadoCampana = 'programada' | 'enviando' | 'enviada' | 'cancelada' | 'fallida';

export interface VariableCampana {
  /** `nombre`: el primer nombre de cada cliente (`valor` si no tiene); `texto`: igual para todos. */
  tipo: 'nombre' | 'texto';
  valor: string;
}

export interface Campana {
  id: number;
  nombre: string;
  plantilla: string;
  variables: VariableCampana[];
  estado: EstadoCampana;
  programadaPara: string;
  enviadaEn: string | null;
  motivo: string | null;
  creadoEn: string;
  resumen: { destinatarios: number; omitidos: number; enviados: number; entregados: number; leidos: number; fallidos: number };
}

export interface AudienciaCampanas {
  /** Clientes que aceptaron recibir promociones. */
  aceptan: number;
  /** De esos, cuántos recibieron otra campaña hace poco (se omiten). */
  recientes: number;
  alcance: number;
  diasEntreCampanas: number;
}

/** Pie que Goods les pone a las plantillas de promoción (igual que el backend). */
export function piePromociones(idioma: string): string {
  return idioma.startsWith('en') ? 'Reply STOP to unsubscribe' : 'Responde BAJA para no recibir más promociones';
}

/** Cuántas variables `{{n}}` lleva el cuerpo de una plantilla. */
export function variablesDe(cuerpo: string): number {
  const nums = [...cuerpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

/** El cuerpo con las variables reemplazadas (las vacías quedan como {{n}}). */
export function armarPlantilla(cuerpo: string, valores: string[]): string {
  return cuerpo.replace(/\{\{(\d+)\}\}/g, (todo, n: string) => valores[Number(n) - 1]?.trim() || todo);
}

/** "+57 311 555 0000" a partir de los dígitos de WhatsApp. */
/** Cómo mostrar quién es el cliente debajo de su nombre: número, o @usuario si no compartió el número. */
export function identificacion(c: { waId: string | null; usuario: string | null }): string {
  if (c.waId) return formatearNumero(c.waId);
  return c.usuario ? `@${c.usuario}` : 'Número oculto';
}

export function formatearNumero(waId: string): string {
  if (/^57\d{10}$/.test(waId)) return `+57 ${waId.slice(2, 5)} ${waId.slice(5, 8)} ${waId.slice(8)}`;
  if (/^1\d{10}$/.test(waId)) return `+1 ${waId.slice(1, 4)} ${waId.slice(4, 7)} ${waId.slice(7)}`;
  return `+${waId}`;
}
