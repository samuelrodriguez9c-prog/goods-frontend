/** Espejo exacto de lo que devuelve `GET /auth/me` — ver
 * `AuthService.obtenerPerfilPropio` en el backend
 * (`src/modules/auth/auth.service.ts`). `permisos` son códigos
 * ('descuentos.ver'), los mismos que compara `@RequirePermissions` en el
 * backend — así `CurrentUserService.tienePermiso()` decide exactamente lo
 * mismo que decidiría el server, sin duplicar la lógica de otra forma. */
export interface CurrentUser {
  id: number;
  correo: string;
  nombres: string;
  apellidos: string;
  imagenPerfil: string | null;
  direccionPrincipal: string | null;
  /** null solo para personal de Goods (rol `staff_goods`) — ver el
   * comentario en `Usuario.empresaId` del backend. */
  empresaId: number | null;
  rol: {
    id: number;
    nombre: string;
  };
  permisos: string[];
}
