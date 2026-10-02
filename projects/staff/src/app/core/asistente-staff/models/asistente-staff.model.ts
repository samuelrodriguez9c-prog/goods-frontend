// projects/staff/src/app/core/asistente-staff/models/asistente-staff.model.ts
//
// Espejo de las entidades `AsistenteStaffConversacion`/`AsistenteStaffMensaje`
// del backend (`modules/asistente-staff/entities/`) — ver
// PROPUESTA_ASISTENTE_IA_RAG.md §5.4. Calcado de
// `admin/core/asistente/models/asistente.model.ts`, con una única
// diferencia real: acá NO hay `empresaId` — una conversación de staff no
// está atada a ninguna Empresa puntual (ver el docblock de
// `AsistenteStaffConversacion` en el backend).

export interface AsistenteStaffConversacion {
  id: number;
  usuarioId: number;
  titulo: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

/** Qué tool usó el asistente para armar una respuesta puntual — se
 * muestra en la UI como "Consulté Empresas..." (mismo criterio que
 * `admin`: citar siempre la fuente). `null` en los mensajes de rol
 * 'usuario' y en cualquier respuesta que no haya necesitado ninguna
 * tool. */
export interface HerramientaStaffUsada {
  nombre: string;
  argumentos: Record<string, unknown>;
}

export interface AsistenteStaffMensaje {
  id: number;
  conversacionId: number;
  rol: 'usuario' | 'asistente';
  cuerpo: string;
  herramientasUsadas: HerramientaStaffUsada[] | null;
  creadoEn: string;
}

/**
 * Espejo de `ComprobantePagoExtraido` del backend
 * (`modules/asistente-staff/documentos/extraccion-comprobante-pago.service.ts`)
 * — §5.5 de `PROPUESTA_ASISTENTE_IA_RAG.md`. A diferencia de la
 * extracción de facturas de `admin`, acá no hay ningún cruce contra
 * catálogo: la Empresa la elige staff explícitamente ANTES de adjuntar
 * el comprobante (ver el docblock de `ExtraccionComprobantePagoService`,
 * backend) — el usuario siempre revisa/edita esto antes de confirmar.
 */
export interface ComprobantePagoExtraido {
  monto: number | null;
  fecha: string | null;
  referencia: string | null;
  entidadBancaria: string | null;
  notas: string | null;
}

/**
 * Espejo de `AsistenteStaffDocumento` (backend,
 * `modules/asistente-staff/entities/`) — Fase 6 (§5.6 de
 * PROPUESTA_ASISTENTE_IA_RAG.md), manuales/procedimientos internos de
 * Goods que el equipo de staff puede cargar para que el asistente los
 * busque por similitud (`buscarEnDocumentosInternos`). Sin `empresaId`
 * (igual criterio que el resto de `asistente-staff`): es contenido de
 * toda la plataforma, no de un cliente puntual.
 */
export interface AsistenteStaffDocumento {
  id: number;
  titulo: string;
  contenido: string;
  creadoPorUsuarioId: number;
  creadoEn: string;
  actualizadoEn: string;
}
