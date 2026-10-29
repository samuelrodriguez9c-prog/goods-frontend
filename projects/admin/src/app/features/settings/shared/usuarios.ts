import { Usuario } from '../../../core/usuarios/models/usuario.model';

/** Estado de acceso de una persona del equipo, cómo se pinta y el nombre legible de los roles. Lo usan Usuarios y Roles. */
export type EstadoUsuario = 'activo' | 'pendiente' | 'vencida' | 'inactivo';

export const ESTADO_USUARIO: Record<
  EstadoUsuario,
  { t: string; bg: string; fg: string; punto: string; icono: string }
> = {
  activo: {
    t: 'Con acceso',
    bg: '#e7f6ec',
    fg: '#1f6b43',
    punto: '#29845a',
    icono: 'circle-check',
  },
  pendiente: {
    t: 'Invitación pendiente',
    bg: '#fff1d6',
    fg: '#8a5a00',
    punto: '#e2a400',
    icono: 'mail-forward',
  },
  vencida: {
    t: 'Invitación vencida',
    bg: '#fde2e4',
    fg: '#9f1239',
    punto: '#e11d48',
    icono: 'mail-x',
  },
  inactivo: { t: 'Sin acceso', bg: '#f1f1f1', fg: '#4b5563', punto: '#9ca3af', icono: 'lock' },
};

export function estadoDe(u: Usuario): EstadoUsuario {
  if (u.invitacion) return u.invitacion.vencida ? 'vencida' : 'pendiente';
  return u.activo ? 'activo' : 'inactivo';
}

/** Nombre completo; sin nombre, el correo. */
export function nombreDe(u: Pick<Usuario, 'nombres' | 'apellidos' | 'correo'>): string {
  return `${u.nombres ?? ''} ${u.apellidos ?? ''}`.trim() || u.correo;
}

/** Nombre de pila para textos cortos («¿Quitar a Ana…?»); sin nombre (invitación solo con correo), el correo. */
export function nombreCorto(u: Pick<Usuario, 'nombres' | 'correo'>): string {
  return (u.nombres ?? '').trim() || u.correo;
}

/** El rol del dueño de la tienda: no se cambia desde Usuarios si eres tú. */
export const ROL_DUENO = 'dueno_empresa';

const NOMBRES_ROL: Record<string, string> = {
  dueno_empresa: 'Dueño',
  empleado_empresa: 'Empleado',
};

/** Ícono de las plantillas de Goods si el backend no manda `icono` (el backend ya los trae). */
export const ICONO_PLANTILLA: Record<string, string> = {
  dueno_empresa: 'crown',
  empleado_empresa: 'id-badge-2',
};

/**
 * Las plantillas de Goods llegan con su código (`dueno_empresa`); los roles
 * propios, con el nombre que les puso la tienda.
 */
export function nombreRol(nombre: string): string {
  if (NOMBRES_ROL[nombre]) return NOMBRES_ROL[nombre];
  if (!/^[a-z0-9_]+$/.test(nombre)) return nombre;
  const t = nombre.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
