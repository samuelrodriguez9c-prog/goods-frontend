import { Atributos } from '../../campos/campo-personalizado.model';

// Espejo de `Proveedor` del backend. El modo documento del asistente solo usa
// id, nombre y activo; la pantalla de Proveedores usa el resto.
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
  /** Valores de los campos propios de la Empresa, por clave. */
  atributos: Atributos;
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
  /** `null` o `''` quita la clave; si se manda, el backend exige los obligatorios. */
  atributos?: Record<string, string | number | boolean | null>;
}
