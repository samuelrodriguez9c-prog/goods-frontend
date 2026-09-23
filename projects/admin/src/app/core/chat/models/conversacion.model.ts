// projects/admin/src/app/core/chat/models/conversacion.model.ts
//
// Espejo de `staff/core/chat/models/conversacion.model.ts` — mismo shape
// de `Conversacion`/`Mensaje` del backend (`modules/chat/entities/`),
// reusado tal cual del lado del cliente (tenant) porque la respuesta de
// la API es la misma para ambos roles; lo único que cambia es qué
// endpoints puede pegar cada uno (ver `chat.service.ts`).

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

/** Ver el mismo comentario en la versión de `staff`. */
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
  /** `null` para un mensaje de sistema (`esSistema`) — ver el mismo
   * comentario en la versión de `staff`. */
  autorId: number | null;
  autor: ChatUsuario | null;
  cuerpo: string;
  leidoEn: string | null;
  respondeAId: number | null;
  respondeA: MensajeCitado | null;
  /** Ver el mismo comentario en la versión de `staff`. */
  esSistema: boolean;
  creadoEn: string;
}

/** Payload de los eventos de socket `mensaje:nuevo`/`conversacion:asignada`
 * — ver el mismo comentario en la versión de `staff`. */
export interface EventoMensajeNuevo {
  conversacionId: number;
  autorId: number | null;
  cuerpo: string;
  creadoEn: string;
  respondeAId: number | null;
  esSistema: boolean;
}

export interface EventoConversacionAsignada {
  conversacionId: number;
  agenteAsignadoId: number;
}
