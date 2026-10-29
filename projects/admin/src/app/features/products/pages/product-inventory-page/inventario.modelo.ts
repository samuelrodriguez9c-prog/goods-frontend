import { PlanReposicionApi } from '../../../../core/inventario/inventario.service';
import { CatalogoStore } from '../../shared/catalogo.store';
import { codigoCompra } from '../../shared/formato';
import { Categoria, CompraV5, ProductoV5, ProveedorV5, Stock, TipoMovimiento } from '../../shared/modelos';

/** Estado del stock de un producto frente a su mínimo. */
export type Nivel = 'sin' | 'bajo' | 'ok';
/** Métrica de la franja que filtra la lista. */
export type Metrica = 'disp' | 'res' | 'bajo' | 'sin' | 'valor';
export type Agrupacion = 'estado' | 'categoria' | 'proveedor';
export type PestanaInventario = 'resumen' | 'movimientos' | 'compras';
export type Signo = '+' | '-';
export type FiltroMovimientos = 'todos' | TipoMovimiento;
export type RangoMovimientos = '7' | '30' | '90' | 'todo';

/** Borrador del ajuste de stock de la pestaña Resumen. */
export interface Ajuste {
  productoId: number;
  signo: Signo;
  /** Lo que escribió (solo dígitos). */
  cantidad: string;
  motivo: string;
  /** Texto libre cuando el motivo es "Otro". */
  otro?: string;
}

export const nivelDe = (s: Stock): Nivel => (s.disponible <= 0 ? 'sin' : s.disponible < s.minimo ? 'bajo' : 'ok');
export const soloDigitos = (v: unknown) => String(v ?? '').replace(/[^\d]/g, '');
export const ajusteVacio = (productoId: number): Ajuste => ({ productoId, signo: '+', cantidad: '', motivo: 'Conteo físico' });
/** Unidades que suma (o resta) el ajuste. */
export const deltaAjuste = (a: Ajuste) => (+soloDigitos(a.cantidad) || 0) * (a.signo === '+' ? 1 : -1);
/** Motivo tal como se guarda ("Otro" usa el texto libre). */
export const motivoDe = (a: Ajuste) => (a.motivo === 'Otro' ? (a.otro || '').trim() || 'Otro' : a.motivo);

/** Título e ícono de cada nivel; fondo y tinta son los del ícono de grupo. */
export const NIVELES: Record<Nivel, { titulo: string; icono: string; fondo: string; tinta: string }> = {
  sin: { titulo: 'Sin stock', icono: 'circle-x', fondo: '#ffe6e5', tinta: '#b42318' },
  bajo: { titulo: 'Bajo el mínimo', icono: 'alert-triangle', fondo: '#fff6d1', tinta: '#8a5a00' },
  ok: { titulo: 'Stock al día', icono: 'circle-check', fondo: '#e6f6ec', tinta: '#087b5d' },
};

export const TIPOS_MOVIMIENTO: Record<TipoMovimiento, { titulo: string; icono: string }> = {
  entrada: { titulo: 'Entrada', icono: 'arrow-down-left' },
  salida: { titulo: 'Salida', icono: 'arrow-up-right' },
  ajuste: { titulo: 'Ajuste', icono: 'adjustments' },
};
/** Tipo conocido (lo que no se reconoce se muestra como ajuste). */
export const tipoDe = (t: string): TipoMovimiento => (t in TIPOS_MOVIMIENTO ? (t as TipoMovimiento) : 'ajuste');

export const MOTIVOS: Record<Signo, { nombre: string; icono: string; detalle: string }[]> = {
  '+': [
    { nombre: 'Conteo físico', icono: 'clipboard-check', detalle: 'El conteo dio más de lo registrado' },
    { nombre: 'Devolución', icono: 'arrow-back-up', detalle: 'Un cliente devolvió el producto' },
    { nombre: 'Producción', icono: 'tools-kitchen-2', detalle: 'Se elaboró en el local' },
    { nombre: 'Otro', icono: 'pencil', detalle: 'Escribe el motivo' },
  ],
  '-': [
    { nombre: 'Conteo físico', icono: 'clipboard-check', detalle: 'El conteo dio menos' },
    { nombre: 'Merma', icono: 'trending-down', detalle: 'Pérdida normal del día' },
    { nombre: 'Daño', icono: 'alert-octagon', detalle: 'Se rompió o se dañó' },
    { nombre: 'Vencido', icono: 'calendar-x', detalle: 'Pasó su fecha de consumo' },
    { nombre: 'Regalo', icono: 'gift', detalle: 'Degustación o cortesía' },
    { nombre: 'Otro', icono: 'pencil', detalle: 'Escribe el motivo' },
  ],
};

/** Escala de las barras de stock: el doble del mínimo (o lo disponible, si es más). */
export const escalaStock = (s: Stock) => Math.max(s.minimo * 2, s.disponible, 1);

/** Miniatura de un producto: su primera imagen, el ícono de su categoría o la inicial. */
export type Miniatura =
  | { tipo: 'imagen'; url: string }
  | { tipo: 'icono'; icono: string; fondo: string; tinta: string }
  | { tipo: 'inicial'; letra: string };

export function categoriaRaiz(catalogo: CatalogoStore, id: number | null): Categoria | undefined {
  let c = catalogo.categoria(id);
  while (c?.categoriaPadreId) c = catalogo.categoria(c.categoriaPadreId);
  return c;
}

