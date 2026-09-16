/** Espejo exacto de lo que devuelve `GET /auth/me` — mismo modelo que
 * `admin/core/auth/models/current-user.model.ts` (no se comparte vía
 * `shared-ui` a propósito: esa librería es para composites de UI, no para
 * tipos de dominio — ver ADMIN_DISENO.md sobre el criterio de qué entra
 * en `shared-ui`). Acá `empresaId` siempre va a ser `null`.
 *
 * `rol.esRolStaff` (no `rol.nombre === 'staff_goods'`) es lo que decide si
 * la cuenta puede entrar a este panel — ver `LoginComponent.submit()` y
 * `PROPUESTA_ROLES_Y_ACCESOS.md` §5.1: con esto, cualquier rol de staff
 * nuevo (`admin_goods`, `auditoria_goods`, `empleado_goods`) entra sin
 * tocar este archivo ni el login. */
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
  // Fase 7 de PROPUESTA_ROLES_Y_ACCESOS.md (§5.5) — `true` solo cuando
  // esta sesión puntual se abrió "prestando" identidad de staff vía el
  // acceso especial de superadmin (Usuario.accesoStaffGoods), no porque el
  // usuario sea de verdad parte del staff de Goods. Ver
  // `TopbarComponent`, que lo usa para mostrar el aviso correspondiente —
  // sin esto, alguien usando su acceso especial no tendría forma de
  // distinguirlo de una sesión de staff normal.
  esSesionCrossPanelStaff: boolean;
}
