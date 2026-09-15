/** Espejo de la entidad `Plan` del backend (`plan.entity.ts`), tal como la
 * devuelve `GET /planes` (público, siempre solo `activo: true` — ver el
 * comentario en `PlanController`). Mismo criterio que
 * `staff/core/catalog/models/plan.model.ts`: se repite acá en vez de
 * compartirse porque no hay un paquete de tipos compartido entre backend
 * y frontend, y `admin`/`staff` son proyectos con sesiones y dominios
 * independientes (ver PIVOTE_SAAS_MULTITENANT.md §4). */
export interface PlanPublico {
  id: number;
  nombre: string;
  descripcion: string | null;
  precioMensual: number | null;
  caracteristicas: string[] | null;
}

/** Misma forma que `RespuestaPaginada<T>` del backend
 * (`common/pagination.util.ts`) — ver el mismo comentario en
 * `staff/core/catalog/models/empresa.model.ts`. */
export interface RespuestaPaginada<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
}
