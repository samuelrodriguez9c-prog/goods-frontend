/** Espejo de la entidad `Permiso` del backend (`permiso.entity.ts`). */
export interface Permiso {
  id: number;
  codigo: string;
  descripcion: string | null;
  modulo: string | null;
}

/** Espejo de la entidad `Rol` del backend (`rol.entity.ts`) — `permisos`
 * viene siempre poblado (`GET /roles` hace `relations: ['permisos']` en
 * el backend, ver `RolService.findAll`). */
export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
  esRolSistema: boolean;
  activo: boolean;
  permisos: Permiso[];
}
