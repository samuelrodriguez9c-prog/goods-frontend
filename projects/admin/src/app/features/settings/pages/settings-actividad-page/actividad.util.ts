import {
  AreaActividad,
  CambioActividad,
  ItemActividad,
  OrigenAccion,
  TipoAccion,
} from '../../../../core/actividad/actividad-equipo.service';
import { diaTexto, haceCuanto, iniciales, tonoPersona } from '../../../../shared/ui/persona';

/** Presentación de la actividad del equipo: áreas, tipos, registros, períodos y cómo se muestra cada acción. */

export const AREA_UI: Record<AreaActividad, { t: string; icono: string }> = {
  productos: { t: 'Productos', icono: 'tag' },
  inventario: { t: 'Inventario', icono: 'packages' },
  compras: { t: 'Compras', icono: 'truck' },
  pedidos: { t: 'Pedidos', icono: 'shopping-bag' },
  clientes: { t: 'Clientes', icono: 'user' },
  tienda: { t: 'Tienda', icono: 'building-store' },
  whatsapp: { t: 'WhatsApp', icono: 'brand-whatsapp' },
  equipo: { t: 'Equipo', icono: 'users' },
  ajustes: { t: 'Ajustes', icono: 'settings' },
};

/** Cada tipo de acción: nombre, color del punto y el sello del avatar (`bg`/`fg`). */
export const TIPO_UI: Record<
  TipoAccion,
  { t: string; color: string; icono: string; bg: string; fg: string }
> = {
  crear: { t: 'Creó', color: '#29845a', icono: 'plus', bg: '#e6f6ec', fg: '#087b5d' },
  editar: { t: 'Editó', color: '#6b7280', icono: 'pencil', bg: '#f1f1f1', fg: '#4b5563' },
  estado: {
    t: 'Cambió el estado',
    color: '#0284c7',
    icono: 'arrows-exchange',
    bg: '#e0f2fe',
    fg: '#0369a1',
  },
  ajuste: {
    t: 'Ajustó stock',
    color: '#b07400',
    icono: 'adjustments-horizontal',
    bg: '#fff1d6',
    fg: '#8a5a00',
  },
  eliminar: { t: 'Eliminó', color: '#d82c0d', icono: 'trash', bg: '#fef3f2', fg: '#b42318' },
  acceso: { t: 'Permisos', color: '#9333ea', icono: 'key', bg: '#f3e8ff', fg: '#7e22ce' },
};

export const ORIGEN_UI: Record<OrigenAccion, { t: string; icono: string }> = {
  panel: { t: 'Desde el panel', icono: 'device-desktop' },
  app: { t: 'Desde la app', icono: 'device-mobile' },
  whatsapp: { t: 'Desde WhatsApp', icono: 'brand-whatsapp' },
};

/** Lo que se tocó (`registro.tipo` del backend): nombre, ícono y el botón para abrirlo. */
const REGISTRO_UI: Record<string, { t: string; icono: string; cta: string }> = {
  pedido: { t: 'Pedido', icono: 'shopping-bag', cta: 'Abrir pedido' },
  producto: { t: 'Producto', icono: 'tag', cta: 'Abrir producto' },
  cliente: { t: 'Cliente', icono: 'user', cta: 'Abrir cliente' },
  compra: { t: 'Compra', icono: 'truck', cta: 'Abrir compra' },
  proveedor: { t: 'Proveedor', icono: 'building-factory-2', cta: 'Abrir proveedor' },
  categoria: { t: 'Categoría', icono: 'category', cta: 'Abrir categoría' },
  campo: { t: 'Campo propio', icono: 'forms', cta: 'Abrir campo' },
  usuario: { t: 'Usuario', icono: 'user-shield', cta: 'Abrir usuario' },
  rol: { t: 'Rol', icono: 'shield-check', cta: 'Abrir rol' },
  descuento: { t: 'Descuento', icono: 'discount', cta: 'Abrir descuento' },
  tienda: { t: 'Tienda en línea', icono: 'building-store', cta: 'Abrir tienda' },
  conversacion: { t: 'Conversación', icono: 'message-circle-2', cta: 'Abrir conversación' },
  campana: { t: 'Campaña', icono: 'speakerphone', cta: 'Abrir campaña' },
  plantilla: { t: 'Plantilla', icono: 'template', cta: 'Abrir plantilla' },
};

export function registroUi(tipo: string | undefined): { t: string; icono: string; cta: string } {
  return (tipo && REGISTRO_UI[tipo]) || { t: 'Registro', icono: 'point', cta: 'Abrir' };
}

export function tipoUi(a: Pick<ItemActividad, 'tipo'>) {
  return TIPO_UI[a.tipo] ?? TIPO_UI.editar;
}

export type Periodo = 'hoy' | '7d' | '30d' | '90d';
export type Agrupar = 'dia' | 'persona' | 'area';

