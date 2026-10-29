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
  /** Nombre corto de Tabler (`'headset'`); sin él se usa el ícono por defecto. */
  icono?: string | null;
  /** Para «Creado por X · hace N días». `creadoPor` es `null` en las plantillas y en los roles de antes. */
  creadoEn?: string;
  creadoPor?: { id: number; nombre: string } | null;
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
  /** `null` en las plantillas de Goods; el id de la Empresa en sus roles propios. */
  empresaId?: number | null;
  icono?: string | null;
}
