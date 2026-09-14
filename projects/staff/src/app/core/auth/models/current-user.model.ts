/** Espejo exacto de lo que devuelve `GET /auth/me` — mismo modelo que
 * `admin/core/auth/models/current-user.model.ts` (no se comparte vía
 * `shared-ui` a propósito: esa librería es para composites de UI, no para
 * tipos de dominio — ver ADMIN_DISENO.md sobre el criterio de qué entra
 * en `shared-ui`). Acá `empresaId` siempre va a ser `null` y `rol.nombre`
 * siempre `'staff_goods'` — es la única forma de entrar a este proyecto,
 * ver `AuthGuard`/`LoginComponent`. */
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
  };
  permisos: string[];
}