/** `dias`: cuántos días antes de hoy empieza (hoy cuenta como uno). */
export const PERIODOS: { k: Periodo; t: string; dias: number }[] = [
  { k: 'hoy', t: 'Hoy', dias: 0 },
  { k: '7d', t: '7 días', dias: 6 },
  { k: '30d', t: '30 días', dias: 29 },
  { k: '90d', t: '90 días', dias: 89 },
];

export const AGRUPAR: { k: Agrupar; t: string; d: string; i: string }[] = [
  { k: 'dia', t: 'Por día', d: 'Hoy, ayer y los días anteriores', i: 'calendar' },
  { k: 'persona', t: 'Por persona', d: 'Lo que hizo cada quien', i: 'users' },
  { k: 'area', t: 'Por área', d: 'Pedidos, productos, inventario…', i: 'layout-grid' },
];

/** Inicio (00:00 local) y fin del período, y los del período anterior del mismo largo. */
export function rangoPeriodo(p: Periodo): { desde: Date; hasta: Date; antes: Date } {
  const dias = PERIODOS.find((x) => x.k === p)!.dias;
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  desde.setDate(desde.getDate() - dias);
  const antes = new Date(desde);
  antes.setDate(antes.getDate() - (dias + 1));
  return { desde, hasta: new Date(), antes };
}

/** «Hoy» o «Últimos 30 días». */
export function textoPeriodo(p: Periodo): string {
  return p === 'hoy' ? 'Hoy' : `Últimos ${PERIODOS.find((x) => x.k === p)!.t}`;
}

/** «en 7 días», «hoy». */
export function enPeriodo(p: Periodo): string {
  return p === 'hoy' ? 'hoy' : `en ${PERIODOS.find((x) => x.k === p)!.t}`;
}

/** Un área que el backend agregue antes que el front cae en un punto con su código. */
export function areaUi(a: Pick<ItemActividad, 'area'>): { t: string; icono: string } {
  return AREA_UI[a.area] ?? { t: a.area, icono: 'point' };
}

/** Las acciones sin persona son de Goods (procesos automáticos). */
export function autorDe(a: ItemActividad): {
  nombre: string;
  corto: string;
  ini: string;
  tono: [string, string];
} {
  if (!a.usuario)
    return { nombre: 'Sistema', corto: 'Sistema', ini: 'G', tono: ['#f1f1f1', '#4b5563'] };
  return {
    nombre: a.usuario.nombre,
    corto: nombreCorto(a.usuario.nombre),
    ini: iniciales(a.usuario.nombre),
    tono: tonoPersona(a.usuario.nombre),
  };
}

/** «Laura Martínez» → «Laura M.» */
export function nombreCorto(n: string): string {
  const [a, b] = n.trim().split(/\s+/);
  return b ? `${a} ${b.charAt(0)}.` : a;
}

