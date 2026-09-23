// projects/staff/src/app/core/chat/models/conversacion.model.ts
//
// Espejo de `Conversacion`/`Mensaje` del backend (`modules/chat/entities/`).
// `ChatUsuario` es DELIBERADAMENTE angosto — el backend embebe la entidad
// `Usuario` completa vía `relations: { usuario: true, agenteAsignado: true }`
// (mismo patrón que ya usa `PedidoService.findAll` con `relations: {
// usuario: true }`), pero acá solo tipamos los campos que esta pantalla
// realmente usa. El resto de columnas siguen llegando por la red (no hay
// una capa de DTO/mapeo en el backend para esto, igual que en Pedidos) pero
// TypeScript las ignora — no hace falta declararlas para no usarlas.

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
  /** `null` solo si el backend no pudo resolver la relación (no debería
   * pasar en la práctica: `usuarioId` es NOT NULL) — se tipa opcional para
   * no asumir de más sobre una respuesta ajena. */
  usuario: ChatUsuario | null;
  pedidoId: number | null;
  agenteAsignadoId: number | null;
  agenteAsignado: ChatUsuario | null;
  /** Tercera vuelta (2026-09-23): quién tenía la conversación asignada
   * justo antes de que un admin/admin_goods la tomara — solo para
   * ofrecer el botón "Devolver a X" (ver `ChatService.reasignar` en el
   * backend). `null` si nunca se tomó, o si ya se devolvió. */
  agenteAnteriorId: number | null;
  agenteAnterior: ChatUsuario | null;
  estado: EstadoConversacion;
  cerradaEn: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

/** El mensaje citado por un "responder a" — un `Mensaje` sin SU PROPIO
 * `respondeA` (el backend solo resuelve un nivel de la relación,
 * `relations: { respondeA: { autor: true } }` en `ChatService.
 * listarMensajes` — no hace falta más: la UI solo muestra una línea de
 * preview del mensaje citado, no toda su cadena de citas). */
export interface MensajeCitado {
  id: number;
  /** `null` si se llegara a citar un mensaje de sistema — hoy la UI no
   * ofrece el botón de "responder" sobre uno, pero se tipa igual de
   * ancho que `Mensaje.autorId` para no mentirle a TypeScript. */
  autorId: number | null;
  autor: ChatUsuario | null;
  cuerpo: string;
  creadoEn: string;
}

export interface Mensaje {
  id: number;
  conversacionId: number;
  /** `null` para un mensaje de sistema (`esSistema`) — ver la migración
   * `AgregarMensajesDeSistema` (2026-09-23): esos no tienen autor humano. */
  autorId: number | null;
  autor: ChatUsuario | null;
  cuerpo: string;
  leidoEn: string | null;
  /** Ver la migración `AgregarRespondeAIdAMensajes` (2026-09-23) — `null`
   * si este mensaje no responde a ninguno en particular. */
  respondeAId: number | null;
  respondeA: MensajeCitado | null;
  /** Mensaje predeterminado mandado por el backend (aviso de espera,
   * aviso de cierre, etc. — ver `MENSAJES_SISTEMA` del backend), no por
   * una persona. Se pinta distinto: centrado/gris, sin burbuja, sin
   * opción de "responder". */
  esSistema: boolean;
  creadoEn: string;
}

/** Payload de los eventos de socket `mensaje:nuevo`/`conversacion:asignada`
 * (ver `realtime.constants.ts` del backend) — más angosto que `Mensaje`
 * porque el gateway emite el payload armado a mano en
 * `ChatService.enviarMensaje`, no la entidad completa. */
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
