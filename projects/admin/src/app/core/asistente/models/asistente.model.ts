// projects/admin/src/app/core/asistente/models/asistente.model.ts
//
// Espejo de las entidades `AsistenteConversacion`/`AsistenteMensaje` del
// backend (`modules/asistente/entities/`) — ver PROPUESTA_ASISTENTE_IA_RAG.md
// §4.3. A diferencia de `chat/models/conversacion.model.ts` (ChatModule de
// soporte humano), acá no hay `estado`/`agenteAsignado`/`respondeA`: el
// asistente de IA no tiene ninguno de esos conceptos.

export interface AsistenteConversacion {
  id: number;
  empresaId: number;
  usuarioId: number;
  titulo: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

/** Qué tool usó el asistente para armar una respuesta puntual — se
 * muestra en la UI como "Consulté tu inventario..." (§4.7/§5.1 paso 13:
 * citar siempre la fuente). `null` en los mensajes de rol 'usuario' y en
 * cualquier respuesta que no haya necesitado ninguna tool. */
export interface HerramientaUsada {
  nombre: string;
  argumentos: Record<string, unknown>;
}

export interface AsistenteMensaje {
  id: number;
  conversacionId: number;
  rol: 'usuario' | 'asistente';
  cuerpo: string;
  herramientasUsadas: HerramientaUsada[] | null;
  creadoEn: string;
}

/**
 * Espejo de `FacturaProveedorExtraida`/`ItemFacturaExtraido` del backend
 * (`modules/asistente/documentos/extraccion-factura-proveedor.service.ts`)
 * — §5.5 de `PROPUESTA_ASISTENTE_IA_RAG.md` ("extracción de
 * documentos"). Es la respuesta cruda del modelo + el cruce contra
 * catálogo (`proveedorIdSugerido`/`productoIdSugerido`, `null` si no
 * hubo match) — el usuario SIEMPRE la revisa/edita en el modo documento
 * del panel antes de confirmar, nunca se guarda tal cual.
 */
/** Documento propio de la Empresa (políticas, manuales) que el asistente
 * busca por similitud — `POST/GET/PATCH/DELETE /asistente/documentos`. */
export interface AsistenteDocumento {
  id: number;
  empresaId: number;
  titulo: string;
  contenido: string;
  creadoPorUsuarioId: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ItemFacturaExtraido {
  nombreDetectado: string;
  cantidad: number | null;
  precioUnitario: number | null;
  productoIdSugerido: number | null;
}

export interface FacturaProveedorExtraida {
  proveedorNombreDetectado: string | null;
  proveedorIdSugerido: number | null;
  numeroFactura: string | null;
  fecha: string | null;
  notas: string | null;
  items: ItemFacturaExtraido[];
}
