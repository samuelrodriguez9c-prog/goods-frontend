/** Espejo de `Permiso` del backend. */
export interface Permiso {
  id: number;
  codigo: string;
  descripcion: string | null;
  modulo: string | null;
}

/**
 * Espejo de `Rol` del backend. `GET /roles` mezcla roles de plantilla
 * (`empresaId: null`, de solo lectura acá) y los propios de la Empresa.
 *
 * @remarks
 * Se distinguen por `empresaId !== null`, nunca por el nombre: el backend ya
 * filtró la visibilidad, así que todo rol con `empresaId` es de esta Empresa.
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
 * Respuesta de `GET /roles/asignables`: los roles que un dueño puede darle a
 * alguien de su equipo (las dos plantillas de negocio y sus roles propios).
 * Alimenta el selector «Cambiar rol» de Usuarios.
 */
export interface RolAsignable {
  id: number;
  nombre: string;
  descripcion: string | null;
  permisos: Permiso[];
}
