export type Moneda = 'COP' | 'USD';

export interface ProductoPublico {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  precioAntes: number | null;
  categoriaId: number | null;
  imagenes: string[];
  destacado: boolean;
  agotado: boolean;
  ultimasUnidades: boolean;
}

export interface TiendaPublica {
  slug: string;
  nombre: string;
  descripcion: string | null;
  logoUrl: string | null;
  whatsapp: string;
  moneda: Moneda;
  categorias: { id: number; nombre: string }[];
  productos: ProductoPublico[];
}

export interface PedidoWhatsapp {
  texto: string;
  url: string;
  total: number;
  /** Número del pedido guardado en el panel del negocio (null si su plan no incluye Pedidos). */
  numero: number | null;
}

/** `$38.000` (COP) · `$25.50` (USD). Igual que el mensaje que arma el backend. */
export function formatearMonto(monto: number, moneda: Moneda): string {
  return moneda === 'USD'
    ? `$${monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Math.round(monto).toLocaleString('es-CO')}`;
}
