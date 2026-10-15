// Tipos de pantalla y tablas de estilo de Pedidos y Clientes
// (handoff-pedidos-clientes, idénticas al prototipo pedidos-vista.js).
// El backend manda los montos como string y campos opcionales en null:
// `ventas.store.ts` los convierte a estos tipos al cargar.

export type EstadoPedido = 'pendiente' | 'confirmado' | 'enviado' | 'entregado' | 'cancelado' | 'devuelto';
export type EstadoPago = 'pendiente' | 'pagado' | 'reembolsado';
export type Canal = 'panel' | 'tienda' | 'whatsapp';
export type MetodoPago = 'Efectivo' | 'Nequi' | 'Daviplata' | 'Transferencia' | 'Tarjeta' | 'Otro';
export type TipoEvento = 'creado' | 'estado' | 'pago' | 'editado' | 'nota';

export interface Direccion { direccion: string; referencia: string; ciudad: string; telefono?: string }

export interface Cliente {
  id: number;
  nombre: string;
  /** 57XXXXXXXXXX ('' si no tiene). */
  telefono: string;
  correo: string;
  documento: string;
  direccion: Direccion;
  notas: string;
  aceptaPromociones: boolean;
  whatsappContactoId: number | null;
  archivadoEn: string | null;
  creadoEn: string;
  /** Calculados por el servidor (`GET /clientes`). */
  cantidadPedidos: number;
  totalGastado: number;
  ultimoPedidoEn: string | null;
}

export interface LineaPedido {
  id: number;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  /** Solo con el detalle cargado. */
  sku?: string | null;
  imagenUrl?: string | null;
}
export interface PagoPedido { monto: number; metodo: string; estado: 'pagado' | 'reembolsado'; en: string }
export interface EventoPedido { tipo: TipoEvento; detalle: string; por: string; en: string; estado?: EstadoPedido; motivo?: string }

export interface Pedido {
  id: number;
  numero: number;
  clienteId: number;
  /** El cliente como está hoy (el backend lo trae con el pedido). */
  cliente: { nombre: string; telefono: string; correo: string };
  estado: EstadoPedido;
  estadoPago: EstadoPago;
  canal: Canal;
  items: LineaPedido[];
  subtotal: number;
  costoEnvio: number;
  descuento: number;
  codigoDescuento: string | null;
  total: number;
  /** '' = sin definir. */
  metodoPago: string;
  direccionEnvio: Direccion | null;
  notas: string;
  /** false = llegó por la tienda y todavía no aparta stock. */
  stockReservado: boolean;
  creadoPor: string | null;
  motivoCancelacion: string | null;
  canceladoEn: string | null;
  pagos: PagoPedido[];
  eventos: EventoPedido[];
  creadoEn: string;
  /** Ya se trajo `GET /pedidos/:id` (eventos, pagos, código y quién lo cargó). */
  detalle: boolean;
}

export interface StatsCliente { n: number; total: number; ticket: number; ultimo: string | null }

// ── Borradores ──────────────────────────────────────────────────────────
export interface LineaBorrador { productoId: number; cantidad: number; precioUnitario: number }
export interface BorradorPedido {
  items: LineaBorrador[];
  cliMode: 'existente' | 'nuevo';
  clienteId: number | null;
  nuevo: { nombre: string; telefono: string; correo: string };
  direccion: string; referencia: string; ciudad: string;
  costoEnvio: string;
  codigo: string;
  metodoPago: string;
  notas: string;
  canal: Canal;
}
export interface BorradorCliente { nombre: string; telefono: string; correo: string; documento: string; direccion: string; referencia: string; ciudad: string; notas: string }

