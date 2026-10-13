// Espejo mínimo (sin cambios): lo usa el modo documento del Asistente de IA.
export interface Producto {
  id: number;
  nombre: string;
  sku: string | null;
  precio: number;
}

export type EstadoProducto = 'activo' | 'agotado' | 'descontinuado';

export interface ProductoImagen {
  id: number;
  productoId: number;
  url: string;
  /** 0 = portada. */
  orden: number;
}

/**
 * Espejo completo de `Producto` del backend
 * (`modules/negocio/producto/entities/producto.entity.ts`) para la pantalla de
 * catálogo. Los `decimal` de Postgres llegan como string: `ProductoService`
 * los pasa a number antes de entregarlos (ver `normalizar`).
 */
export interface ProductoCatalogo extends Producto {
  descripcion: string | null;
  categoriaId: number | null;
  marca: string | null;
  precioComparacion: number | null;
  costo: number | null;
  pesoGramos: number | null;
  altoCm: number | null;
  anchoCm: number | null;
  largoCm: number | null;
  slug: string | null;
  destacado: boolean;
  estado: EstadoProducto;
  imagenes: ProductoImagen[];
  creadoEn: string;
  actualizadoEn: string;
}

/** Body de `POST /productos` y `PATCH /productos/:id` (CreateProductoDto). */
export type ProductoPayload = Partial<
  Omit<ProductoCatalogo, 'id' | 'imagenes' | 'creadoEn' | 'actualizadoEn'>
>;

/** Etiqueta + colores por estado (los mismos del prototipo, LEEME §3). */
export const ESTADOS_PRODUCTO: Record<EstadoProducto, { t: string; dot: string; bg: string; fg: string }> = {
  activo: { t: 'Activo', dot: '#087b5d', bg: '#a4ffb6', fg: '#0b5c3f' },
  agotado: { t: 'Agotado', dot: '#d82c0d', bg: '#ffe6e5', fg: '#b42318' },
  descontinuado: { t: 'Descontinuado', dot: '#9ca3af', bg: '#e3e3e3', fg: '#4b5563' },
};
