/** Formas de `/solicitudes` (backend `SolicitudService`, 2026-10-04). */

export type TipoSolicitud = 'modulo_nuevo' | 'ajuste_modulo' | 'campo_personalizado' | 'otro';
export type EstadoSolicitud =
  | 'recibida'
  | 'en_evaluacion'
  | 'aprobada'
  | 'rechazada'
  | 'en_desarrollo'
  | 'entregada'
  | 'cancelada';
export type AlcanceSolicitud = 'para_todos' | 'exclusiva';

export interface PersonaRef {
  id: number;
  nombre: string;
}

export interface ModuloRef {
  id: number;
  codigo: string;
  nombre: string;
}

export interface EventoSolicitud {
  id: number;
  tipo: 'estado' | 'comentario';
  estadoAnterior: EstadoSolicitud | null;
  estadoNuevo: EstadoSolicitud | null;
  texto: string | null;
  visibleCliente: boolean;
  deGoods: boolean;
  autor: PersonaRef | null;
  creadoEn: string;
}

export interface SolicitudResumen {
  id: number;
  empresaId: number;
  empresaNombre: string;
  tipo: TipoSolicitud;
  modulo: ModuloRef | null;
  titulo: string;
  estado: EstadoSolicitud;
  alcance: AlcanceSolicitud | null;
  costoMensual: number | null;
  asignadaA: PersonaRef | null;
  creadaPor: PersonaRef | null;
  /** `YYYY-MM-DD`: fecha comprometida (exclusivas). */
  fechaCompromiso: string | null;
  /** Cuántas Empresas la piden (esta + las sumadas). */
  interesadas: number;
  agrupadaEn: { id: number; titulo: string } | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface SolicitudDetalle extends SolicitudResumen {
  descripcion: string;
  respuesta: string | null;
  decididaEn: string | null;
  entregadaEn: string | null;
  siguientes: EstadoSolicitud[];
  agrupadas: { id: number; empresaId: number; empresaNombre: string; titulo: string; estado: EstadoSolicitud }[];
  eventos: EventoSolicitud[];
}

export interface ListadoSolicitudes {
  data: SolicitudResumen[];
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
}

export interface ResumenSolicitudes {
  porEstado: Record<EstadoSolicitud, number>;
  abiertas: number;
  sinAsignar: number;
  entregadasMes: number;
  esperaMaximaDias: number;
}

export interface FiltroSolicitudes {
  page?: number;
  pageSize?: number;
  estado?: EstadoSolicitud;
  grupo?: 'abiertas' | 'cerradas';
  tipo?: TipoSolicitud;
  buscar?: string;
  asignadaA?: number;
}

export interface CambioEstadoPayload {
  estado: EstadoSolicitud;
  respuesta?: string;
  alcance?: AlcanceSolicitud;
  costoMensual?: number;
  tipo?: TipoSolicitud;
  moduloId?: number;
  activarModulo?: boolean;
  fechaCompromiso?: string;
}

export const ESTADO_SOLICITUD: Record<EstadoSolicitud, { texto: string; tono: 'neutral' | 'info' | 'warning' | 'success' | 'critical' }> = {
  recibida: { texto: 'Recibida', tono: 'warning' },
  en_evaluacion: { texto: 'En evaluación', tono: 'info' },
  aprobada: { texto: 'Aprobada', tono: 'info' },
  rechazada: { texto: 'No aprobada', tono: 'neutral' },
  en_desarrollo: { texto: 'En desarrollo', tono: 'info' },
  entregada: { texto: 'Entregada', tono: 'success' },
  cancelada: { texto: 'Cancelada', tono: 'neutral' },
};

export const TIPO_SOLICITUD: Record<TipoSolicitud, { texto: string; ayuda: string }> = {
  modulo_nuevo: { texto: 'Módulo nuevo', ayuda: 'Se construye una vez y se activa por Empresa (por plan o como extra).' },
  ajuste_modulo: { texto: 'Ajuste de un módulo', ayuda: 'Un filtro o función: entra para todos o como opción configurable.' },
  campo_personalizado: { texto: 'Campos propios', ayuda: 'Datos extra en una tabla, como campos personalizados de la Empresa.' },
  otro: { texto: 'Otro', ayuda: 'Reclasifícala al evaluar.' },
};

export const ALCANCE_SOLICITUD: Record<AlcanceSolicitud, string> = {
  para_todos: 'Para todos',
  exclusiva: 'Exclusiva',
};
