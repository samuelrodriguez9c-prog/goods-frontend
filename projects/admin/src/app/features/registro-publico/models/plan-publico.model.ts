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
  /** Entitlement real de módulos de este plan (Fase 2 de
   * PROPUESTA_MODULOS_EXTRA_POR_EMPRESA.md, §11.6) — a diferencia de
   * `caracteristicas` (texto libre, solo marketing), esto es lo que usa
   * `ModuloAccessService` del backend para decidir qué ve cada Empresa.
   * Sumado a `GET /planes` recién en §11.6 (antes esta respuesta no lo
   * traía). El checkout lo usa para ofrecer, como "extra a confirmar",
   * los módulos que el plan elegido NO trae (ver
   * `RegistroPublicoPageComponent.modulosExtraDisponibles`). */
  modulos: { codigo: string; nombre: string }[];
}

/** Espejo de `GET /modulos/publico` (§11.6, corrección 2026-09-26) — el
 * catálogo REAL de módulos activos, `codigo`/`nombre` nomás (ni `id` ni
 * `descripcion`: es la proyección mínima que expone
 * `ModuloService.listarCatalogoPublico` del backend). Reemplaza el
 * intento inicial de derivar este universo como "unión de módulos de los
 * planes activos" (`PlanPublico.modulos` arriba) — ese enfoque fallaba
 * apenas un módulo no estaba vinculado a NINGÚN plan todavía (el caso real
 * de `discounts`/`messages` recién sembrados), que es exactamente el caso
 * de uso que el checkout necesita cubrir. `PlanPublico.modulos` sigue
 * existiendo y sigue siendo necesario: es lo que dice qué de este
 * catálogo YA trae el plan elegido, no lo reemplaza. */
export interface ModuloPublico {
  codigo: string;
  nombre: string;
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
