import { CatalogoStore } from './catalogo.store';
import { codigoCompra, dias } from './formato';
import { CompraV5, ProductoV5, ProveedorV5, nivelStock } from './modelos';

// Derivados de Proveedores y Compras.

export const TONOS: [string, string][] = [
  ['#e0f7f5', '#00605b'], ['#fff1d6', '#8a5a00'], ['#eef2ff', '#3730a3'], ['#fce7f3', '#9d174d'], ['#e6f6ec', '#087b5d'], ['#f1f1f1', '#303030'],
];
export const tonoProveedor = (id: number) => TONOS[(id || 0) % TONOS.length];

/** [n.º getDay(), corto, largo] — Lun a Sáb. */
export const DIAS: [number, string, string][] = [
  [1, 'Lun', 'Lunes'], [2, 'Mar', 'Martes'], [3, 'Mié', 'Miércoles'], [4, 'Jue', 'Jueves'], [5, 'Vie', 'Viernes'], [6, 'Sáb', 'Sábado'],
];
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Compra pendiente con ≥ 7 días = "Atrasada". */
export const ATRASO = 7;

export const inicialesDe = (n: string) =>
  (n || '?').split(/\s+/).filter((w) => /^[A-Za-zÁÉÍÓÚÑ]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

export interface Entrega { fecha: Date; k: number; dow: number; texto: string }
/** Próximo día de entrega desde mañana. `null` si no tiene días. */
export function proximaEntrega(diasEntrega: number[], hoy: Date): Entrega | null {
  for (let k = 1; k <= 7; k++) {
    const d = new Date(hoy.getTime() + k * 864e5);
    if (diasEntrega.includes(d.getDay()))
      return { fecha: d, k, dow: d.getDay(), texto: (k === 1 ? 'Mañana' : DIAS.find((x) => x[0] === d.getDay())![2]) + ' ' + d.getDate() + ' ' + MES[d.getMonth()] };
  }
  return null;
}

export interface StatProveedor {
  compras: CompraV5[]; recibidas: CompraV5[]; pendientes: CompraV5[]; canceladas: CompraV5[];
  total: number; ultima: CompraV5 | undefined; diasDesdeUltima: number | null;
}
export function statProveedor(s: CatalogoStore, id: number): StatProveedor {
  const compras = s.compras().filter((c) => c.proveedorId === id);
  const recibidas = compras.filter((c) => c.estado === 'recibida');
  const ultima = compras.filter((c) => c.estado !== 'cancelada').sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  return {
    compras, recibidas,
    pendientes: compras.filter((c) => c.estado === 'pendiente'),
    canceladas: compras.filter((c) => c.estado === 'cancelada'),
    total: recibidas.reduce((t, c) => t + s.totalCompra(c), 0),
    ultima, diasDesdeUltima: ultima ? dias(ultima.fecha, s.hoy()) : null,
  };
}

export interface ProductoDeProveedor { p: ProductoV5; veces: number; unidades: number; actual: number; anterior: number | null; fecha: string; ultimaCantidad: number }
/** Productos que se le han comprado, con último precio y el anterior (para la variación). */
export function productosProveedor(s: CatalogoStore, id: number): ProductoDeProveedor[] {
  const m = new Map<number, Omit<ProductoDeProveedor, 'p'>>();
  s.compras()
    .filter((c) => c.proveedorId === id && c.estado !== 'cancelada')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .forEach((c) => c.items.forEach((it) => {
      const r = m.get(it.productoId);
      m.set(it.productoId, {
        veces: (r?.veces ?? 0) + 1, unidades: (r?.unidades ?? 0) + it.cantidad,
        anterior: r ? r.actual : null, actual: it.precioUnitario, fecha: c.fecha, ultimaCantidad: it.cantidad,
      });
    }));
  return [...m.entries()].map(([pid, r]) => ({ p: s.producto(pid)!, ...r })).filter((x) => x.p);
}

export interface Salud { puntaje: number; nivel: string; tinta: string; anillo: string; tiene: boolean; factores: { etiqueta: string; v: number; texto: string; sub: string }[] }
/** Salud 0–100: 50 % entregas a tiempo · 25 % precios estables · 25 % sin cancelaciones. */
export function saludProveedor(s: CatalogoStore, id: number): Salud {
  const st = statProveedor(s, id);
  const tarde = st.pendientes.filter((c) => dias(c.fecha, s.hoy()) > 5).length;
  const base = st.recibidas.length + tarde;
  const aTiempo = base ? st.recibidas.length / base : 1;
  const pr = productosProveedor(s, id).filter((x) => x.anterior != null);
  const vari = pr.length ? pr.reduce((t, x) => t + Math.abs(x.actual - x.anterior!) / x.anterior!, 0) / pr.length : 0;
  const estable = Math.max(0, 1 - vari / 0.15);
  const sinCan = st.compras.length ? 1 - st.canceladas.length / st.compras.length : 1;
  const puntaje = Math.round((aTiempo * 0.5 + estable * 0.25 + sinCan * 0.25) * 100);
  const [nivel, tinta, anillo] =
    puntaje >= 85 ? ['Excelente', '#087b5d', '#29845a'] : puntaje >= 70 ? ['Bueno', '#303030', '#303030'] : puntaje >= 50 ? ['Regular', '#8a5a00', '#ffb904'] : ['En riesgo', '#b42318', '#d82c0d'];
  const pl = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;
  return {
    puntaje, nivel, tinta, anillo, tiene: st.compras.length > 0,
    factores: [
      { etiqueta: 'Entregas a tiempo', v: aTiempo, texto: Math.round(aTiempo * 100) + ' %', sub: tarde ? pl(tarde, 'compra atrasada', 'compras atrasadas') : 'sin atrasos' },
      { etiqueta: 'Precios estables', v: estable, texto: vari ? (Math.round(vari * 1000) / 10).toString().replace('.', ',') + ' % de variación' : 'sin cambios', sub: pr.length ? pl(pr.length, 'producto comparado', 'productos comparados') : 'una sola compra por producto' },
      { etiqueta: 'Sin cancelaciones', v: sinCan, texto: st.canceladas.length ? pl(st.canceladas.length, 'cancelada', 'canceladas') : 'ninguna', sub: 'de ' + pl(st.compras.length, 'compra', 'compras') },
    ],
  };
}

export type ClaveAccion = 'recibir' | 'reponer' | 'frio' | 'ok';
export interface AccionProveedor { k: ClaveAccion; texto: string; icono: string; fondo: string; tinta: string; compraId?: number; activa: boolean }
/** "Próxima acción" de la fila: Recibir C-00xx · Reponer N · Sin compras hace N d · Al día. */
export function accionProveedor(s: CatalogoStore, p: ProveedorV5): AccionProveedor {
  const st = statProveedor(s, p.id);
  const pend = [...st.pendientes].sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  if (pend) return { k: 'recibir', texto: 'Recibir ' + codigoCompra(pend.id), icono: 'package-import', fondo: '#fff6d1', tinta: '#8a5a00', compraId: pend.id, activa: true };
  const bajos = productosProveedor(s, p.id).filter(
    (x) => x.p.estado !== 'descontinuado' && nivelStock(s.stockDe(x.p.id)) !== 'ok' && !s.enCamino(x.p.id),
  );
  if (p.activo && bajos.length) return { k: 'reponer', texto: 'Reponer ' + bajos.length, icono: 'truck-delivery', fondo: '#ffe6e5', tinta: '#b42318', activa: true };
  if (p.activo && (st.diasDesdeUltima == null || st.diasDesdeUltima >= 30))
    return { k: 'frio', texto: st.diasDesdeUltima == null ? 'Sin compras aún' : 'Sin compras hace ' + st.diasDesdeUltima + ' d', icono: 'zzz', fondo: '#f1f1f1', tinta: '#4b5563', activa: true };
  return { k: 'ok', texto: p.activo ? 'Al día' : 'Inactivo', icono: p.activo ? 'check' : 'player-pause', fondo: 'transparent', tinta: '#9ca3af', activa: false };
}

/** Precio de la compra anterior del mismo producto (para ↑/↓ %). */
export function precioAnterior(s: CatalogoStore, productoId: number, fecha: string, excluirId?: number) {
  const c = s.compras()
    .filter((x) => x.estado !== 'cancelada' && x.id !== excluirId && x.fecha <= fecha && x.items.some((i) => i.productoId === productoId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)[0];
  return c ? { precio: c.items.find((i) => i.productoId === productoId)!.precioUnitario, codigo: codigoCompra(c.id) } : null;
}
export function variacion(s: CatalogoStore, productoId: number, precio: number, fecha: string, excluirId?: number) {
  const a = precioAnterior(s, productoId, fecha, excluirId);
  if (!a || !precio || a.precio === precio) return null;
  const r = (precio - a.precio) / a.precio;
  return { texto: (r > 0 ? '↑ ' : '↓ ') + Math.abs(Math.round(r * 100)) + ' %', tinta: r > 0 ? '#b42318' : '#087b5d', fondo: r > 0 ? '#fff1f0' : '#e6f6ec', anterior: a };
}
