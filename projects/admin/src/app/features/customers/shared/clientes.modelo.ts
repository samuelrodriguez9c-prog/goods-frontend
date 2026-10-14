import { Cliente, OrdenClientes } from '../../../core/cliente/models/cliente.model';

/** Textos de Clientes para la UI. */
export const ORDEN_CLIENTES: Record<OrdenClientes, string> = {
  recientes: 'Más recientes',
  nombre: 'Nombre',
  gastado: 'Más gasto',
  pedidos: 'Más pedidos',
};

/** 573001234567 → "+57 300 123 4567" (los de EE. UU.: "+1 305 555 0123"). */
export function formatoTelefono(t: string | null): string {
  if (!t) return '';
  const m = /^(57|1)(\d{3})(\d{3})(\d{4})$/.exec(t);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${t}`;
}

/** Enlace para escribirle por WhatsApp. */
export const enlaceWhatsapp = (c: Pick<Cliente, 'telefono'>) => (c.telefono ? `https://wa.me/${c.telefono}` : null);

/** Ticket promedio de lo que compró (0 si todavía no compró). */
export const ticketPromedio = (c: Pick<Cliente, 'cantidadPedidos' | 'totalGastado'>) =>
  c.cantidadPedidos ? Math.round(c.totalGastado / c.cantidadPedidos) : 0;
