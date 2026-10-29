/**
 * Respuesta de `GET /auth/me`. `permisos` son los mismos códigos que exige
 * `@RequirePermissions` en el backend (`'descuentos.ver'`), así que comparar
 * contra ellos decide lo mismo que el servidor.
 */
export interface CurrentUser {
  id: number;
  correo: string;
  nombres: string;
  apellidos: string;
  imagenPerfil: string | null;
  direccionPrincipal: string | null;
  /** `null` solo para personal de Goods. */
  empresaId: number | null;
  rol: {
    id: number;
    nombre: string;
    /** En `admin` siempre es `false`: los roles de staff no entran a este panel. */
    esRolStaff: boolean;
  };
  permisos: string[];
  /**
   * Códigos de módulo que tiene la Empresa. El sidebar y `moduloGuard` los
   * usan para ocultar lo que no contrató (solo UX: quien bloquea es
   * `ModuloGuard` en el backend). Vacío sin suscripción activa.
   */
  modulosDisponibles: string[];
  /**
   * Si la Empresa puede operar hoy y, si no, por qué. El Shell lo usa para el
   * aviso de mora o la pantalla de bloqueo. `null` si la cuenta no tiene Empresa.
   */
  accesoEmpresa: AccesoEmpresa | null;
  /** Nombre, logo (el de su tienda) y plan vigente, para el topbar. `null` sin Empresa. */
  empresa?: EmpresaResumen | null;
  /** Atajos de teclado que la persona cambió (ver `AtajosService`). */
  atajos?: Record<string, string>;
}

export interface EmpresaResumen {
  id: number;
  nombre: string;
  logoUrl: string | null;
  plan: { nombre: string; precioMensual: number | null } | null;
  /** Dirección pública de su tienda; `null` si nunca la configuró. */
  tienda?: { slug: string; url: string; activa: boolean } | null;
}

export type MotivoBloqueo =
  | 'alta_en_curso'
  | 'rechazada'
  | 'suspendida'
  | 'cancelada'
  | 'sin_plan'
  | 'suscripcion_vencida'
  | 'prueba_terminada';

export interface AccesoEmpresa {
  operativa: boolean;
  /**
   * `en_mora`: venció el pago pero sigue operando durante la gracia.
   * `en_prueba`: prueba gratis, opera hasta `pruebaHasta`.
   */
  estado: 'ok' | 'en_mora' | 'en_prueba' | 'bloqueada';
  motivo: MotivoBloqueo | null;
  mensaje: string;
  empresaEstado: string;
  /** Motivo que cargó Goods al suspender o dar de baja. */
  motivoEstado: string | null;
  suscripcionEstado: string | null;
  fechaProximoVencimiento: string | null;
  corteEn: string | null;
  /** Solo en prueba: hasta cuándo es gratis (sin pago, ese día se corta). */
  pruebaHasta?: string | null;
  diasGracia: number;
  /**
   * Cobro pendiente más próximo (se genera 7 días antes de renovar).
   * `pagoEnLinea`: se puede pagar con Wompi desde el panel.
   */
  proximoCobro: { monto: number; moneda: string; fechaLimite: string; pagoEnLinea?: boolean } | null;
}
