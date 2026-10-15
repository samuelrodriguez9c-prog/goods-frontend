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
  /** NUEVO (opcional, TODO backend): «Manizales, Caldas» bajo el hero. Sin dato se oculta. */
  ciudad?: string | null;
  /** NUEVO (opcional, TODO backend): dirección para «Recoger en tienda». Sin dato, solo ofrece domicilio si `domicilio`. */
  direccionTienda?: string | null;
  /** NUEVO (opcional, TODO backend): redes del pie. Sin datos se ocultan. */
  redes?: { instagram?: string | null; facebook?: string | null; tiktok?: string | null } | null;
  /** NUEVO (opcional, TODO backend): horario del pie, ya en texto. Sin dato se oculta la columna. */
  horario?: { dias: string; horas: string | null }[] | null;
}

export type Entrega = 'recoger' | 'domicilio';

export interface PedidoWhatsapp {
  texto: string;
  url: string;
  total: number;
  /** Número del pedido guardado en el panel del negocio (null si su plan no incluye Pedidos). */
  numero: number | null;
}

/**
 * Respuesta 404 de `GET /tiendas/:slug` (TODO backend): hoy el 404 no trae cuerpo.
 * Para mostrar la pantalla correcta hace falta `motivo`:
 * - `no-existe`: el slug no es de nadie → «Aquí no hay tienda».
 * - `sin-publicar`: existe pero nunca se publicó → «Abre muy pronto».
 * - `pausada`: se publicó y el dueño la pausó → «Volvemos pronto» con nombre y WhatsApp.
 * Sin `motivo`, el front trata el 404 como `no-existe`.
 */
export interface TiendaNoDisponible {
  motivo: 'no-existe' | 'sin-publicar' | 'pausada';
  nombre?: string;
  whatsapp?: string | null;
}

/** `$38.000` (COP) · `$25.50` (USD). Igual que el mensaje que arma el backend. */
export function formatearMonto(monto: number, moneda: Moneda): string {
  return moneda === 'USD'
    ? `$${monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Math.round(monto).toLocaleString('es-CO')}`;
}
