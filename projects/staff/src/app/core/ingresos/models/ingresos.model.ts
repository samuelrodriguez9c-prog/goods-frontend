/** Formas de `GET /ingresos/*`. Montos en COP salvo donde se separa por moneda. */

export type TipoMovimiento =
  | 'nueva'
  | 'reactivacion'
  | 'subida'
  | 'bajada'
  | 'cambio'
  | 'baja'
  | 'vencida'
  // Extras que se cobran con el plan (cargos recurrentes).
  | 'extra_alta'
  | 'extra_baja'
  // Descuentos sobre el plan: dar uno contrae el MRR, quitarlo lo expande.
  | 'descuento_alta'
  | 'descuento_baja';

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
  descuentosAltas: number;
  descuentosBajas: number;
  bajadas: number;
  bajas: number;
  vencidas: number;
  mrrNuevo: number;
  mrrExpansion: number;
  mrrContraccion: number;
  mrrPerdido: number;
  /** MRR de planes por plan al cierre de ese mes (sin extras). */
  porPlan: { planId: number; plan: string; empresas: number; mrr: number; participacion: number }[];
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
    /** Períodos de prueba: no suman al MRR hasta que pagan. */
    pruebas: { enCurso: number; terminanEn7Dias: number; convertidasMes: number; perdidasMes: number; conversion: number | null };
  };
  serie: MesIngresos[];
  porPlan: PlanIngresos[];
  movimientos: MovimientosDelMes;
}
