// Fila de lista unificada (Pedidos, Clientes y los módulos de Products).
// Son campos OPCIONALES de `FilaModulo` (modelos.ts): una fila sin
// `segmentos` sigue usando `sub` como antes.

import type { Cliente, Pedido } from '../../orders/shared/ventas.modelos';

export type Tono = readonly [fondo: string, tinta: string];

export interface EtiquetaFila {
  texto: string;
  /** Nombre Tabler para `app-ic` (sin «ti-»). */
  icono?: string;
  /** Fondo y tinta; sin tono = neutra (#e8e8e8 / #4b5563, #f4f4f4 resaltada). */
  tono?: Tono;
  /** SKU, slug, NIT: IBM Plex Mono 10.5 px #6b7280. */
  mono?: boolean;
}

export interface SegmentoSub {
  texto: string;
  icono?: string;
  mono?: boolean;
}

export interface InsigniaFila {
  icono: string;
  fondo: string;
  tinta: string;
  tip: string;
}

/** Acción que aparece al pasar el cursor (reemplaza la columna derecha). */
export interface AccionFila {
  /** Verbo corto, ≤ 9 caracteres: «Recibir», «Confirmar», «Vender». */
  verbo: string;
  /** Qué pasa, ≤ 14 caracteres: «aparta stock», «C-0014», «+4 líneas». */
  nota: string;
  icono: string;
  /** Tooltip / aria-label con la frase completa. */
  titulo: string;
  /** `fuerte` = círculo #303030 (lo urgente); `suave` = blanco con borde. */
  peso: 'fuerte' | 'suave';
}

export interface FilaExtra {
  /** Burbuja de 18 px en la esquina de la miniatura (estado). */
  insignia?: InsigniaFila | null;
  /** Miniatura redonda (personas). */
  redonda?: boolean;
  /** Texto gris en la línea del nombre («En Panes»). */
  nombreGris?: string;
  estrella?: boolean;
  /** Subtítulo gris 12/16 bajo el nombre; el último segmento se trunca. */
  segmentos?: SegmentoSub[];
  /** Máx. 2. Lo que ya dice el grupo (estado) no se repite. */
  etiquetas?: EtiquetaFila[];
  valorSub?: string;
  valorSubColor?: string;
  /** Barra de 40 × 4 bajo el valor. `m` = marca del mínimo (0–100 %). */
  medidor?: { w: number; c: string; m?: number } | null;
  accion?: AccionFila | null;
}

// Tonos
export const T = {
  ok: ['#dcfce7', '#0b5c3f'] as Tono,
  okWa: ['#e6f6ec', '#087b5d'] as Tono,
  aviso: ['#fff6d1', '#8a5a00'] as Tono,
  mal: ['#ffe6e5', '#b42318'] as Tono,
  gris: ['#e3e3e3', '#4b5563'] as Tono,
  azul: ['#e0f2fe', '#075985'] as Tono,
  turquesa: ['#e0f7f5', '#00605b'] as Tono,
};

export const insignia = (icono: string, t: Tono, tip: string): InsigniaFila => ({
  icono,
  fondo: t[0],
  tinta: t[1],
  tip,
});

/** Iniciales de un nombre propio: «Laura Méndez» → «LM». */
export function iniciales(s: string): string {
  const ws = s.trim().split(/\s+/).filter(Boolean);
  return (
    ws
      .filter((w) => /^[A-ZÁÉÍÓÚÑ0-9]/.test(w))
      .slice(0, 2)
      .map((w) => w[0])
      .join('') || (ws[0]?.[0] ?? '?').toUpperCase()
  );
}

// Pedidos

