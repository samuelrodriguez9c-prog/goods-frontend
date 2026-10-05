/** Formas de `GET /ingresos/*` (backend `IngresosService`, 2026-10-04). Montos en COP. */

export type TipoMovimiento =
  | 'nueva'
  | 'reactivacion'
  | 'subida'
  | 'bajada'
  | 'cambio'
  | 'baja'
  | 'vencida'
  // Extras que se cobran con el plan (cargos recurrentes, 2026-10-04).
  | 'extra_alta'
  | 'extra_baja';

export interface MovimientoIngresos {
  fecha: string;
  tipo: TipoMovimiento;
  empresaId: number;
  empresaNombre: string;
  plan: string;
  planAnterior: string | null;
  deltaMrr: number;
}

export interface MesIngresos {
  /** `YYYY-MM`. */
  mes: string;
  mrr: number;
  clientes: number;
  cobrado: { COP: number; USD: number };
  pagos: number;
  facturado: number;
  pendiente: number;
  nuevas: number;
  reactivaciones: number;
  subidas: number;
  extrasAltas: number;
  extrasBajas: number;
  bajadas: number;
  bajas: number;
  vencidas: number;
  mrrNuevo: number;
  mrrExpansion: number;
  mrrContraccion: number;
  mrrPerdido: number;
}

export interface PlanIngresos {
  planId: number;
  plan: string;
  precioMensual: number | null;
  empresas: number;
  enMora: number;
  mrr: number;
  participacion: number;
}

export interface MovimientosDelMes {
  mes: string;
  items: MovimientoIngresos[];
}

export interface ResumenIngresos {
  generadoEn: string;
  actual: {
    mes: string;
    mrr: number;
    mrrMesAnterior: number;
    arr: number;
    clientes: number;
    clientesMesAnterior: number;
    arpa: number;
    netoMrr: number;
    cobrado: { COP: number; USD: number };
    cobradoMesAnterior: { COP: number; USD: number };
    churn: number;
    enRiesgo: { empresas: number; mrr: number };
    /** Extras vigentes (ya incluidos en `mrr`). */
    extras: { cargos: number; empresas: number; mrr: number };
  };
  serie: MesIngresos[];
  porPlan: PlanIngresos[];
  movimientos: MovimientosDelMes;
}
