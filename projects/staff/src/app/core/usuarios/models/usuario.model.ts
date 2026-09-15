/** Espejo (parcial) de la entidad `Usuario` del backend — solo los
 * campos que el panel de staff necesita para gestionar a su propio
 * personal (ver `UsuarioService.filtroTenantUsuarios` del backend: acá
 * siempre `empresaId === null`). No repite columnas de e-commerce que no
 * aplican al personal de Goods (dirección, puntos de fidelidad,
 * referidos, etc.). */
export interface UsuarioGoods {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  rolId: number;
  /** Cargada `eager: true` en el backend (`Usuario.rol`), siempre viene. */
  rol: { id: number; nombre: string };
  activo: boolean;
  creadoEn: string;
}

/** Espejo de `RespuestaPaginada<T>` — repetido a propósito, ver el mismo
 * comentario en `core/catalog/models/empresa.model.ts`. */
export interface RespuestaPaginada<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
}