export function horaDe(a: ItemActividad): string {
  return new Date(a.fecha).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

/** «Hoy, 3:40 p. m.» */
export function cuandoDe(a: ItemActividad): string {
  return `${diaTexto(a.fecha)}, ${horaDe(a)}`;
}

/** Día local (no UTC) para agrupar. */
function diaLocal(f: string): string {
  return new Date(f).toDateString();
}

export function mismoRegistro(a: ItemActividad, b: ItemActividad): boolean {
  return (
    !!a.registro &&
    !!b.registro &&
    a.registro.tipo === b.registro.tipo &&
    a.registro.id === b.registro.id
  );
}

export interface GrupoActividad {
  k: string;
  t: string;
  sub: string;
  icono: string;
  ini: string;
  tono: [string, string] | null;
  filas: ItemActividad[];
}

/**
 * Agrupa las acciones (ya ordenadas por fecha) por día, persona o área, en el
 * orden en que aparecen. Subtítulos del diseño: por día «2 personas ·
 * Pedidos, Clientes»; por persona «última hace 3 h»; por área «2 personas».
 */
export function agruparActividad(items: ItemActividad[], por: Agrupar): GrupoActividad[] {
  const m = new Map<string, GrupoActividad>();
  for (const a of items) {
    const k =
      por === 'dia' ? diaLocal(a.fecha) : por === 'persona' ? String(a.usuario?.id ?? 0) : a.area;
    if (!m.has(k)) {
      const au = autorDe(a);
      const ar = areaUi(a);
      m.set(
        k,
        por === 'dia'
          ? { k, t: diaTexto(a.fecha), sub: '', icono: 'calendar', ini: '', tono: null, filas: [] }
          : por === 'persona'
            ? { k, t: au.nombre, sub: '', icono: '', ini: au.ini, tono: au.tono, filas: [] }
            : { k, t: ar.t, sub: '', icono: ar.icono, ini: '', tono: null, filas: [] },
      );
    }
    m.get(k)!.filas.push(a);
  }
  return [...m.values()].map((g) => {
    const personas = new Set(g.filas.map((f) => f.usuario?.id ?? 0)).size;
    const np = `${personas} ${personas === 1 ? 'persona' : 'personas'}`;
    const sub =
      por === 'persona'
        ? `Última ${haceCuanto(g.filas[0].fecha).toLowerCase()}`
        : por === 'area'
          ? np
          : `${np} · ${[...new Set(g.filas.map((f) => areaUi(f).t))].slice(0, 3).join(', ')}`;
    return { ...g, sub };
  });
}

/** Un trozo del valor de un cambio, con cómo se pinta (quitado, nuevo, igual). */
export interface Token {
  t: string;
  color: string;
  tachado: boolean;
  peso: number;
}
const TK = {
  antes: { color: '#8a8a8a', tachado: false, peso: 400 },
  quitado: { color: '#b42318', tachado: true, peso: 400 },
  nuevo: { color: '#111827', tachado: false, peso: 500 },
  igual: { color: '#8a8a8a', tachado: false, peso: 400 },
  neutro: { color: '#111827', tachado: false, peso: 500 },
};

export interface FilaCambio {
  campo: string;
  antes: Token[];
  despues: Token[];
  flecha: boolean;
  /** «+$ 4.900 · 10,9 %», «−3», «+1 −0»; vacío si no aplica. */
  delta: string;
  deltaColor: string;
}

/** «$ 4.500» → 4500; «1,5 kg» → no (con unidad no se compara). */
function numero(v: string | null): number | null {
  if (!v) return null;
  const m = v.replace(/\$|\s/g, '').replace(/\./g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(m) ? Number(m) : null;
}

/**
 * Las filas de «Qué cambió». Las listas (separadas por « · ») marcan qué se
 * quitó y qué entró; los números y montos, la diferencia. Al crear se ve solo
 * cómo quedó; al eliminar, solo cómo estaba.
 */
export function filasCambio(a: ItemActividad): FilaCambio[] {
  const tok = (t: string, k: keyof typeof TK): Token => ({ t, ...TK[k] });
  const partir = (v: string) => (v.includes(' · ') ? v.split(' · ') : [v]);
  return a.cambios.map((x: CambioActividad) => {
    if (a.tipo === 'crear' || (!x.antes && x.despues)) {
      return {
        campo: x.campo,
        antes: [],
        despues: x.despues ? [tok(x.despues, 'neutro')] : [],
        flecha: false,
        delta: '',
        deltaColor: '',
      };
    }
    if (a.tipo === 'eliminar' || (x.antes && !x.despues)) {
      return {
        campo: x.campo,
        antes: x.antes ? [tok(x.antes, a.tipo === 'eliminar' ? 'neutro' : 'quitado')] : [],
        despues: [],
        flecha: false,
        delta: a.tipo === 'eliminar' ? '' : 'Se quitó',
        deltaColor: '#b42318',
      };
    }
    const ant = x.antes ?? '';
    const des = x.despues ?? '';
    const lista = ant.includes(' · ') || des.includes(' · ');
    let antes: Token[];
    let despues: Token[];
    let delta = '';
    let deltaColor = '#8a8a8a';
    if (lista) {
      const A = partir(ant);
      const B = partir(des);
      antes = A.map((t) => tok(t, B.includes(t) ? 'igual' : 'quitado'));
      despues = B.map((t) => tok(t, A.includes(t) ? 'igual' : 'nuevo'));
      const mas = B.filter((t) => !A.includes(t)).length;
      const menos = A.filter((t) => !B.includes(t)).length;
      delta = [mas ? `+${mas}` : '', menos ? `−${menos}` : ''].filter(Boolean).join(' ');
    } else {
      antes = [tok(ant, 'antes')];
      despues = [tok(des, 'nuevo')];
      const na = numero(ant);
      const nd = numero(des);
      if (na != null && nd != null && na !== nd) {
        const d = nd - na;
        const dinero = /\$/.test(ant + des);
        const pct = na ? Math.round((d / na) * 1000) / 10 : null;
        delta =
          (d > 0 ? '+' : '−') +
          (dinero ? '$ ' : '') +
          Math.abs(d).toLocaleString('es-CO') +
          (dinero && pct != null ? ` · ${Math.abs(pct).toLocaleString('es-CO')} %` : '');
        deltaColor = d > 0 ? '#1f6e49' : '#b42318';
      }
    }
    return { campo: x.campo, antes, despues, flecha: true, delta, deltaColor };
  });
}

/** CSV con BOM (para que Excel lea bien las tildes). */
export function csvActividad(items: ItemActividad[]): string {
  const filas = [
    ['Fecha', 'Persona', 'Área', 'Tipo', 'Origen', 'Registro', 'Acción', 'Cambios'],
    ...items.map((a) => [
      a.fecha,
      autorDe(a).nombre,
      areaUi(a).t,
      tipoUi(a).t,
      ORIGEN_UI[a.origen]?.t.replace('Desde ', '') ?? '',
      a.registro ? `${registroUi(a.registro.tipo).t} ${a.registro.ref}` : '',
      a.texto,
      a.cambios.map((c) => `${c.campo}: ${c.antes ?? '—'} → ${c.despues ?? '—'}`).join(' | '),
    ]),
  ];
  return (
    '﻿' + filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  );
}
