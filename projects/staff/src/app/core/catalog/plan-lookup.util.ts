import { Plan } from './models/plan.model';
import { Suscripcion } from './models/suscripcion.model';

/**
 * Cruza suscripciones y planes ya cargados en un `Map<empresaId, nombreDelPlan>`,
 * porque `Suscripcion` solo trae `planId`.
 *
 * @remarks
 * Si una Empresa tiene más de una suscripción en la lista (no debería: el
 * backend admite a lo sumo una pendiente o activa), se queda con la primera.
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
