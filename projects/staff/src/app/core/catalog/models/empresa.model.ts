/** Espejo de la entidad `Empresa` del backend (`empresa.entity.ts`) — solo
 * los campos que el panel de staff necesita mostrar, no re-declara toda la
 * fila si algún día suma columnas que acá no hacen falta. */
export interface Empresa {
  id: number;
  nombre: string;
  rubro: string | null;
  correoContacto: string;
  telefonoContacto: string | null;
  /** 'pendiente' | 'activa' | 'suspendida' | 'cancelada' — ver
   * `Empresa.estado` en el backend. */
  estado: string;
  duenoNombres: string | null;
  duenoApellidos: string | null;
  duenoCorreo: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

/** Misma forma que `RespuestaPaginada<T>` del backend
 * (`common/pagination.util.ts`) — se repite acá en vez de compartirse
 * porque no hay un paquete de tipos compartido entre backend y frontend
 * todavía (ninguno de los dos proyectos Angular lo tiene, ver
 * `admin/core/auth/models/current-user.model.ts`, que hace lo mismo). */
export interface RespuestaPaginada<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
}
