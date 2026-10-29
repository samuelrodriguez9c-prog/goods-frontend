// Espejo de `Conversacion` y `Mensaje` del backend; la respuesta es la misma que recibe `staff`.

export type EstadoConversacion = 'abierta' | 'cerrada';

export interface ChatUsuario {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  /** URL completa de la foto; sin foto, iniciales. */
  imagenPerfil?: string | null;
}

export interface Conversacion {
  id: number;
  usuarioId: number;
  usuario: ChatUsuario | null;
  pedidoId: number | null;
  agenteAsignadoId: number | null;
  agenteAsignado: ChatUsuario | null;
  estado: EstadoConversacion;
  cerradaEn: string | null;
  creadoEn: string;
  actualizadoEn: string;
  /** Solo en las listas (`/mias` y la bandeja): mensajes de la otra parte sin leer. */
  noLeidos?: number;
  /** Solo en las listas: el primer mensaje del cliente. */
  tema?: string | null;
  /** Solo en las listas: lo último que se dijo, sin los avisos del sistema. */
  ultimoMensaje?: UltimoMensaje | null;
}

export interface UltimoMensaje {
  id: number;
  cuerpo: string;
  autorId: number | null;
  creadoEn: string;
  leidoEn: string | null;
  /** Cuántas imágenes trae («📷 Foto» cuando no hay texto). */
  adjuntos: number;
}

/** Imagen del chat. Es privada: se descarga con la sesión (`ChatService.imagen`). */
export interface Adjunto {
  id: number;
  nombre: string;
  tipo: string;
  tamano: number;
}

/** Mensaje citado por un «responder a». El backend resuelve un solo nivel de cita. */
export interface MensajeCitado {
  id: number;
  autorId: number | null;
  autor: ChatUsuario | null;
  cuerpo: string;
  creadoEn: string;
}

export interface Mensaje {
  id: number;
  conversacionId: number;
  /** `null` en los mensajes de sistema: no tienen autor humano. */
  autorId: number | null;
  autor: ChatUsuario | null;
  cuerpo: string;
  leidoEn: string | null;
  respondeAId: number | null;
  respondeA: MensajeCitado | null;
  /** Aviso automático del backend (espera, cierre…), no de una persona. */
  esSistema: boolean;
  creadoEn: string;
  /** Puede faltar en mensajes viejos o de sistema. */
  adjuntos?: Adjunto[];
}

/** Payload del evento de socket `mensaje:nuevo`: más angosto que `Mensaje`. */
export interface EventoMensajeNuevo {
  id: number;
  conversacionId: number;
  autorId: number | null;
  cuerpo: string;
  creadoEn: string;
  respondeAId: number | null;
  esSistema: boolean;
  adjuntos?: Adjunto[];
}

/** Payload de `mensajes:leidos`: `lado` es quien leyó. */
export interface EventoMensajesLeidos {
  conversacionId: number;
  lado: 'cliente' | 'soporte';
  leidoEn: string;
}

/** Una cara del equipo de soporte: nombre de pila y foto. */
export interface CaraSoporte {
  id: number;
  nombres: string;
  imagenPerfil: string | null;
  enLinea: boolean;
}

/** `GET /chat/soporte/estado`: lo que muestra la cabecera del chat. */
export interface EstadoSoporte {
  enLinea: boolean;
  agentesEnLinea: number;
  equipo: CaraSoporte[];
  dentroDeHorario: boolean;
  /** `dias`: 0 = domingo. `texto`: «L a S, 7 a. m. – 9 p. m.» */
  horario: { dias: number[]; desde: string; hasta: string; texto: string };
  /** Mediana de los últimos 30 días; `null` con menos de 3 casos. */
  tiempoRespuestaMin: number | null;
}

/** Payload del evento de socket `conversacion:asignada`. */
export interface EventoConversacionAsignada {
  conversacionId: number;
  agenteAsignadoId: number;
}
