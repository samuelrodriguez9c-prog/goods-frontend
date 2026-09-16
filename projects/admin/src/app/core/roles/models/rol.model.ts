/** Espejo de la entidad `Permiso` del backend (`permiso.entity.ts`). */
export interface Permiso {
  id: number;
  codigo: string;
  descripcion: string | null;
  modulo: string | null;
}

/**
 * Espejo de la entidad `Rol` del backend (`rol.entity.ts`) — ahora que
 * `Rol.empresaId` existe (Fase 6 de `PROPUESTA_ROLES_Y_ACCESOS.md`,
 * §5.4), `GET /roles` para un `dueno_empresa` devuelve una mezcla de
 * roles de plantilla (`empresaId: null` — `admin`/`cliente`/
 * `dueno_empresa`/`empleado_empresa`, de solo lectura acá) y los roles
 * propios de SU Empresa (`empresaId` = la mía, con CRUD completo). El
 * frontend distingue cuál es cuál con `empresaId !== null`, nunca con el
 * nombre — el backend ya hizo el filtro de visibilidad
 * (`RolService.filtroVisibilidadRol`), así que cualquier fila que llega
 * acá con `empresaId` no nulo es, por construcción, mía.
 */
export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
  esRolSistema: boolean;
  esRolStaff: boolean;
  empresaId: number | null;
  activo: boolean;
  permisos: Permiso[];
}

/**
 * Espejo de lo que devuelve `GET /roles/asignables`
 * (`PROPUESTA_ROLES_Y_ACCESOS.md` §6 paso 5) — los roles que un dueño
 * puede asignarle a alguien de su equipo (los dos templates de negocio
 * más, desde la Fase 6, sus propios roles custom). Se mantiene como un
 * tipo aparte de `Rol` porque lo consume `SettingsUsersPageComponent`
 * para el selector de "cambiar rol", donde no hace falta nada más que
 * nombre/descripcion/permisos.
 */
export interface RolAsignable {
  id: number;
  nombre: string;
  descripcion: string | null;
  permisos: Permiso[];
}
