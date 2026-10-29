// Formas de `/mis-solicitudes`.

export type TipoSolicitud = 'modulo_nuevo' | 'ajuste_modulo' | 'campo_personalizado' | 'otro';
export type EstadoSolicitud =
  | 'recibida'
  | 'en_evaluacion'
  | 'aprobada'
  | 'rechazada'
  | 'en_desarrollo'
  | 'entregada'
  | 'cancelada';

/** «¿Qué tanto te afecta?»: Poco · Bastante · Urgente. */
export type ImpactoSolicitud = 'bajo' | 'medio' | 'alto';

export const IMPACTO_SOLICITUD: Record<ImpactoSolicitud, string> = {
  bajo: 'Poco',
  medio: 'Bastante',
  alto: 'Urgente',
};

/** Un área del modal (`GET /mis-solicitudes/areas`): un módulo con sus secciones. */
export interface AreaSolicitud {
  moduloId: number;
  codigo: string;
  nombre: string;
  secciones: { clave: string; nombre: string }[];
}

/** Una captura subida a la solicitud; se descarga con el token (blob). */
export interface AdjuntoSolicitud {
  id: number;
  nombre: string;
  tipo: string;
  tamano: number;
  creadoEn: string;
}

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
  /** Parte del área («Inventario y stock»). */
  seccion: { clave: string; nombre: string } | null;
  impacto: ImpactoSolicitud | null;
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
  /** Tiendas que la piden, la propia incluida (las sumadas por staff y los votos del tablero). */
  votos: number;
  /** Si la persona recibe sus avisos. */
  sigo: boolean;
  /** Si está en el tablero «De otras tiendas». */
  publica: boolean;
  cancelable: boolean;
  ultimaRespuestaDeGoods: boolean;
  creadaPor: { id: number; nombre: string } | null;
  creadoEn: string;
  actualizadoEn: string;
  eventos?: EventoSolicitud[];
  /** Solo en el detalle. */
  adjuntos?: AdjuntoSolicitud[];
}

/**
 * Una solicitud del tablero «De otras tiendas» (`/mis-solicitudes/tablero`):
 * sin autor ni conversación, con el título y el texto que revisó Goods.
 */
export interface SolicitudPublica {
  id: number;
  tipo: TipoSolicitud;
  modulo: { id: number; codigo: string; nombre: string } | null;
  titulo: string;
  descripcion: string;
  estado: EstadoSolicitud;
  votos: number;
  /** Si la tienda la votó. */
  voto: boolean;
  /** La tienda ya la pidió: cuenta en `votos` y no se vota (409). */
  esMia: boolean;
  /** La propia solicitud de la tienda, para abrir su conversación. */
  miSolicitudId: number | null;
  sigo: boolean;
  publicadaEn: string | null;
  actualizadoEn: string;
}

export interface CrearSolicitudPayload {
  tipo: TipoSolicitud;
  moduloCodigo?: string;
  /** `clave` de una sección del área; pide `moduloCodigo`. */
  seccion?: string;
  impacto?: ImpactoSolicitud;
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
  dashboard: 'Inicio',
  orders: 'Pedidos',
  products: 'Productos',
  customers: 'Clientes',
  discounts: 'Descuentos',
  messages: 'Mensajes',
  users: 'Usuarios',
  roles: 'Roles y permisos',
  asistente_ia: 'Asistente de IA',
  asistente: 'Asistente de IA',
  tienda: 'Tienda en línea',
  whatsapp: 'WhatsApp',
};
