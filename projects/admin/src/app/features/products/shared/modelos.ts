// Modelos del módulo Productos (Productos · Categorías · Inventario · Proveedores · Compras).
// Extienden los espejos mínimos de core/*/models con los campos que usan las pantallas.
// Nombres = entidades del backend (producto, categoria, inventario, proveedor, compra).

import { Atributos } from '../../../core/campos/campo-personalizado.model';

export type EstadoProducto = 'activo' | 'agotado' | 'descontinuado';
export type EstadoCompra = 'pendiente' | 'recibida' | 'cancelada';
export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste';

export interface Categoria {
  id: number;
  nombre: string;
  categoriaPadreId: number | null;
  descripcion: string;
  imagen: string | null;
  activo: boolean;
}

export interface ImagenProducto {
  id: number;
  url: string | null;
  orden: number;
}

export interface ProductoV5 {
  id: number;
  sku: string | null;
  nombre: string;
  descripcion: string;
  categoriaId: number | null;
  marca: string;
  precio: number;
  precioComparacion: number | null;
  costo: number | null;
  pesoGramos: number | null;
  altoCm: number | null;
  anchoCm: number | null;
  largoCm: number | null;
  slug: string;
  destacado: boolean;
  estado: EstadoProducto;
  imagenes: ImagenProducto[];
  creadoEn: string;
  actualizadoEn: string;
}

/** Stock por producto (`GET /inventario`). */
export interface Stock {
  productoId: number;
  disponible: number;
  reservado: number;
  minimo: number;
  actualizadoEn: string;
}

export interface Movimiento {
  id: number;
  productoId: number;
  tipo: TipoMovimiento;
  /** Positivo entra, negativo sale. */
  cantidad: number;
  motivo: string;
  referenciaTipo: 'compra' | 'pedido' | null;
  referenciaId: number | null;
  creadoEn: string;
}

export interface ProveedorV5 {
  id: number;
  nombre: string;
  nit: string;
  correo: string;
  telefono: string;
  direccion: string;
  contactoNombre: string;
  notas: string;
  activo: boolean;
  /** Días de entrega: 1–6 (lunes a sábado). */
  diasEntrega: number[];
  /** Campos propios de la Empresa. Opcional porque Compras crea proveedores sin ellos. */
  atributos?: Atributos;
}

export interface LineaCompra {
  productoId: number;
  cantidad: number;
  precioUnitario: number;
}

export interface CompraV5 {
  id: number;
  proveedorId: number;
  fecha: string;
  numeroFactura: string | null;
  archivoUrl: string | null;
  archivoNombre: string | null;
  notas: string;
  estado: EstadoCompra;
  items: LineaCompra[];
  recibidaEn: string | null;
  /** Campos llenados por "Leer factura" (IA) → muestran la marca del Asistente. */
  llenadoPorIa?: string[];
}

// Lista + hoja (compartido por los 5 módulos)

export interface Miniatura {
  fondo: string;
  tinta: string;
  /** Nombre del ícono Tabler (sin prefijo), si no hay imagen ni iniciales. */
  icono?: string;
  iniciales?: string;
  url?: string | null;
}

export interface FilaModulo<T = unknown> {
  id: number;
  nombre: string;
  sub: string;
  /** Tick vertical de 3×28 px a la izquierda. */
  barra: string;
  mini: Miniatura;
  /** Pastilla gris junto al nombre ("Inactiva", "Destacado"...). */
  etiqueta?: string | null;
  /** Pastilla turquesa al inicio del subtítulo (Pedidos: «Nuevo» de la tienda). */
  pastilla?: { texto: string; tip: string } | null;
  /** Código en monoespaciada antes del subtítulo (Pedidos: «#1049»). */
  codigo?: string | null;
  /** Columna derecha (84 px): texto + barra de 64×4. */
  valor: string;
  valorColor: string;
  /** 0–1. `null` = sin barra. */
  gauge: number | null;
  gaugeColor: string;
  /** Marca del mínimo en la barra (Inventario), 0–1. */
  marca?: number | null;
  /** Nivel de sangría (Categorías: subcategoría = 1). */
  nivel?: number;
  dato: T;
}

export interface GrupoModulo<T = unknown> {
  clave: string;
  titulo: string;
  sub: string;
  color: string;
  fondo: string;
  icono: string;
  filas: FilaModulo<T>[];
}

export interface OpcionPopover {
  clave: string;
  titulo: string;
  detalle: string;
  icono: string;
}

export interface ChipFiltro {
  texto: string;
  quitar: () => void;
}

export interface PestanaHoja {
  clave: string;
  texto: string;
  cuenta?: string | number | null;
  alerta?: boolean;
}

// Tablas de estilo

export const EST: Record<EstadoProducto, { t: string; bg: string; fg: string; dot: string }> = {
  activo: { t: 'Activo', bg: '#a4ffb6', fg: '#0b5c3f', dot: '#087b5d' },
  agotado: { t: 'Agotado', bg: '#ffe6e5', fg: '#b42318', dot: '#d82c0d' },
  descontinuado: { t: 'Descontinuado', bg: '#e3e3e3', fg: '#4b5563', dot: '#9ca3af' },
};

export const CEST: Record<EstadoCompra, { t: string; bg: string; fg: string }> = {
  pendiente: { t: 'Pendiente', bg: '#ffeb79', fg: '#8a5a00' },
  recibida: { t: 'Recibida', bg: '#a4ffb6', fg: '#0b5c3f' },
  cancelada: { t: 'Cancelada', bg: '#e3e3e3', fg: '#4b5563' },
};

export const MOTIVOS = ['Conteo físico', 'Merma', 'Daño', 'Regalo', 'Otro'];

/** Colores de stock (Inventario + columna de Productos). */
export const STOCK = {
  ok: { t: 'Con stock', c: '#087b5d', bg: '#a4ffb6' },
  bajo: { t: 'Bajo el mínimo', c: '#b45309', bg: '#ffeb79' },
  sin: { t: 'Sin stock', c: '#d82c0d', bg: '#ffe6e5' },
} as const;
export type NivelStock = keyof typeof STOCK;
export const nivelStock = (s: Stock): NivelStock => (s.disponible <= 0 ? 'sin' : s.disponible < s.minimo ? 'bajo' : 'ok');
