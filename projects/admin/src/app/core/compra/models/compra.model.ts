// Espejo de `Compra`/`CompraItem`/`CreateCompraDto` del backend
// (`modules/compra/`) — primer modelo de Compra en el frontend de
// `admin`: `ProductPurchasesPageComponent` sigue siendo un placeholder,
// así que esto nace acá para el modo documento del Asistente de IA
// (§5.5 de `PROPUESTA_ASISTENTE_IA_RAG.md`, "factura de proveedor →
// Compra nueva") — no para una pantalla de gestión de compras, que
// todavía no existe.

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
