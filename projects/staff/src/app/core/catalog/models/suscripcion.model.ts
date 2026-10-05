/** Espejo de la entidad `Suscripcion` del backend
 * (`suscripcion.entity.ts`) — el `findAndCount` que usa
 * `SuscripcionService.findAll` no eager-carga la relación `plan` (no
 * tiene `eager: true`, ver la entidad), así que acá solo llega
 * `planId` — resolver el nombre del plan es responsabilidad de quien
 * consuma esto (ver `EmpresasPageComponent`, que cruza esto con
 * `PlanService.listarTodos()`). */
export interface Suscripcion {
  id: number;
  empresaId: number;
  planId: number;
  /** 'pendiente' | 'activa' | 'cancelada' | 'vencida'. */
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  creadoEn: string;
}

/**
 * Espejo de `SuscripcionPago` del backend
 * (`modules/suscripcion/entities/suscripcion-pago.entity.ts`) — §5.5 de
 * `PROPUESTA_ASISTENTE_IA_RAG.md` ("extracción de documentos", lado
 * staff: "comprobante de pago → registrar Pago de una Empresa"). A
 * diferencia de `Suscripcion` de arriba (una Empresa puede tener varias
 * a lo largo del tiempo, una por plan), esto es el HISTORIAL de pagos
 * manuales — no hay pasarela conectada todavía, así que cada fila acá es
 * un pago que un miembro de staff cargó a mano tras revisar un
 * comprobante. Registrar un pago además RENUEVA la suscripción activa/
 * vencida de esa Empresa (ver `FacturacionService.registrar`,
 * backend) — esta fila es solo el comprobante en sí, no hace falta
 * volver a pedir la Suscripción actualizada para reflejar eso en la UI.
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
