import { Plan } from './models/plan.model';
import { Suscripcion } from './models/suscripcion.model';

/**
 * Cruza suscripciones + planes (ambos ya en memoria, ver
 * `SuscripcionService`/`PlanService`) en un `Map<empresaId, nombreDelPlan>`
 * — `Suscripcion` del backend no trae el nombre del plan (solo `planId`,
 * ver `Suscripcion.model.ts`), así que hace falta este cruce en vez de
 * leer `suscripcion.plan.nombre` directo.
 *
 * Si una Empresa tuviera más de una fila en `suscripciones` para el mismo
 * estado (no debería pasar — ver la invariante documentada en
 * `Suscripcion` del backend: "a lo sumo una pendiente/activa a la vez"),
 * se queda con la primera que encuentre; no es su responsabilidad
 * detectar esa inconsistencia de datos.
 */
export function construirMapaPlanPorEmpresa(
  suscripciones: Suscripcion[],
  planes: Plan[],
): Map<number, string> {
  const nombrePorPlanId = new Map(planes.map((plan) => [plan.id, plan.nombre]));
  const mapa = new Map<number, string>();
  for (const suscripcion of suscripciones) {
    if (mapa.has(suscripcion.empresaId)) {
      continue;
    }
    const nombre = nombrePorPlanId.get(suscripcion.planId);
    if (nombre) {
      mapa.set(suscripcion.empresaId, nombre);
    }
  }
  return mapa;
}
