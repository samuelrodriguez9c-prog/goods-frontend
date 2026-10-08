// projects/admin/src/app/core/notificaciones/notificacion-catalogo.ts
//
// Categoría, ícono, etiqueta, acción y destino por tipo — lo comparten la
// campanita (`TopbarComponent`) y la página (`NotificacionesPageComponent`).
// Calcado de `staff` (2026-10-07) con las categorías del cliente.
import {
  IconAlertTriangle,
  IconBulb,
  IconCalendarDue,
  IconCircleCheck,
  IconCreditCardOff,
  IconHeadset,
  IconMessage,
  IconPackage,
  IconReceipt,
  IconShoppingBag,
  IconUserCheck,
  IconUserCircle,
} from '@tabler/icons-angular';
import { Notificacion, TipoNotificacion } from './models/notificacion.model';

export type CategoriaNotificacion = 'soporte' | 'tienda' | 'cuenta' | 'otras';

export const CATEGORIAS: Record<
  CategoriaNotificacion,
  { texto: string; icono: typeof IconHeadset; fondo: string; tinta: string; trazo: string }
> = {
  soporte: { texto: 'Soporte', icono: IconHeadset, fondo: '#e0f0ff', tinta: '#075985', trazo: '#075985' },
  tienda: { texto: 'Tienda', icono: IconShoppingBag, fondo: '#eaf4ec', tinta: '#0c5132', trazo: '#0c5132' },
  cuenta: { texto: 'Cuenta', icono: IconUserCircle, fondo: '#fff1e3', tinta: '#9a3412', trazo: '#9a3412' },
  otras: { texto: 'Otras', icono: IconMessage, fondo: '#f1f1f1', tinta: '#4b5563', trazo: '#9ca3af' },
};

interface DefTipo {
  cat: CategoriaNotificacion;
  etiqueta: string;
  icono: typeof IconHeadset;
  accion: string;
  /** Ruta + query a partir de `datos`. `destino` es el texto de la Pista. */
  ruta: (d: Record<string, unknown>) => { url: string; query?: Record<string, unknown>; destino: string };
  /** Pide que alguien haga algo (cuenta para "N piden que hagas algo"). */
  accionable?: boolean;
}

const chat = () => ({ url: '/messages', destino: 'Messages' });
const pedido = (d: Record<string, unknown>) =>
  d['pedidoId'] ? { url: `/orders/${d['pedidoId']}`, destino: `Orders · #${d['pedidoId']}` } : { url: '/orders', destino: 'Orders' };
const cuenta = () => ({ url: '/', destino: 'Dashboard' });
const otra = () => ({ url: '/notificaciones', destino: 'Notificaciones' });

export const TIPOS: Record<TipoNotificacion, DefTipo> = {
  mensaje_chat: { cat: 'soporte', etiqueta: 'Mensaje', icono: IconMessage, accion: 'Ver conversación', ruta: chat, accionable: true },
  conversacion_asignada: { cat: 'soporte', etiqueta: 'Te atienden', icono: IconUserCheck, accion: 'Ver conversación', ruta: chat },
  conversacion_cerrada: { cat: 'soporte', etiqueta: 'Resuelta', icono: IconCircleCheck, accion: 'Ver historial', ruta: chat },
  solicitud_actualizada: {
    cat: 'soporte',
    etiqueta: 'Solicitud',
    icono: IconBulb,
    accion: 'Ver solicitud',
    ruta: (d) => ({ url: '/settings/solicitudes', query: d['solicitudId'] ? { id: d['solicitudId'] } : undefined, destino: 'Solicitudes a Goods' }),
  },
  pedido_estado: { cat: 'tienda', etiqueta: 'Pedido', icono: IconPackage, accion: 'Ver pedido', ruta: pedido },
  pago_estado: { cat: 'tienda', etiqueta: 'Pago', icono: IconReceipt, accion: 'Ver pedido', ruta: pedido },
  stock_bajo: {
    cat: 'tienda',
    etiqueta: 'Stock bajo',
    icono: IconAlertTriangle,
    accion: 'Ver inventario',
    ruta: () => ({ url: '/products/inventario', destino: 'Inventario' }),
    accionable: true,
  },
  plan_por_vencer: { cat: 'cuenta', etiqueta: 'Por vencer', icono: IconCalendarDue, accion: 'Ver mi cuenta', ruta: cuenta, accionable: true },
  plan_pago_vencido: { cat: 'cuenta', etiqueta: 'Pago vencido', icono: IconCreditCardOff, accion: 'Ver mi cuenta', ruta: cuenta, accionable: true },
  // Tipos de staff: /notificaciones nunca debería devolverlos a una
  // Empresa — se tipan igual para no romper si el backend cambia.
  empresa_registrada: { cat: 'otras', etiqueta: 'Aviso', icono: IconMessage, accion: 'Ver', ruta: otra },
  empresa_estado_cambio: { cat: 'cuenta', etiqueta: 'Tu cuenta', icono: IconUserCircle, accion: 'Ver mi cuenta', ruta: cuenta },
  conversacion_solicitada: { cat: 'otras', etiqueta: 'Aviso', icono: IconMessage, accion: 'Ver', ruta: otra },
  conversacion_sin_asignar: { cat: 'otras', etiqueta: 'Aviso', icono: IconMessage, accion: 'Ver', ruta: otra },
  solicitud_nueva: { cat: 'otras', etiqueta: 'Aviso', icono: IconMessage, accion: 'Ver', ruta: otra },
  seguridad_reporte: { cat: 'otras', etiqueta: 'Aviso', icono: IconMessage, accion: 'Ver', ruta: otra },
  alta_mensaje: { cat: 'otras', etiqueta: 'Aviso', icono: IconMessage, accion: 'Ver', ruta: otra },
};

export function defTipo(tipo: TipoNotificacion): DefTipo {
  return TIPOS[tipo] ?? TIPOS.mensaje_chat;
}
/** Fila lista para pintar — misma forma en la campanita y en la página. */
export function filaNotificacion(n: Notificacion) {
  const t = defTipo(n.tipo);
  const c = CATEGORIAS[t.cat];
  const leida = !!n.leidaEn;
  return {
    n,
    leida,
    cat: t.cat,
    etiqueta: t.etiqueta,
    icono: t.icono,
    accion: t.accion,
    iconoFondo: leida ? '#f1f1f1' : c.fondo,
    iconoTinta: leida ? '#8a8a8a' : c.tinta,
    destino: t.ruta(n.datos ?? {}),
  };
}

/** "Hoy", "Ayer", "martes", "12 de septiembre". */
export function tituloDia(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const dif = Math.round((new Date(hoy.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (dif === 0) return 'Hoy';
  if (dif === 1) return 'Ayer';
  if (dif < 7) return d.toLocaleDateString('es-CO', { weekday: 'long' });
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

export function agruparPorDia<T extends { n: Notificacion }>(filas: T[]): { titulo: string; items: T[] }[] {
  const grupos: { titulo: string; items: T[] }[] = [];
  for (const f of filas) {
    const t = tituloDia(f.n.creadoEn);
    let g = grupos.find((x) => x.titulo === t);
    if (!g) {
      g = { titulo: t, items: [] };
      grupos.push(g);
    }
    g.items.push(f);
  }
  return grupos;
}
