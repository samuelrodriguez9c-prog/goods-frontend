// Espejo de las entidades del Asistente de IA de staff. A diferencia del de
// `admin`, no hay `empresaId`: nada de esto está atado a una Empresa.

export interface AsistenteStaffConversacion {
  id: number;
  usuarioId: number;
  titulo: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

/** Tool que usó el asistente para responder; la UI la cita como "Consulté …". */
export interface HerramientaStaffUsada {
  nombre: string;
  argumentos: Record<string, unknown>;
}

export interface AsistenteStaffMensaje {
  id: number;
  conversacionId: number;
  rol: 'usuario' | 'asistente';
  cuerpo: string;
  /** `null` en los mensajes del usuario y en respuestas que no usaron tools. */
  herramientasUsadas: HerramientaStaffUsada[] | null;
  creadoEn: string;
}

/**
 * Lo que el modelo leyó de un comprobante de pago. No identifica la Empresa
 * (la elige staff antes de adjuntarlo) y siempre se revisa antes de confirmar.
 */
export interface ComprobantePagoExtraido {
  monto: number | null;
  fecha: string | null;
  referencia: string | null;
  entidadBancaria: string | null;
  notas: string | null;
}

/**
 * Manual o procedimiento interno de Goods que staff carga para que el
 * asistente lo busque por similitud.
 */
export interface AsistenteStaffDocumento {
  id: number;
  titulo: string;
  contenido: string;
  creadoPorUsuarioId: number;
  creadoEn: string;
  actualizadoEn: string;
}
