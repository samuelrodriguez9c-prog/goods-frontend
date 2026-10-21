/**
 * Respuesta de `GET /auth/me`. No se comparte con `admin` porque `shared-ui`
 * es solo para UI. En staff `empresaId` es `null`.
 *
 * `rol.esRolStaff` (y no el nombre del rol) decide si la cuenta entra al
 * panel, para que un rol de staff nuevo no obligue a tocar el login.
 */
export interface CurrentUser {
  id: number;
  correo: string;
  nombres: string;
  apellidos: string;
  imagenPerfil: string | null;
  direccionPrincipal: string | null;
  empresaId: number | null;
  rol: {
    id: number;
    nombre: string;
    esRolStaff: boolean;
  };
  permisos: string[];
  /**
   * `true` cuando la sesión se abrió prestando identidad de staff con el
   * acceso especial de superadmin (`Usuario.accesoStaffGoods`). El topbar
   * lo usa para avisar que no es una sesión de staff normal.
   */
  esSesionCrossPanelStaff: boolean;
}
