// Espejo de la entidad `Proveedor` del backend
// (`modules/negocio/proveedor/entities/proveedor.entity.ts`). El modo
// documento del Asistente de IA solo usa id/nombre/activo; la pantalla de
// Proveedores (Productos v5) usa el resto.
export interface Proveedor {
  id: number;
  nombre: string;
  activo: boolean;
  nit?: string | null;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  contactoNombre?: string | null;
  notas?: string | null;
  /** Días de entrega: 1 = lunes … 6 = sábado. */
  diasEntrega?: number[];
  creadoEn?: string;
  actualizadoEn?: string;
}

/** Body de POST/PATCH `/proveedores`. Los textos vacíos van como null. */
export interface ProveedorPayload {
  nombre?: string;
  nit?: string | null;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  contactoNombre?: string | null;
  notas?: string | null;
  activo?: boolean;
  diasEntrega?: number[];
}