export function miniaturaDe(p: ProductoV5, catalogo: CatalogoStore): Miniatura {
  const imagen = [...(p.imagenes || [])].sort((a, b) => a.orden - b.orden)[0];
  if (imagen?.url) return { tipo: 'imagen', url: imagen.url };
  if (imagen) {
    const raiz = categoriaRaiz(catalogo, p.categoriaId);
    const [fondo, tinta, icono] = raiz ? catalogo.tono(raiz.id) : ['#f1f1f1', '#6b7280', 'photo'];
    return { tipo: 'icono', icono, fondo, tinta };
  }
  return { tipo: 'inicial', letra: ((p.nombre || '?').trim()[0] || '?').toUpperCase() };
}

/** Última compra no cancelada que trajo el producto. */
export const ultimaCompra = (catalogo: CatalogoStore, productoId: number): CompraV5 | null =>
  catalogo
    .compras()
    .filter((c) => c.estado !== 'cancelada' && c.items.some((it) => it.productoId === productoId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null;

export interface LineaReponer {
  producto: ProductoV5;
  stock: Stock;
  cantidad: number;
  precio: number;
  /** Del plan del backend: por qué y qué tan urgente (el cálculo local no los tiene). */
  motivo?: string;
  urgencia?: 'agotado' | 'urgente' | 'pronto';
}
export interface PlanReponer {
  /** Una compra pendiente por proveedor (el de la última compra de cada producto). */
  grupos: { proveedorId: number; proveedor: ProveedorV5 | undefined; lineas: LineaReponer[] }[];
  /** Nunca comprados: no sabemos a quién pedirlos. */
  sinProveedor: ProductoV5[];
  /** Ya vienen en una compra pendiente (códigos C-0042). */
  enCamino: { producto: ProductoV5; compras: string[] }[];
  /** Tiempo de entrega por proveedor, en palabras (solo con el plan del backend). */
  entregas?: Record<number, string>;
  /** «Las ventas vienen subiendo cerca de 20 % al mes…» (solo con el plan del backend). */
  tendencia?: { texto: string; sube: boolean } | null;
}

/**
 * El plan del backend (ritmo de venta, tiempo de entrega de cada proveedor y
 * compras pendientes) con los productos del catálogo, para el modal. Sin
 * permiso de costos, el precio de cada línea es el de su última compra.
 */
export function planDesdeApi(api: PlanReposicionApi, catalogo: CatalogoStore): PlanReponer {
  const producto = (id: number) => catalogo.mapaProductos().get(id);
  const plan: PlanReponer = { grupos: [], sinProveedor: [], enCamino: [], entregas: {}, tendencia: api.tendencia ? { texto: api.tendencia.texto, sube: api.tendencia.cambioMensual > 0 } : null };
  for (const g of api.grupos) {
    if (!g.proveedor) {
      plan.sinProveedor.push(...g.lineas.map((l) => producto(l.productoId)).filter((p): p is ProductoV5 => !!p));
      continue;
    }
    const lineas = g.lineas.flatMap((l) => {
      const p = producto(l.productoId);
      if (!p) return [];
      const precio = l.costoUnitario ?? ultimaCompra(catalogo, p.id)?.items.find((it) => it.productoId === p.id)?.precioUnitario ?? p.costo ?? 0;
      return [{ producto: p, stock: catalogo.stockDe(p.id), cantidad: l.sugerido, precio, motivo: l.motivo, urgencia: l.urgencia }];
    });
    if (lineas.length) plan.grupos.push({ proveedorId: g.proveedor.id, proveedor: catalogo.proveedor(g.proveedor.id), lineas });
    plan.entregas![g.proveedor.id] = `Entrega en unos ${g.tiempoEntregaDias} días · ${g.tiempoEntregaFuente}`;
  }
  plan.enCamino = api.cubiertosPorCompras.flatMap((c) => {
    const p = producto(c.productoId);
    return p ? [{ producto: p, compras: c.compras }] : [];
  });
  return plan;
}

/**
 * Respaldo si el plan del backend no llega (sin red o un backend anterior):
 * lo que está bajo el mínimo, hasta el doble del mínimo, al último precio.
 */
export function planReponer(catalogo: CatalogoStore): PlanReponer {
  const grupos = new Map<number, LineaReponer[]>();
  const plan: PlanReponer = { grupos: [], sinProveedor: [], enCamino: [] };
  for (const producto of catalogo.productos()) {
    const stock = catalogo.stockDe(producto.id);
    if (producto.estado === 'descontinuado' || nivelDe(stock) === 'ok' || stock.minimo <= 0) continue;
    const pendiente = catalogo.compras().find((c) => c.estado === 'pendiente' && c.items.some((it) => it.productoId === producto.id));
    if (pendiente) {
      plan.enCamino.push({ producto, compras: [codigoCompra(pendiente.id)] });
      continue;
    }
    const ultima = ultimaCompra(catalogo, producto.id);
    if (!ultima) {
      plan.sinProveedor.push(producto);
      continue;
    }
    const item = ultima.items.find((it) => it.productoId === producto.id)!;
    const linea = { producto, stock, cantidad: Math.max(stock.minimo * 2 - stock.disponible, 1), precio: item.precioUnitario };
    grupos.set(ultima.proveedorId, [...(grupos.get(ultima.proveedorId) ?? []), linea]);
  }
  plan.grupos = [...grupos].map(([proveedorId, lineas]) => ({ proveedorId, proveedor: catalogo.proveedor(proveedorId), lineas }));
  return plan;
}
