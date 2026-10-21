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
}

/** Respuesta paginada del backend: los registros vienen en `data`, no en `items`. */
export interface RespuestaPaginada<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
}
