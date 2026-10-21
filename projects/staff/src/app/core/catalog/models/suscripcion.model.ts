/** Espejo de la entidad `Suscripcion`. El listado no trae la relación
 * `plan`, solo `planId`: para el nombre, ver `construirMapaPlanPorEmpresa`. */
export interface Suscripcion {
  id: number;
  empresaId: number;
  planId: number;
  /** 'pendiente' | 'activa' | 'cancelada' | 'vencida'. */
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  fechaProximoVencimiento?: string | null;
  /** Fin del período de prueba; sigue en prueba mientras `pruebaConvertidaEn` sea null. */
  pruebaHasta?: string | null;
  pruebaConvertidaEn?: string | null;
  creadoEn: string;
}

/** En prueba: tuvo prueba y ningún pago la convirtió todavía. */
export const enPrueba = (s: Pick<Suscripcion, 'pruebaHasta' | 'pruebaConvertidaEn'> | null | undefined) => !!s?.pruebaHasta && !s.pruebaConvertidaEn;
/** Tope de días de prueba (decisión de negocio; el backend aplica el mismo). */
export const DIAS_PRUEBA_MAX = 90;

/**
 * Espejo de `SuscripcionPago`: un pago que staff cargó a mano tras revisar
 * un comprobante (no hay pasarela de pago). Registrarlo también renueva la
 * suscripción activa o vencida de la Empresa.
 */
export interface SuscripcionPago {
  id: number;
  suscripcionId: number;
  empresaId: number;
  monto: number;
  fechaPago: string;
  referencia: string | null;
  entidadBancaria: string | null;
  notas: string | null;
  archivoUrl: string | null;
  registradoPorUsuarioId: number | null;
  creadoEn: string;
}

export interface RegistrarPagoSuscripcionPayload {
  empresaId: number;
  monto: number;
  fechaPago: string;
  referencia?: string;
  entidadBancaria?: string;
  notas?: string;
  archivoUrl?: string;
}
