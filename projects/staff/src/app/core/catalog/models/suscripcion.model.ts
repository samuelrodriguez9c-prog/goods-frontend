/** Espejo de la entidad `Suscripcion` del backend
 * (`suscripcion.entity.ts`) — el `findAndCount` que usa
 * `SuscripcionService.findAll` no eager-carga la relación `plan` (no
 * tiene `eager: true`, ver la entidad), así que acá solo llega
 * `planId` — resolver el nombre del plan es responsabilidad de quien
 * consuma esto (ver `EmpresasPageComponent`, que cruza esto con
 * `PlanService.listarTodos()`). */
export interface Suscripcion {
  id: number;
  empresaId: number;
  planId: number;
  /** 'pendiente' | 'activa' | 'cancelada' | 'vencida'. */
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  creadoEn: string;
}
