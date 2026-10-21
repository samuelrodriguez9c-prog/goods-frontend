/** Tipos de `Notificacion` del backend. */
export type TipoNotificacion =
  // Categoría cliente: /notificaciones/staff no los devuelve, pero se tipan
  // por si el backend cambia.
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
  // Avisa quién quedó a cargo de una conversación.
  | 'conversacion_asignada'
  // Solicitudes de personalización.
  | 'solicitud_nueva'
  | 'solicitud_actualizada'
  | 'seguridad_reporte'
  | 'alta_mensaje';

/** Espejo de `Notificacion` del backend. */
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
