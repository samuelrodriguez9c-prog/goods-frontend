import { NOMBRE_MODULO } from '../solicitudes/models/solicitud.model';
import { Permiso, Rol } from './models/rol.model';

/**
 * Niveles por módulo (Ver · Editar · Todo) sobre los permisos planos del
 * backend. Un permiso cae en un nivel por el sufijo de su código: `*.ver` → 1,
 * `*.eliminar|borrar|administrar|configurar|reembolsar|cancelar|gestionar` → 3,
 * el resto → 2. El nivel de un rol en un módulo es el más alto `n` tal que
 * tiene todos los permisos de nivel ≤ n.
 */
export type Nivel = 0 | 1 | 2 | 3;

const NIVEL_3 = /\.(eliminar|borrar|administrar|configurar|reembolsar|cancelar|gestionar)$/;

export function nivelDePermiso(p: Permiso): 1 | 2 | 3 {
  if (/\.ver$/.test(p.codigo)) return 1;
  return NIVEL_3.test(p.codigo) ? 3 : 2;
}

export interface Modulo {
  codigo: string;
  nombre: string;
  icono: string;
  permisos: Permiso[];
}

export interface Area {
  codigo: string;
  nombre: string;
  modulos: Modulo[];
}

/** Áreas del acordeón de permisos. Un módulo nuevo del backend cae en su área o en «Otros». */
const AREAS: { codigo: string; nombre: string; modulos: string[] }[] = [
  {
    codigo: 'ventas',
    nombre: 'Ventas',
    modulos: ['pedidos', 'orders', 'envios', 'clientes', 'customers', 'whatsapp', 'messages'],
  },
  {
    codigo: 'catalogo',
    nombre: 'Catálogo',
    modulos: [
      'productos',
      'products',
      'inventario',
      'descuentos',
      'discounts',
      'compras',
      'proveedores',
    ],
  },
  { codigo: 'finanzas', nombre: 'Finanzas', modulos: ['pagos', 'reportes', 'dashboard'] },
  {
    codigo: 'config',
    nombre: 'Configuración',
    modulos: ['ajustes', 'tienda', 'usuarios', 'users', 'roles', 'campos', 'actividad'],
  },
];

const ICONO_MODULO: Record<string, string> = {
  pedidos: 'shopping-bag',
  orders: 'shopping-bag',
  productos: 'tag',
  products: 'tag',
  inventario: 'packages',
  clientes: 'user',
  customers: 'user',
  whatsapp: 'brand-whatsapp',
  messages: 'message-circle',
  pagos: 'credit-card',
  ajustes: 'settings',
  envios: 'truck-delivery',
  descuentos: 'discount',
  discounts: 'discount',
  reportes: 'chart-bar',
  dashboard: 'chart-bar',
  tienda: 'building-store',
  usuarios: 'users',
  users: 'users',
  roles: 'shield-lock',
  compras: 'receipt',
  proveedores: 'truck',
  campos: 'forms',
  actividad: 'history',
  asistente: 'sparkles',
};

/** Agrupa los permisos asignables por módulo (`Permiso.modulo` o el prefijo del código). */
export function modulosDe(asignables: Permiso[]): Modulo[] {
  const m = new Map<string, Permiso[]>();
  for (const p of asignables) {
    const k = p.modulo ?? p.codigo.split('.')[0] ?? 'otros';
    m.set(k, [...(m.get(k) ?? []), p]);
  }
  return [...m.entries()].map(([codigo, permisos]) => ({
    codigo,
    nombre: NOMBRE_MODULO[codigo] ?? codigo.charAt(0).toUpperCase() + codigo.slice(1),
    icono: ICONO_MODULO[codigo] ?? 'puzzle',
    permisos: [...permisos].sort(
      (a, b) => nivelDePermiso(a) - nivelDePermiso(b) || a.codigo.localeCompare(b.codigo),
    ),
  }));
}

export function areasDe(modulos: Modulo[]): Area[] {
  const usados = new Set<string>();
  const out = AREAS.map((a) => {
    const ms = a.modulos
      .map((c) => modulos.find((x) => x.codigo === c))
      .filter((x): x is Modulo => !!x);
    ms.forEach((x) => usados.add(x.codigo));
    return { codigo: a.codigo, nombre: a.nombre, modulos: ms };
  }).filter((a) => a.modulos.length);
  const otros = modulos.filter((x) => !usados.has(x.codigo));
  return otros.length ? [...out, { codigo: 'otros', nombre: 'Otros', modulos: otros }] : out;
}

/** Nivel del conjunto de permisos `ids` en el módulo. */
export function nivelEn(mod: Modulo, ids: Set<number>): Nivel {
  let n: Nivel = 0;
  for (const lv of [1, 2, 3] as const) {
    const del = mod.permisos.filter((p) => nivelDePermiso(p) <= lv);
    // Un módulo sin permisos de un nivel (ej. `asistente`, sin `*.ver`) no se
    // corta ahí: sigue con los niveles que sí tiene.
    if (!del.length) continue;
    if (del.every((p) => ids.has(p.id))) n = lv;
    else break;
  }
  return n;
}

export type MapaNiveles = Record<string, Nivel>;

export function nivelesDeRol(rol: Pick<Rol, 'permisos'>, modulos: Modulo[]): MapaNiveles {
  const ids = new Set(rol.permisos.map((p) => p.id));
  return Object.fromEntries(modulos.map((m) => [m.codigo, nivelEn(m, ids)]));
}

/** De niveles a los ids que se mandan a `PUT /roles/:id/permisos`. */
export function idsDeNiveles(niveles: MapaNiveles, modulos: Modulo[]): number[] {
  return modulos.flatMap((m) =>
    m.permisos.filter((p) => nivelDePermiso(p) <= (niveles[m.codigo] ?? 0)).map((p) => p.id),
  );
}
