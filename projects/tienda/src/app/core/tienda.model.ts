export type Moneda = 'COP' | 'USD';

export interface ProductoPublico {
  id: number;
  /** Para el enlace directo `/<tienda>/p/<slug>` (con el id si no tiene). */
  slug: string | null;
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
  /** «Manizales, Caldas» bajo el hero. Sin dato se oculta. */
  ciudad?: string | null;
  /** Dirección del local para «Recoger en tienda» y el pie. Sin dato, la entrega arranca en domicilio. */
  direccionTienda?: string | null;
  /** Enlaces de las redes del pie (null si no cargó ninguna). */
  redes?: { instagram?: string | null; facebook?: string | null; tiktok?: string | null } | null;
  /** Horario del pie, ya en texto (`horas: null` = cerrado). Sin dato se oculta la columna. */
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
 * Respuesta 404 de `GET /tiendas/:slug`: `motivo` elige la pantalla.
 * - `no-existe`: el slug no es de nadie → «Aquí no hay tienda».
 * - `sin-publicar`: existe pero nunca se publicó → «Abre muy pronto».
 * - `pausada`: se publicó y el dueño la pausó → «Volvemos pronto» con nombre y WhatsApp.
 * Si el 404 no trae `motivo`, se trata como `no-existe`.
 */
export interface TiendaNoDisponible {
  motivo: 'no-existe' | 'sin-publicar' | 'pausada';
  nombre?: string;
  whatsapp?: string | null;
}

/** `$38.000` (COP) · `$25.50` (USD). Tiene que coincidir con `formatearMonto` del backend: la vista previa debe verse igual que el mensaje que llega. */
export function formatearMonto(monto: number, moneda: Moneda): string {
  return moneda === 'USD'
    ? `$${monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Math.round(monto).toLocaleString('es-CO')}`;
}