// ── Tablas ──────────────────────────────────────────────────────────────
export const EST: Record<EstadoPedido, { t: string; bg: string; fg: string; bar: string }> = {
  pendiente: { t: 'Pendiente', bg: '#ffeb79', fg: '#8a5a00', bar: '#ffb904' },
  confirmado: { t: 'Confirmado', bg: '#e0f7f5', fg: '#00605b', bar: '#2be0d5' },
  enviado: { t: 'Enviado', bg: '#e0f2fe', fg: '#0369a1', bar: '#0ea5e9' },
  entregado: { t: 'Entregado', bg: '#a4ffb6', fg: '#0b5c3f', bar: '#29845a' },
  cancelado: { t: 'Cancelado', bg: '#e3e3e3', fg: '#4b5563', bar: '#c4c4c4' },
  devuelto: { t: 'Devuelto', bg: '#ffe6e5', fg: '#b42318', bar: '#d82c0d' },
};
export const PAGO: Record<EstadoPago, { t: string; corto: string; fg: string; dot: string }> = {
  pendiente: { t: 'Pago pendiente', corto: 'Por cobrar', fg: '#8a5a00', dot: '#ffb904' },
  pagado: { t: 'Pagado', corto: 'Pagado', fg: '#087b5d', dot: '#29845a' },
  reembolsado: { t: 'Reembolsado', corto: 'Reembolsado', fg: '#6b7280', dot: '#9ca3af' },
};
export const CANAL: Record<Canal, { t: string; ic: string; bg: string; fg: string; d: string }> = {
  panel: { t: 'Panel', ic: 'layout-dashboard', bg: '#f1f1f1', fg: '#4b5563', d: 'Lo cargó el equipo' },
  tienda: { t: 'Tienda', ic: 'store', bg: '#fbefd9', fg: '#8a5a00', d: 'Tienda en línea' },
  whatsapp: { t: 'WhatsApp', ic: 'whatsapp', bg: '#e6f6ec', fg: '#087b5d', d: 'Armado desde una conversación' },
};
/** Próximo paso del flujo: [destino, texto del botón, ícono]. */
export const SIGUIENTE: Partial<Record<EstadoPedido, [EstadoPedido, string, string]>> = {
  pendiente: ['confirmado', 'Confirmar', 'check'],
  confirmado: ['enviado', 'Marcar enviado', 'truck-delivery'],
  enviado: ['entregado', 'Marcar entregado', 'package'],
};
/** Las mismas transiciones que acepta el backend (`TRANSICIONES_PEDIDO`). */
export const PUEDE: Record<EstadoPedido, EstadoPedido[]> = {
  pendiente: ['confirmado', 'cancelado'], confirmado: ['enviado', 'cancelado'], enviado: ['entregado', 'cancelado'],
  entregado: ['devuelto'], cancelado: [], devuelto: [],
};
export const ORDEN_FLUJO: EstadoPedido[] = ['pendiente', 'confirmado', 'enviado', 'entregado'];
export const METODOS: MetodoPago[] = ['Efectivo', 'Nequi', 'Daviplata', 'Transferencia', 'Tarjeta', 'Otro'];
/** Tonos de avatar de cliente: id % 6. */
export const TONOS_CLIENTE: [string, string][] = [['#e0f7f5', '#00605b'], ['#fff1d6', '#8a5a00'], ['#eef2ff', '#3730a3'], ['#fce7f3', '#9d174d'], ['#e6f6ec', '#087b5d'], ['#f1f1f1', '#303030']];
export const tonoCliente = (id: number) => TONOS_CLIENTE[id % TONOS_CLIENTE.length];
/** Sello del comprobante: [texto, color]. */
export const SELLO = (p: Pedido): [string, string] =>
  p.estado === 'cancelado' ? ['Anulado', '#c4320a'] : p.estado === 'devuelto' ? ['Devuelto', '#c4320a']
    : ({ pagado: ['Pagado', '#1f7a4d'], pendiente: ['Por cobrar', '#b26b00'], reembolsado: ['Reembolsado', '#6b7280'] } as Record<EstadoPago, [string, string]>)[p.estadoPago];
export const muerto = (p: Pick<Pedido, 'estado'>) => p.estado === 'cancelado' || p.estado === 'devuelto';
export const nuevoDeTienda = (p: Pick<Pedido, 'canal' | 'estado'>) => p.canal === 'tienda' && p.estado === 'pendiente';
