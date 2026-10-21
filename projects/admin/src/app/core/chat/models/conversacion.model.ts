// Espejo de `Conversacion` y `Mensaje` del backend; la respuesta es la misma que recibe `staff`.

export type EstadoConversacion = 'abierta' | 'cerrada';

export interface ChatUsuario {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
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
}

/** Payload del evento de socket `mensaje:nuevo`: más angosto que `Mensaje`. */
export interface EventoMensajeNuevo {
  conversacionId: number;
  autorId: number | null;
  cuerpo: string;
  creadoEn: string;
  respondeAId: number | null;
  esSistema: boolean;
}

/** Payload del evento de socket `conversacion:asignada`. */
export interface EventoConversacionAsignada {
  conversacionId: number;
  agenteAsignadoId: number;
}
