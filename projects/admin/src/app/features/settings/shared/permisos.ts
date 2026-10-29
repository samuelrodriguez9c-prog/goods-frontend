import {
  MapaNiveles,
  Modulo,
  Nivel,
  nivelDePermiso,
  nivelesDeRol,
} from '../../../core/roles/niveles';
import { Rol } from '../../../core/roles/models/rol.model';

/** Presentación de niveles y permisos, compartida por Roles y Usuarios. */

export const NIVELES = ['Sin acceso', 'Ver', 'Editar', 'Todo'] as const;
export const NIVEL_DESCRIPCION = [
  'Puede consultar, pero no cambia nada',
  'Crea y modifica lo del día a día',
  'Además borra, reembolsa y configura',
];
/** Tonos de los ticks por nivel (0 → 3). */
export const TONO_NIVEL = ['#ececec', '#c4c4c4', '#7a7a7a', '#303030'];
export const ICONO_ROL_POR_DEFECTO = 'user-star';

export function iconoRol(r: Pick<Rol, 'icono'> | null | undefined): string {
  return r?.icono || ICONO_ROL_POR_DEFECTO;
}

/** «Ve 4 · edita 2 · todo en 1». */
export function resumenNiveles(n: MapaNiveles): string {
  const c = (lv: number) => Object.values(n).filter((x) => x >= lv).length;
  return `Ve ${c(1)} · edita ${c(2)} · todo en ${c(3)}`;
}

/** Módulos con algún acceso sobre el total («5/9»). */
export function modulosCon(rol: Pick<Rol, 'permisos'>, modulos: Modulo[]): string {
  return `${Object.values(nivelesDeRol(rol, modulos)).filter(Boolean).length}/${modulos.length}`;
}

export function cuentaPersonas(n: number): string {
  return n ? (n === 1 ? '1 persona' : `${n} personas`) : 'Sin personas';
}

/** Un permiso dentro de la fila de un módulo: qué tiene, qué gana y qué pierde. */
export interface AccionPermiso {
  t: string;
  codigo: string;
  nivel: string;
  icono: string;
  icBg: string;
  icColor: string;
  color: string;
  tag: string;
  tagBg: string;
  tagColor: string;
}

/** Fila de un módulo con su nivel guardado (`a`) y el propuesto (`b`). */
export interface VistaModulo {
  a: Nivel;
  b: Nivel;
  cambia: boolean;
  sube: boolean;
  nivel: string;
  color: string;
  tColor: string;
  iBg: string;
  iColor: string;
  acciones: AccionPermiso[];
}

/** `etiquetas`: cómo se marca lo que se suma y lo que se quita («Nuevo» / «Se quita»). */
export function vistaModulo(
  m: Modulo,
  a: Nivel,
  b: Nivel,
  etiquetas: { gana: string; pierde: string },
): VistaModulo {
  const cambia = a !== b;
  const sube = b > a;
  return {
    a,
    b,
    cambia,
    sube,
    nivel: cambia ? (sube ? 'Sube a ' : 'Baja a ') + NIVELES[b] : NIVELES[a],
    color: !cambia ? (a ? '#6b7280' : '#b5b5b5') : sube ? '#1f6b43' : '#b42318',
    tColor: a || b ? '#111827' : '#9ca3af',
    iBg: cambia ? (sube ? '#e7f6ec' : '#fde2e4') : b ? '#f1f1f1' : '#f6f6f6',
    iColor: cambia ? (sube ? '#1f6b43' : '#b42318') : b ? '#4b5563' : '#b5b5b5',
    acciones: m.permisos.map((p) => {
      const need = nivelDePermiso(p);
      const has = a >= need;
      const will = b >= need;
      const gana = !has && will;
      const pierde = has && !will;
      return {
        t: p.descripcion ?? p.codigo,
        codigo: p.codigo,
        nivel: NIVELES[need],
        icono: pierde ? 'x' : will ? 'check' : 'minus',
        icBg: pierde ? '#fde2e4' : gana ? '#d5f2e3' : will ? '#e7f6ec' : '#f1f1f1',
        icColor: pierde ? '#b42318' : will ? '#1f6b43' : '#b5b5b5',
        color: pierde ? '#b42318' : will ? '#374151' : '#9ca3af',
        tag: gana ? etiquetas.gana : pierde ? etiquetas.pierde : '',
        tagBg: gana ? '#e7f6ec' : '#fde2e4',
        tagColor: gana ? '#1f6b43' : '#b42318',
      };
    }),
  };
}
