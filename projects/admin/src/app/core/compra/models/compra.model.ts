// Espejo de `Compra`, `CompraItem` y los DTO de compras del backend. Lo usan
// Compras (Productos) y el modo documento del asistente (factura → compra).

export interface CompraItem {
  id: number;
  productoId: number;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface Compra {
  id: number;
  proveedorId: number;
  fecha: string;
  estado: string;
  total: number;
  notas: string | null;
  numeroFactura: string | null;
  archivoUrl: string | null;
  /** Cuándo se recibió (el stock entró). */
  recibidaEn?: string | null;
  items: CompraItem[];
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface CrearCompraItemPayload {
  productoId: number;
  cantidad: number;
  precioUnitario: number;
}

export interface CrearCompraPayload {
  proveedorId: number;
  fecha?: string;
  notas?: string;
  numeroFactura?: string;
  archivoUrl?: string;
  items: CrearCompraItemPayload[];
}

/** Body de `PATCH /compras/:id`. Fuera de "pendiente" solo se aceptan las notas. */
export interface ActualizarCompraPayload {
  proveedorId?: number;
  fecha?: string;
  notas?: string;
  numeroFactura?: string | null;
  archivoUrl?: string | null;
  items?: CrearCompraItemPayload[];
}
