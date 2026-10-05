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
  /** Si la Empresa puede operar hoy y, si no, por qué (backend
   * `ModuloAccessService.estadoAcceso`, 2026-10-04). Lo usa el Shell para
   * mostrar el aviso de mora o la pantalla de bloqueo. `null` si la cuenta
   * no tiene Empresa. */
  accesoEmpresa: AccesoEmpresa | null;
}

export type MotivoBloqueo =
  | 'alta_en_curso'
  | 'rechazada'
  | 'suspendida'
  | 'cancelada'
  | 'sin_plan'
  | 'suscripcion_vencida';

export interface AccesoEmpresa {
  operativa: boolean;
  /** `en_mora`: venció el pago pero sigue operando durante la gracia. */
  estado: 'ok' | 'en_mora' | 'bloqueada';
  motivo: MotivoBloqueo | null;
  /** Texto listo para mostrar. */
  mensaje: string;
  empresaEstado: string;
  /** Motivo que cargó Goods al suspender o dar de baja. */
  motivoEstado: string | null;
  suscripcionEstado: string | null;
  fechaProximoVencimiento: string | null;
  corteEn: string | null;
  diasGracia: number;
  /** Cobro pendiente más próximo (se genera 7 días antes de renovar). */
  proximoCobro: { monto: number; moneda: string; fechaLimite: string } | null;
}
