/** Espejo de la entidad `AuditoriaAccion` del backend
 * (`auditoria-accion.entity.ts`) — historial de acciones de escritura
 * (POST/PATCH/PUT/DELETE) de todo el sistema, filtrado por Empresa salvo
 * para `staff_goods` (ver `AuditoriaAccionService.findAll` +
 * `TenantContextService.filtroEmpresa()`). */
export interface AuditoriaAccion {
  id: number;
  /** `null` en acciones anónimas (ej. el registro público de una
   * Empresa). `AuditoriaAccionService.findAll` no hace `relations:
   * ['usuario']` (no lo necesita para nada más), así que acá solo llega
   * el id — no el nombre/correo de quien hizo la acción. */
  usuarioId: number | null;
  empresaId: number | null;
  metodo: string;
  ruta: string;
  entidad: string | null;
  entidadId: string | null;
  exitoso: boolean;
  statusCode: number;
  cuerpo: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  creadoEn: string;
}
