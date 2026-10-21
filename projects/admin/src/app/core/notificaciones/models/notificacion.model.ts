/** Tipos de `Notificacion` del backend. */
export type TipoNotificacion =
  // Categoría cliente.
  | 'pedido_estado'
  | 'pago_estado'
  | 'stock_bajo'
  // Entró un pedido de la tienda en línea.
  | 'pedido_nuevo'
  | 'mensaje_chat'
  // Categoría staff: `GET /notificaciones` no se los manda a una Empresa,
  // pero se tipan igual por si el backend cambia.
  | 'empresa_registrada'
  | 'empresa_estado_cambio'
  | 'conversacion_solicitada'
  | 'conversacion_sin_asignar'
  | 'conversacion_cerrada'
  | 'plan_por_vencer'
  | 'plan_pago_vencido'
  // Avisa quién quedó a cargo de una conversación.
  | 'conversacion_asignada'
  | 'solicitud_nueva'
  | 'solicitud_actualizada'
  | 'seguridad_reporte'
  | 'alta_mensaje';

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
