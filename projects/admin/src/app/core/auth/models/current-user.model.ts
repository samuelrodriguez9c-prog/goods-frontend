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
    /** Ver `Rol.esRolStaff` en el backend / `PROPUESTA_ROLES_Y_ACCESOS.md`
     * §5.1 — acá siempre va a ser `false` (nadie con un rol de staff entra
     * al panel `admin`), se refleja igual para que el modelo sea un
     * espejo exacto de la respuesta real. */
    esRolStaff: boolean;
  };
  permisos: string[];
  /** Códigos de `Modulo` (§10.2 de PROPUESTA_MODULOS_EXTRA_POR_EMPRESA.md)
   * que el plan activo de la Empresa incluye — lo usa
   * `SidebarComponent.navItemsVisibles` para ocultar del menú lo que la
   * Empresa no contrató (fuente de verdad real: `ModuloGuard` en el
   * backend, esto es solo UX — ocultar un link no es lo que impide el
   * acceso). Vacío si la Empresa no tiene una suscripción activa. */
  modulosDisponibles: string[];
}
