/**
 * Espejo parcial de la entidad `Usuario` del backend — solo los campos
 * que `SettingsUsersPageComponent` necesita mostrar/editar. `GET
 * /usuarios` ya viene filtrado por Empresa por el propio backend
 * (`TenantContextService`/`filtroTenantUsuarios`, ver
 * `UsuarioService.findAll`) — acá siempre son los usuarios de MI propia
 * Empresa, nunca hace falta filtrar de nuevo en el frontend.
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
}

/** Mismo shape que `armarRespuestaPaginada` del backend
 * (`common/pagination.util.ts`) — `data`, no `items`. */
export interface RespuestaPaginada<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
}
