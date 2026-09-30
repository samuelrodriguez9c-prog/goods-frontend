// Espejo mínimo de la entidad `Producto` del backend
// (`modules/producto/entities/producto.entity.ts`) — igual que
// `Proveedor` (ver el docblock de ese model), solo los campos que hoy
// necesita el modo documento del Asistente de IA (§5.5): elegir a qué
// producto del catálogo corresponde cada línea de una factura. El
// catálogo de Productos en sí (`ProductListPageComponent`) sigue siendo
// un placeholder — no existe todavía ninguna pantalla que necesite más
// campos que estos.
export interface Producto {
  id: number;
  nombre: string;
  sku: string | null;
  precio: number;
}