/** Insignia de cada estado (los tonos de `EST`). */
const INS_PEDIDO: Record<string, [string, Tono, string]> = {
  pendiente: ['clock', ['#ffeb79', '#8a5a00'], 'Por confirmar'],
  confirmado: ['check', ['#e0f7f5', '#00605b'], 'Confirmado'],
  enviado: ['truck-delivery', ['#e0f2fe', '#0369a1'], 'En camino'],
  entregado: ['package', ['#a4ffb6', '#0b5c3f'], 'Entregado'],
  cancelado: ['x', ['#e3e3e3', '#4b5563'], 'Cancelado'],
  devuelto: ['arrow-back-up', ['#ffe6e5', '#b42318'], 'Devuelto'],
};
const CANAL_IC: Record<string, string> = {
  tienda: 'building-store',
  whatsapp: 'brand-whatsapp',
  panel: 'layout-dashboard',
};
const CANAL_T: Record<string, string> = { tienda: 'Tienda', whatsapp: 'WhatsApp', panel: 'Panel' };
const PASO: Record<string, [string, string, string]> = {
  pendiente: ['Confirmar', 'aparta stock', 'check'],
  confirmado: ['Enviar', 'ya salió', 'truck-delivery'],
  enviado: ['Entregar', 'ya llegó', 'package'],
};

export function extraPedido(p: Pedido): FilaExtra {
  const n = p.items.reduce((a, l) => a + l.cantidad, 0);
  const pago: EtiquetaFila =
    p.estadoPago === 'pagado'
      ? { texto: 'Pagado', icono: 'check', tono: T.okWa }
      : p.estadoPago === 'pendiente'
        ? { texto: 'Por cobrar', icono: 'cash', tono: T.aviso }
        : { texto: 'Reembolsado', icono: 'receipt-refund' };
  const sg = PASO[p.estado];
  const [ic, tono, tip] = INS_PEDIDO[p.estado];
  return {
    redonda: true,
    insignia: insignia(ic, tono, tip),
    segmentos: [
      { texto: `#${p.numero} · ${n} ${n === 1 ? 'producto' : 'productos'}` },
      { texto: CANAL_T[p.canal], icono: CANAL_IC[p.canal] },
    ],
    etiquetas: [pago],
    accion: sg
      ? { verbo: sg[0], nota: sg[1], icono: sg[2], titulo: `${sg[0]} el pedido #${p.numero}`, peso: 'fuerte' }
      : null,
  };
}

// Clientes

/** Celular con indicativo, en bloques: «+57 310 555 0142». */
export function celular(t: string): string {
  return t ? '+' + t.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3 $4') : '';
}

export function extraCliente(c: Cliente, nuevo: boolean): FilaExtra {
  const tag: EtiquetaFila | null = c.archivadoEn
    ? { texto: 'Archivado', icono: 'archive' }
    : !c.correo
      ? { texto: 'Sin correo', icono: 'mail-off', tono: T.aviso }
      : nuevo
        ? { texto: 'Primer pedido', icono: 'sparkles', tono: T.azul }
        : c.aceptaPromociones
          ? { texto: 'Acepta promociones', icono: 'speakerphone', tono: T.turquesa }
          : c.whatsappContactoId
            ? { texto: 'WhatsApp', icono: 'brand-whatsapp', tono: T.okWa }
            : null;
  const ciudad = c.direccion?.ciudad?.trim();
  return {
    redonda: true,
    insignia: c.archivadoEn
      ? insignia('archive', T.gris, 'Archivado')
      : nuevo
        ? insignia('sparkles', T.azul, 'Nuevo')
        : insignia('check', T.ok, 'Activo'),
    segmentos: [
      { texto: celular(c.telefono) || 'Sin celular' },
      ...(ciudad ? [{ texto: ciudad, icono: 'map-pin' }] : []),
    ],
    etiquetas: tag ? [tag] : [],
    accion: c.archivadoEn
      ? { verbo: 'Activar', nota: 'desarchivar', icono: 'archive-off', titulo: `Desarchivar a ${c.nombre}`, peso: 'suave' }
      : { verbo: 'Vender', nota: 'nuevo pedido', icono: 'file-plus', titulo: `Crear un pedido para ${c.nombre}`, peso: 'fuerte' },
  };
}
