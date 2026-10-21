// Espejo de las entidades del asistente de IA en el backend. A diferencia del
// chat de soporte (`chat/models/conversacion.model.ts`), no hay estado,
// agente asignado ni respuestas citadas.

export interface AsistenteConversacion {
  id: number;
  empresaId: number;
  usuarioId: number;
  titulo: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

/**
 * Tool que usó el asistente para una respuesta; se muestra como «Consulté tu
 * inventario…» para citar la fuente. En `AsistenteMensaje.herramientasUsadas`
 * es `null` en los mensajes del usuario y en las respuestas sin tools.
 */
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

/** Documento propio de la Empresa (políticas, manuales) que el asistente busca por similitud. */
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

/**
 * Lo que el modelo leyó de una factura de proveedor, cruzado con el catálogo
 * (`proveedorIdSugerido` y `productoIdSugerido` son `null` si no hubo
 * coincidencia). El usuario siempre lo revisa antes de confirmar.
 */
export interface FacturaProveedorExtraida {
  proveedorNombreDetectado: string | null;
  proveedorIdSugerido: number | null;
  numeroFactura: string | null;
  fecha: string | null;
  notas: string | null;
  items: ItemFacturaExtraido[];
}
