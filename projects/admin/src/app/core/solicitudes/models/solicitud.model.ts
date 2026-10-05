/** Formas de `/mis-solicitudes` (backend `SolicitudService`, 2026-10-04). */

export type TipoSolicitud = 'modulo_nuevo' | 'ajuste_modulo' | 'campo_personalizado' | 'otro';
export type EstadoSolicitud =
  | 'recibida'
  | 'en_evaluacion'
  | 'aprobada'
  | 'rechazada'
  | 'en_desarrollo'
  | 'entregada'
  | 'cancelada';

export interface EventoSolicitud {
  id: number;
  tipo: 'estado' | 'comentario';
  estadoAnterior: EstadoSolicitud | null;
  estadoNuevo: EstadoSolicitud | null;
  texto: string | null;
  deGoods: boolean;
  autor: { id: number; nombre: string } | null;
  creadoEn: string;
}

export interface Solicitud {
  id: number;
  tipo: TipoSolicitud;
  modulo: { id: number; codigo: string; nombre: string } | null;
  titulo: string;
  descripcion: string;
  estado: EstadoSolicitud;
  alcance: 'para_todos' | 'exclusiva' | null;
  costoMensual: number | null;
  respuesta: string | null;
  /** `YYYY-MM-DD`: fecha de entrega comprometida (mejoras exclusivas). */
  fechaCompromiso: string | null;
  /** Cuántos otros negocios pidieron lo mismo. */
  otrosNegocios: number;
  cancelable: boolean;
  ultimaRespuestaDeGoods: boolean;
  creadaPor: { id: number; nombre: string } | null;
  creadoEn: string;
  actualizadoEn: string;
  eventos?: EventoSolicitud[];
}

export interface CrearSolicitudPayload {
  tipo: TipoSolicitud;
  moduloCodigo?: string;
  titulo: string;
  descripcion: string;
}

export const ESTADO_SOLICITUD: Record<EstadoSolicitud, { texto: string; tono: 'neutral' | 'info' | 'warning' | 'success' | 'critical'; explica: string }> = {
  recibida: { texto: 'Recibida', tono: 'warning', explica: 'El equipo de Goods la va a revisar pronto.' },
  en_evaluacion: { texto: 'En evaluación', tono: 'info', explica: 'Alguien de Goods la está revisando.' },
  aprobada: { texto: 'Aprobada', tono: 'info', explica: 'Se va a hacer. Te avisamos cuando arranque.' },
  rechazada: { texto: 'No aprobada', tono: 'neutral', explica: 'Por ahora no se va a hacer: mira la respuesta.' },
  en_desarrollo: { texto: 'En desarrollo', tono: 'info', explica: 'Se está construyendo.' },
  entregada: { texto: 'Entregada', tono: 'success', explica: 'Ya está disponible.' },
  cancelada: { texto: 'Cancelada', tono: 'neutral', explica: 'Se cerró sin hacerse.' },
};

/** Los tipos, explicados para el cliente (lo que ve al pedir). */
export const TIPOS_SOLICITUD: { valor: TipoSolicitud; texto: string; ejemplo: string }[] = [
  { valor: 'ajuste_modulo', texto: 'Mejorar algo que ya uso', ejemplo: 'Ej.: un filtro nuevo en Pedidos, otra columna, una función extra.' },
  { valor: 'campo_personalizado', texto: 'Guardar datos propios', ejemplo: 'Ej.: “talla” y “color” en mis productos, o el NIT de mis clientes.' },
  { valor: 'modulo_nuevo', texto: 'Una sección nueva', ejemplo: 'Ej.: reservas, citas, domicilios, fidelización.' },
  { valor: 'otro', texto: 'Otra cosa', ejemplo: 'Cuéntanos y lo revisamos.' },
];

/** Nombres de los módulos del plan (códigos de `modulosDisponibles`). */
export const NOMBRE_MODULO: Record<string, string> = {
  dashboard: 'Dashboard',
  orders: 'Pedidos',
  products: 'Productos',
  customers: 'Clientes',
  discounts: 'Descuentos',
  messages: 'Mensajes',
  users: 'Usuarios',
  roles: 'Roles y permisos',
  asistente_ia: 'Asistente de IA',
};
