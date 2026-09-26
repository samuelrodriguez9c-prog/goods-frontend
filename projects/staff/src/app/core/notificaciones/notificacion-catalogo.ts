// projects/staff/src/app/core/notificaciones/notificacion-catalogo.ts
//
// Categoría, ícono, etiqueta, acción y destino por tipo — lo comparten la
// campanita (`TopbarComponent`) y la página (`NotificacionesPageComponent`)
// — LEEME §17, 2026-09-24.
import {
  IconBuildingPlus,
  IconBuildingStore,
  IconCalendarDue,
  IconCircleCheck,
  IconClock,
  IconCreditCardOff,
  IconHeadset,
  IconMessage,
  IconMessageCirclePlus,
  IconReceipt,
  IconUserCheck,
} from '@tabler/icons-angular';
import { Notificacion, TipoNotificacion } from './models/notificacion.model';

export type CategoriaNotificacion = 'soporte' | 'empresas' | 'suscripciones' | 'otras';

export const CATEGORIAS: Record<
  CategoriaNotificacion,
  { texto: string; icono: typeof IconHeadset; fondo: string; tinta: string; trazo: string }
> = {
  soporte: { texto: 'Soporte', icono: IconHeadset, fondo: '#e0f0ff', tinta: '#075985', trazo: '#075985' },
  empresas: { texto: 'Empresas', icono: IconBuildingStore, fondo: '#eaf4ec', tinta: '#0c5132', trazo: '#0c5132' },
  suscripciones: { texto: 'Suscripciones', icono: IconReceipt, fondo: '#fff1e3', tinta: '#9a3412', trazo: '#9a3412' },
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

const conv = (d: Record<string, unknown>) => ({
  url: '/soporte',
  query: d['conversacionId'] ? { conversacion: d['conversacionId'] } : undefined,
  destino: 'Soporte' + (d['clienteNombre'] ? ' · ' + d['clienteNombre'] : ''),
});

export const TIPOS: Record<TipoNotificacion, DefTipo> = {
  conversacion_solicitada: {
    cat: 'soporte',
    etiqueta: 'Nueva conversación',
    icono: IconMessageCirclePlus,
    accion: 'Abrir conversación',
    ruta: conv,
    accionable: true,
  },
  conversacion_sin_asignar: {
    cat: 'soporte',
    etiqueta: 'Sin asignar',
    icono: IconClock,
    accion: 'Tomar conversación',
    ruta: conv,
    accionable: true,
  },
  conversacion_asignada: { cat: 'soporte', etiqueta: 'Asignada', icono: IconUserCheck, accion: 'Ver conversación', ruta: conv },
  conversacion_cerrada: { cat: 'soporte', etiqueta: 'Resuelta', icono: IconCircleCheck, accion: 'Ver historial', ruta: conv },
  empresa_registrada: {
    cat: 'empresas',
    etiqueta: 'Alta nueva',
    icono: IconBuildingPlus,
    accion: 'Revisar alta',
    ruta: () => ({ url: '/altas-pendientes', destino: 'Altas pendientes' }),
    accionable: true,
  },
  empresa_estado_cambio: {
    cat: 'empresas',
    etiqueta: 'Cambio de estado',
    icono: IconBuildingStore,
    accion: 'Ver Empresa',
    ruta: (d) => ({
      url: '/empresas',
      query: d['empresaId'] ? { empresa: d['empresaId'] } : undefined,
      destino: 'Empresas' + (d['empresaNombre'] ? ' · ' + d['empresaNombre'] : ''),
    }),
  },
  plan_por_vencer: {
    cat: 'suscripciones',
    etiqueta: 'Por vencer',
    icono: IconCalendarDue,
    accion: 'Ver suscripción',
    ruta: () => ({ url: '/suscripciones', destino: 'Suscripciones' }),
  },
  plan_pago_vencido: {
    cat: 'suscripciones',
    etiqueta: 'Pago vencido',
    icono: IconCreditCardOff,
    accion: 'Ver suscripción',
    ruta: () => ({ url: '/suscripciones', destino: 'Suscripciones' }),
    accionable: true,
  },
  // Categoría cliente: /notificaciones/staff no debería devolver nunca
  // estos tipos — se tipan igual para no romper si el backend cambia.
  pedido_estado: { cat: 'otras', etiqueta: 'Pedido', icono: IconMessage, accion: 'Ver', ruta: () => ({ url: '/notificaciones', destino: 'Notificaciones' }) },
  pago_estado: { cat: 'otras', etiqueta: 'Pago', icono: IconCreditCardOff, accion: 'Ver', ruta: () => ({ url: '/notificaciones', destino: 'Notificaciones' }) },
  stock_bajo: { cat: 'otras', etiqueta: 'Stock bajo', icono: IconMessage, accion: 'Ver', ruta: () => ({ url: '/notificaciones', destino: 'Notificaciones' }) },
  mensaje_chat: { cat: 'otras', etiqueta: 'Mensaje de chat', icono: IconMessage, accion: 'Ver', ruta: () => ({ url: '/notificaciones', destino: 'Notificaciones' }) },
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
