/**
 * `Plan` tal como lo devuelve `GET /planes` (público, solo activos). Se
 * repite acá y en `staff` porque no hay un paquete de tipos compartido.
 */
export interface PlanPublico {
  id: number;
  nombre: string;
  descripcion: string | null;
  precioMensual: number | null;
  /** Días de prueba gratis que ofrece el plan (0 = sin prueba). */
  diasPrueba?: number;
  caracteristicas: string[] | null;
  /**
   * Módulos que de verdad trae el plan (lo que el backend usa para decidir
   * qué ve cada Empresa), a diferencia de `caracteristicas`, que es texto de
   * marketing. El registro ofrece como extra los que el plan elegido no trae.
   */
  modulos: { codigo: string; nombre: string }[];
}

/**
 * Catálogo de módulos activos (`GET /modulos/publico`), solo código y nombre.
 *
 * @remarks
 * No se arma como la unión de los módulos de los planes: un módulo que
 * todavía no está en ningún plan quedaría afuera, y es justo el que se ofrece
 * como extra. `PlanPublico.modulos` dice cuáles de estos ya trae el plan.
 */
export interface ModuloPublico {
  codigo: string;
  nombre: string;
}

/** Respuesta paginada del backend: los registros vienen en `data`. */
export interface RespuestaPaginada<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
}
