// Espejo de `Cliente` y de lo que calculan `GET /clientes` y `GET /clientes/:id`.

import type { Atributos } from '../../campos/campo-personalizado.model';

export interface DireccionCliente {
  direccion: string;
  referencia?: string | null;
  ciudad?: string | null;
}

export interface Cliente {
  id: number;
  empresaId: number;
  nombre: string;
  /** Solo dígitos, con indicativo (573001234567). */
  telefono: string | null;
  correo: string | null;
  documento: string | null;
  direccion: DireccionCliente | null;
  notas: string | null;
  whatsappContactoId: number | null;
  archivadoEn: string | null;
  creadoEn: string;
  actualizadoEn: string;
  cantidadPedidos: number;
  /** Suma de los pedidos que no están cancelados ni devueltos. */
  totalGastado: number;
  ultimoPedidoEn: string | null;
  /** Viene del contacto de WhatsApp vinculado (solo lectura). */
  aceptaPromociones: boolean;
  /** Campos propios de la Empresa, por clave. */
  atributos?: Atributos;
}

export interface PedidoDeCliente {
  id: number;
  numero: number;
  estado: string;
  estadoPago: string;
  canal: string;
  total: number;
  creadoEn: string;
}

/** Ficha (`GET /clientes/:id`): el cliente con sus últimos 10 pedidos. */
export interface FichaCliente extends Cliente {
  ultimosPedidos: PedidoDeCliente[];
}

export type OrdenClientes = 'recientes' | 'nombre' | 'gastado' | 'pedidos';

export interface FiltroClientes {
  buscar?: string;
  orden?: OrdenClientes;
  archivados?: boolean;
  page?: number;
  pageSize?: number;
}

export interface GuardarClientePayload {
  nombre: string;
  /** Campos propios; `null` quita el valor. */
  atributos?: Record<string, string | number | boolean | string[] | null>;
  telefono?: string | null;
  correo?: string | null;
  documento?: string | null;
  direccion?: DireccionCliente | null;
  notas?: string | null;
}
