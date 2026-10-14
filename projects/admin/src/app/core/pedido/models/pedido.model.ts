// Espejo de `Pedido`, `PedidoItem` y `PedidoEvento` del backend
// (`negocio/pedido`, PROPUESTA_PEDIDOS_Y_CLIENTES.md §3.2). Los montos
// llegan como string decimal ("45000.00"): convertir con Number() al mostrar.

import { Cliente, DireccionCliente, GuardarClientePayload } from '../../cliente/models/cliente.model';

export type EstadoPedido = 'pendiente' | 'confirmado' | 'enviado' | 'entregado' | 'cancelado' | 'devuelto';
export type EstadoPagoPedido = 'pendiente' | 'pagado' | 'reembolsado';
export type CanalPedido = 'panel' | 'tienda' | 'whatsapp';
export type TipoEventoPedido = 'creado' | 'estado' | 'pago' | 'editado' | 'nota';

/** Transiciones que acepta el backend (fuera de esto responde 409). */
export const TRANSICIONES_PEDIDO: Record<EstadoPedido, EstadoPedido[]> = {
  pendiente: ['confirmado', 'cancelado'],
  confirmado: ['enviado', 'cancelado'],
  enviado: ['entregado', 'cancelado'],
  entregado: ['devuelto'],
  cancelado: [],
  devuelto: [],
};

export interface UsuarioResumen {
  id: number;
  nombres: string;
  apellidos: string;
}

export interface PedidoItem {
  id: number;
  pedidoId: number;
  productoId: number;
  /** Nombre al momento de la venta (snapshot). */
  productoNombre: string;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
  /** Solo en el detalle: nombre de hoy, SKU y foto principal. */
  producto?: { id: number; nombre: string; sku: string | null; imagenUrl: string | null };
}

export interface PedidoEvento {
  id: number;
  pedidoId: number;
  tipo: TipoEventoPedido;
  detalle: string;
  datos: Record<string, unknown> | null;
  usuarioId: number | null;
  usuario: UsuarioResumen | null;
  creadoEn: string;
}

export interface PagoDePedido {
  id: number;
  monto: string;
  moneda: string;
  metodoPago: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'reembolsado';
  fechaPago: string | null;
  creadoEn: string;
}

export interface DireccionEnvio extends DireccionCliente {
  telefono?: string | null;
}

export interface Pedido {
  id: number;
  empresaId: number;
  numero: number;
  clienteId: number;
  cliente: Cliente;
  canal: CanalPedido;
  stockReservado: boolean;
  estado: EstadoPedido;
  estadoPago: EstadoPagoPedido;
  subtotal: string;
  costoEnvio: string;
  descuento: string;
  total: string;
  metodoPago: string | null;
  direccionEnvio: DireccionEnvio | null;
  notas: string | null;
  canceladoEn: string | null;
  motivoCancelacion: string | null;
  creadoPorId: number | null;
  whatsappConversacionId: number | null;
  items: PedidoItem[];
  creadoEn: string;
  actualizadoEn: string;
}

/** `GET /pedidos/:id`: con línea de tiempo, pagos y código de descuento. */
export interface DetallePedido extends Pedido {
  creadoPor: UsuarioResumen | null;
  eventos: PedidoEvento[];
  pagos: PagoDePedido[];
  codigoDescuento: string | null;
}

export interface ResumenPedidos {
  cantidad: number;
  vendido: number;
  porEstado: Partial<Record<EstadoPedido, number>>;
  porCanal: Partial<Record<CanalPedido, number>>;
  porEstadoPago: Partial<Record<EstadoPagoPedido, number>>;
  /** Pedidos de la tienda esperando que alguien los confirme. */
  tiendaPorConfirmar: number;
}

export interface FiltroPedidos {
  estado?: EstadoPedido;
  estadoPago?: EstadoPagoPedido;
  canal?: CanalPedido;
  clienteId?: number;
  /** Número (#1023), nombre o celular del cliente. */
  buscar?: string;
  /** YYYY-MM-DD (inclusive). */
  desde?: string;
  hasta?: string;
  page?: number;
  pageSize?: number;
}

export interface LineaPedidoPayload {
  productoId: number;
  cantidad: number;
}

export interface CrearPedidoPayload {
  /** Uno de los dos: cliente existente o uno nuevo. */
  clienteId?: number;
  clienteNuevo?: GuardarClientePayload;
  items: LineaPedidoPayload[];
  direccionEnvio?: DireccionEnvio | null;
  costoEnvio?: number;
  codigoDescuento?: string | null;
  metodoPago?: string | null;
  notas?: string | null;
  canal?: 'panel' | 'whatsapp';
  whatsappConversacionId?: number;
}

/** Solo mientras está pendiente. */
export interface ActualizarPedidoPayload {
  clienteId?: number;
  items?: LineaPedidoPayload[];
  direccionEnvio?: DireccionEnvio | null;
  costoEnvio?: number;
  metodoPago?: string | null;
  notas?: string | null;
}
