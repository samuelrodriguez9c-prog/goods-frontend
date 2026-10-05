/**
 * Espejo de las respuestas de `FacturacionController` del backend
 * (`modules/facturacion/`, 2026-10-02). Las fechas llegan como ISO string.
 */

export type MetodoPago = 'transferencia' | 'deposito' | 'efectivo' | 'paypal' | 'otro';
export type MonedaPago = 'COP' | 'USD';
export type EstadoPago = 'valido' | 'anulado';
export type TotalesPorMoneda = Record<MonedaPago, number>;

export const METODOS_PAGO: { valor: MetodoPago; texto: string }[] = [
  { valor: 'transferencia', texto: 'Transferencia' },
  { valor: 'deposito', texto: 'Depósito' },
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'paypal', texto: 'PayPal' },
  { valor: 'otro', texto: 'Otro' },
];

export interface PersonaRef {
  id: number;
  nombre: string;
}

export interface PagoResumen {
  id: number;
  empresaId: number;
  empresaNombre: string;
  suscripcionId: number;
  planNombre: string | null;
  monto: number;
  moneda: MonedaPago;
  metodo: MetodoPago;
  fechaPago: string;
  /** `null` en pagos anteriores a la migración de Facturación. */
  periodoDesde: string | null;
  periodoHasta: string | null;
  referencia: string | null;
  entidadBancaria: string | null;
  estado: EstadoPago;
  archivoUrl: string | null;
  registradoPor: PersonaRef | null;
  creadoEn: string;
}

export interface PagoDetalle extends PagoResumen {
  notas: string | null;
  anuladoEn: string | null;
  anuladoPor: PersonaRef | null;
  motivoAnulacion: string | null;
  /** Solo el último pago válido de la Empresa, y mientras su suscripción no
   *  haya cambiado (ver `FacturacionService.anular` del backend). */
  anulable: boolean;
}

export interface ListadoPagos {
  data: PagoResumen[];
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
  /** Solo pagos válidos dentro del filtro. */
  totales: { pagos: number; monto: TotalesPorMoneda };
}

export interface FiltroPagos {
  page?: number;
  pageSize?: number;
  empresaId?: number;
  /** YYYY-MM-DD, inclusive. */
  desde?: string;
  hasta?: string;
  metodo?: MetodoPago;
  moneda?: MonedaPago;
  estado?: EstadoPago;
  buscar?: string;
}

export interface ResumenFacturacion {
  mesActual: { desde: string; pagos: number; cobrado: TotalesPorMoneda };
  mesAnterior: { desde: string; pagos: number; cobrado: TotalesPorMoneda };
  cartera: { porVencer7Dias: number; enMora: number; vencidas: number };
  /** Cobros generados sin pagar (COP). `atrasados`: ya pasó su fecha límite. */
  porCobrar: { cobros: number; monto: number; atrasados: number };
}

export type EstadoCobro = 'pendiente' | 'pagado' | 'anulado';

/** Lo que se le cobra a la Empresa por un período (lo genera el cron 7 días
 *  antes del vencimiento; un pago lo liquida). */
export interface Cobro {
  id: number;
  periodoDesde: string;
  periodoHasta: string;
  fechaLimite: string;
  monto: number;
  moneda: MonedaPago;
  /** Plan + cada extra (null en cobros viejos, que eran solo el plan). */
  detalle: LineaCobro[] | null;
  estado: EstadoCobro;
  atrasado: boolean;
  pagoId: number | null;
}

export interface LineaCobro {
  concepto: string;
  monto: number;
  origen: 'plan' | 'cargo';
  cargoId?: number;
}

/** Un extra que se cobra cada mes junto con el plan (2026-10-04). */
export interface CargoRecurrente {
  id: number;
  concepto: string;
  monto: number;
  solicitudId: number | null;
  activoDesde: string;
  activoHasta: string | null;
  activo: boolean;
  motivoBaja: string | null;
  creadoPor: PersonaRef | null;
}

export interface EstadoCuenta {
  empresa: { id: number; nombre: string; estado: string; correoContacto: string };
  suscripcion: {
    id: number;
    estado: string;
    plan: { id: number; nombre: string; precioMensual: number | null } | null;
    fechaInicio: string | null;
    fechaProximoVencimiento: string | null;
    diasMora: number;
    diasParaVencer: number | null;
  } | null;
  totales: { pagosValidos: number; pagado: TotalesPorMoneda };
  ultimoPago: PagoResumen | null;
  /** Suma de los cobros pendientes (0 = al día). */
  saldoPendiente: number;
  /** Lo que paga por mes hoy (plan + extras). `null` sin suscripción en ciclo. */
  cuotaMensual: { total: number; detalle: LineaCobro[] } | null;
  cargos: CargoRecurrente[];
  cobros: Cobro[];
  pagos: PagoDetalle[];
}

export interface RegistrarPagoPayload {
  empresaId: number;
  monto: number;
  /** ISO. */
  fechaPago: string;
  metodo?: MetodoPago;
  moneda?: MonedaPago;
  referencia?: string;
  entidadBancaria?: string;
  notas?: string;
  archivoUrl?: string;
}

export interface PagoRegistrado extends PagoDetalle {
  /** Aviso (no bloquea): el monto no coincide con el precio del plan. */
  diferenciaConPlan: { precioPlan: number; diferencia: number } | null;
}
