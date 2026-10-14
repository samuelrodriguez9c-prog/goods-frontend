import { CanalPedido, EstadoPagoPedido, EstadoPedido, TRANSICIONES_PEDIDO } from '../../../core/pedido/models/pedido.model';

/**
 * Textos y tonos de Pedidos para la UI (los colores finales los define el
 * handoff; los tonos siguen la tabla de Productos v5: neutro, aviso,
 * info, éxito, error).
 */
export type Tono = 'neutro' | 'aviso' | 'info' | 'exito' | 'error';

export const ESTADO_PEDIDO: Record<EstadoPedido, { texto: string; tono: Tono }> = {
  pendiente: { texto: 'Por confirmar', tono: 'aviso' },
  confirmado: { texto: 'Por enviar', tono: 'info' },
  enviado: { texto: 'Enviado', tono: 'info' },
  entregado: { texto: 'Entregado', tono: 'exito' },
  cancelado: { texto: 'Cancelado', tono: 'error' },
  devuelto: { texto: 'Devuelto', tono: 'neutro' },
};

export const ESTADO_PAGO: Record<EstadoPagoPedido, { texto: string; tono: Tono }> = {
  pendiente: { texto: 'Pago pendiente', tono: 'aviso' },
  pagado: { texto: 'Pagado', tono: 'exito' },
  reembolsado: { texto: 'Reembolsado', tono: 'neutro' },
};

export const CANAL_PEDIDO: Record<CanalPedido, { texto: string; icono: string }> = {
  panel: { texto: 'Panel', icono: 'building-store' },
  tienda: { texto: 'Tienda en línea', icono: 'world' },
  whatsapp: { texto: 'WhatsApp', icono: 'brand-whatsapp' },
};

/** Verbo del botón para pasar a cada estado. */
export const ACCION_ESTADO: Partial<Record<EstadoPedido, string>> = {
  confirmado: 'Confirmar',
  enviado: 'Marcar enviado',
  entregado: 'Marcar entregado',
  cancelado: 'Cancelar pedido',
  devuelto: 'Registrar devolución',
};

export const METODOS_PAGO = ['Efectivo', 'Nequi', 'Daviplata', 'Transferencia', 'Tarjeta', 'Otro'] as const;

/** La siguiente acción "feliz" (la del hover en la fila), sin contar cancelar/devolver. */
export function siguienteEstado(estado: EstadoPedido): EstadoPedido | null {
  return TRANSICIONES_PEDIDO[estado].find((e) => e !== 'cancelado' && e !== 'devuelto') ?? null;
}

/** "#1023" */
export const numeroPedido = (n: number) => `#${n}`;
