/** Espejo de `DesgloseModuloEmpresa` del backend
 * (`modulo/modulo-access.service.ts`, §11.4/§11.5 de
 * PROPUESTA_MODULOS_EXTRA_POR_EMPRESA.md) — una fila por cada módulo
 * ACTIVO del catálogo completo (traiga o no la Empresa ese módulo), con
 * de dónde sale su estado actual. `id` es el id del `Modulo` del catálogo
 * (no del `EmpresaModulo`) — es lo que hay que mandar como `moduloId` en
 * `GestionarModuloPayload`/`quitar()`. */
export interface DesgloseModuloEmpresa {
  id: number;
  codigo: string;
  nombre: string;
  desdePlan: boolean;
  efectivo: boolean;
  override: OverrideModuloEmpresa | null;
}

export interface OverrideModuloEmpresa {
  tipo: 'concedido' | 'revocado';
  motivo: string | null;
  creadoPorId: number | null;
  /** Serializado como string ISO por JSON, igual que el resto de las
   * fechas de este backend (ver `Suscripcion.creadoEn` en
   * `suscripcion.model.ts`). */
  creadoEn: string;
}

/** Body de `POST /empresas/:id/modulos` — espejo de
 * `GestionarEmpresaModuloDto` del backend. */
export interface GestionarModuloPayload {
  moduloId: number;
  tipo: 'concedido' | 'revocado';
  motivo?: string;
}

/** Espejo (parcial) de la entidad `Modulo` del backend — el catálogo
 * completo vía `GET /modulos` (`modulos.ver`, Fase 1). Lo usa
 * `ActivarEmpresaWizardComponent` (§11.7, Fase 2 paso 5) para poder
 * ofrecerle a staff CUALQUIER módulo del catálogo como extra, no solo los
 * que el checkout pidió — mismo criterio que el panel de "Módulos extra"
 * de §11.5 ("staff puede sumar, sacar, o coincidir tal cual"). */
export interface ModuloCatalogo {
  id: number;
  codigo: string;
  nombre: string;
}
