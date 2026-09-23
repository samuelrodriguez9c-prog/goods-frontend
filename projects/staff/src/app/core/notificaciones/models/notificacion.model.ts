/**
 * Misma forma que `Notificacion` del backend (`modules/notificacion/`) —
 * campanita real de staff, 2026-09-23 (antes el ícono del topbar de
 * `admin` existía sin lógica, y `staff` ni siquiera lo tenía — ver el
 * comentario viejo de `TopbarComponent`).
 */
export type TipoNotificacion =
  // Categoría cliente (no debería aparecer nunca acá — /notificaciones/staff
  // solo devuelve categoría staff — pero se tipan igual por si el backend
  // alguna vez cambia).
  | 'pedido_estado'
  | 'pago_estado'
  | 'stock_bajo'
  | 'mensaje_chat'
  // Categoría staff.
  | 'empresa_registrada'
  | 'empresa_estado_cambio'
  | 'conversacion_solicitada'
  | 'conversacion_sin_asignar'
  | 'conversacion_cerrada'
  | 'plan_por_vencer'
  | 'plan_pago_vencido'
  // Segunda vuelta, mismo día (2026-09-23): avisa quién quedó a cargo de
  // una conversación — ver ChatService.notificarConversacionAsignada.
  | 'conversacion_asignada';

export interface Notificacion {
  id: number;
  usuarioId: number;
  tipo: TipoNotificacion;
  categoria: 'cliente' | 'staff';
  titulo: string;
  cuerpo: string;
  datos: Record<string, unknown> | null;
  leidaEn: string | null;
  creadoEn: string;
}
