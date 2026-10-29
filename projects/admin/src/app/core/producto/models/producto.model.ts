import type { Atributos } from '../../campos/campo-personalizado.model';

/** Lo mínimo de un producto: lo usa el modo documento del asistente. */
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
 * `Producto` completo del backend, para el catálogo. Los `decimal` llegan
 * como string; `ProductoService` los pasa a number antes de entregarlos.
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
  /** Campos propios de la Empresa, por clave. */
  atributos: Atributos;
  creadoEn: string;
  actualizadoEn: string;
}

/** Body de `POST /productos` y `PATCH /productos/:id` (CreateProductoDto). `null` en atributos quita el valor. */
export type ProductoPayload = Partial<
  Omit<ProductoCatalogo, 'id' | 'imagenes' | 'creadoEn' | 'actualizadoEn' | 'atributos'>
> & { atributos?: Record<string, string | number | boolean | string[] | null> };

/** Etiqueta y colores de cada estado. */
export const ESTADOS_PRODUCTO: Record<EstadoProducto, { t: string; dot: string; bg: string; fg: string }> = {
  activo: { t: 'Activo', dot: '#087b5d', bg: '#a4ffb6', fg: '#0b5c3f' },
  agotado: { t: 'Agotado', dot: '#d82c0d', bg: '#ffe6e5', fg: '#b42318' },
  descontinuado: { t: 'Descontinuado', dot: '#9ca3af', bg: '#e3e3e3', fg: '#4b5563' },
};
