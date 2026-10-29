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
  /** Lo que se guardó o se propuso recordar en esta respuesta (la tarjeta del chat). */
  recuerdos?: AsistenteRecuerdo[];
  /** Acciones que propuso en esta respuesta, para confirmar o descartar. */
  acciones?: AsistenteAccion[];
  creadoEn: string;
}

/**
 * Algo que el asistente recuerda: de la persona (`personal`) o de todo el
 * equipo (`empresa`). Las `propuesta` esperan «Guardar» o «Descartar» en la
 * tarjeta del chat; solo las `activa` llegan al asistente.
 */
export interface AsistenteRecuerdo {
  id: number;
  texto: string;
  alcance: 'personal' | 'empresa';
  estado: 'propuesta' | 'activa' | 'descartada';
  /** `pedido`: «recuerda que…»; `sugerido`: lo propuso el asistente; `manual`: escrito en la pantalla. */
  origen: 'pedido' | 'sugerido' | 'manual';
  creadoPor: string | null;
  conversacionId: number | null;
  mensajeId: number | null;
  creadoEn: string;
  actualizadoEn: string;
}

/** Línea de una compra propuesta por el asistente. */
export interface LineaCompraPropuesta {
  productoId: number;
  producto: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
}

/**
 * Acción que propuso el asistente (por ahora, `armarCompra`). No pasa nada
 * hasta que la persona la confirma; `ejecutando` dura lo que tarda en crearse.
 */
export interface AsistenteAccion {
  id: number;
  tipo: 'armarCompra';
  estado: 'propuesta' | 'ejecutando' | 'confirmada' | 'descartada' | 'fallida' | 'vencida';
  resumen: {
    proveedor: { id: number; nombre: string };
    lineas: LineaCompraPropuesta[];
    total: number;
    notas?: string;
    /** Ya hay compras pendientes parecidas a este proveedor. */
    aviso?: string;
  };
  resultado: { compraId: number; codigo: string; total: number } | null;
  error: string | null;
  creadoEn: string;
  venceEn: string | null;
  resueltoEn: string | null;
}

/** `GET /asistente/recuerdos`. */
export interface ListaRecuerdos {
  personales: AsistenteRecuerdo[];
  empresa: AsistenteRecuerdo[];
  /** Tiene `asistente.recuerdos`: puede guardar y editar los de la Empresa. */
  puedeEditarEmpresa: boolean;
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
