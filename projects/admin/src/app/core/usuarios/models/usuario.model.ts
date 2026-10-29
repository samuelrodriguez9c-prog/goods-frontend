/**
 * Lo que muestra la pantalla de Usuarios de cada persona del equipo. El
 * backend ya filtra por Empresa: no hace falta filtrar de nuevo acá.
 */
export interface Usuario {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  correoVerificado: boolean;
  activo: boolean;
  rolId: number;
  rol?: {
    id: number;
    nombre: string;
  };
  /** Solo si todavía no creó su contraseña (invitación pendiente o vencida). */
  invitacion?: { venceEn: string | null; vencida: boolean };
  telefono?: string | null;
  /** Último inicio de sesión; `null` si nunca entró. */
  ultimoAcceso?: string | null;
  creadoEn?: string;
}

/** Una sesión abierta (`GET /usuarios/:id/sesiones`). No trae ciudad. */
export interface SesionAbierta {
  id: number;
  /** «Chrome en Windows»; `null` si el navegador no se reconoce. */
  dispositivo: string | null;
  tipo: 'movil' | 'computador';
  ip: string | null;
  /** Última vez que esa sesión se renovó. */
  ultimoUso: string;
  venceEn: string;
}

/** Respuesta paginada del backend: los registros vienen en `data`, no en `items`. */
export interface RespuestaPaginada<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
}
