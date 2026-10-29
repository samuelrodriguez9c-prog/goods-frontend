// Espejo de `Conversacion` y `Mensaje` del backend.

export type EstadoConversacion = 'abierta' | 'cerrada';

/** Solo los campos que usa la UI: el backend manda el `Usuario` completo. */
export interface ChatUsuario {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
}

export interface Conversacion {
  id: number;
  usuarioId: number;
  /** No debería ser `null` (`usuarioId` es NOT NULL), pero se tipa así por si
   * el backend no resuelve la relación. */
  usuario: ChatUsuario | null;
  pedidoId: number | null;
  agenteAsignadoId: number | null;
  agenteAsignado: ChatUsuario | null;
  /** Quién la tenía antes de que un admin la tomara, para ofrecer "Devolver
   * a X". `null` si nunca se tomó o ya se devolvió. */
  agenteAnteriorId: number | null;
  agenteAnterior: ChatUsuario | null;
  estado: EstadoConversacion;
  cerradaEn: string | null;
  creadoEn: string;
  actualizadoEn: string;
  /** Solo en la bandeja: mensajes del cliente sin leer. */
  noLeidos?: number;
  /** Solo en la bandeja: el primer mensaje del cliente. */
  tema?: string | null;
  /** Solo en la bandeja: lo último que se dijo, sin los avisos del sistema. */
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

/** Mensaje citado por un "responder a". El backend resuelve un solo nivel:
 * la UI solo muestra una línea del citado, no la cadena de citas. */
export interface MensajeCitado {
  id: number;
  /** `null` si fuera un mensaje de sistema (la UI no deja responderlos). */
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
  /** Aviso automático del backend (espera, cierre…), no de una persona. Se
   * pinta centrado en gris, sin burbuja ni opción de responder. */
  esSistema: boolean;
  creadoEn: string;
  /** Puede faltar en mensajes viejos o de sistema. */
  adjuntos?: Adjunto[];
}

/** Payload del evento de socket `mensaje:nuevo`: más angosto que `Mensaje`
 * porque el backend no emite la entidad completa. */
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

/** Payload del evento de socket `conversacion:asignada`. */
export interface EventoConversacionAsignada {
  conversacionId: number;
  agenteAsignadoId: number;
}
