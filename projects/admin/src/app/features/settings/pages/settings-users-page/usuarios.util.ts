import { MapaNiveles, Modulo, nivelesDeRol } from '../../../../core/roles/niveles';
import { RolAsignable } from '../../../../core/roles/models/rol.model';
import { Usuario } from '../../../../core/usuarios/models/usuario.model';
import { haceCuanto, tonoPersona } from '../../../../shared/ui/persona';
import { ICONO_PLANTILLA, ROL_DUENO, nombreRol } from '../../shared/usuarios';

/** Utilidades de la página de Usuarios: roles para mostrar, aviso de invitación y correos de «Invitar personas». */

const CORREO = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
/** Lo que dura el enlace de invitación (el backend lo fija en 48 h). */
export const HORAS_INVITACION = 48;
const H_MS = 36e5;

// Roles

/** Un rol listo para mostrar: nombre legible, si es propio y en cuántos módulos tiene acceso. */
export interface RolUsuario extends RolAsignable {
  /** Nombre tal como llega del backend (`dueno_empresa` en las plantillas). */
  codigo: string;
  propio: boolean;
  esDueno: boolean;
  niveles: MapaNiveles;
  /** «5/7» */
  modulosTexto: string;
}

export function rolUsuarioDe(r: RolAsignable, modulos: Modulo[]): RolUsuario {
  const niveles = nivelesDeRol(r, modulos);
  const con = Object.values(niveles).filter(Boolean).length;
  return {
    ...r,
    codigo: r.nombre,
    // Solo las plantillas llegan con código; los roles propios se muestran como los nombró la tienda.
    nombre: r.empresaId == null ? nombreRol(r.nombre) : r.nombre,
    icono: r.icono ?? (r.empresaId == null ? ICONO_PLANTILLA[r.nombre] : null) ?? null,
    propio: r.empresaId != null,
    esDueno: r.nombre === ROL_DUENO,
    niveles,
    modulosTexto: `${con}/${modulos.length}`,
  };
}

export interface GrupoRoles {
  t: string;
  icono: string;
  roles: RolUsuario[];
}

/** Selector de rol en dos grupos: plantillas de Goods y roles de la tienda. El de dueño no se ofrece. */
export function arbolRoles(roles: RolUsuario[]): GrupoRoles[] {
  const elegibles = roles.filter((r) => !r.esDueno);
  return [
    { t: 'Plantillas de Goods', icono: 'layout-grid', roles: elegibles.filter((r) => !r.propio) },
    { t: 'Roles de tu tienda', icono: 'building-store', roles: elegibles.filter((r) => r.propio) },
  ].filter((g) => g.roles.length);
}

// Presencia

/** Con acceso y con Goods abierto ahora (`GET /usuarios/en-linea`). */
export function enLinea(u: Usuario, conectados: Set<number>): boolean {
  return !u.invitacion && u.activo && conectados.has(u.id);
}

/** «Aún no ha entrado», «En línea ahora» o «Entró hace 3 h». */
export function textoAcceso(u: Usuario, conectado: boolean): string {
  if (conectado) return 'En línea ahora';
  if (u.invitacion || !u.ultimoAcceso) return 'Aún no ha entrado';
  return 'Entró ' + haceCuanto(u.ultimoAcceso).toLowerCase();
}

// Invitación

export interface AvisoInvitacion {
  t: string;
  d: string;
  icono: string;
  bg: string;
  color: string;
  /** Lo que le queda al enlace, de lleno a vacío. */
  w: string;
  fill: string;
  btn: string;
}

export function avisoInvitacion(u: Usuario): AvisoInvitacion | null {
  const v = u.invitacion;
  if (!v) return null;
  const vence = v.venceEn ? new Date(v.venceEn).getTime() : Date.now();
  if (v.vencida) {
    return {
      t: 'La invitación venció',
      d: `Venció ${haceCuanto(new Date(vence)).toLowerCase()}. Envíale un enlace nuevo para que pueda entrar.`,
      icono: 'mail-x',
      bg: '#fdf0f1',
      color: '#9f1239',
      w: '0%',
      fill: '#e11d48',
      btn: 'Enviar un enlace nuevo',
    };
  }
  const horas = Math.max(0, (vence - Date.now()) / H_MS);
  const enviada = new Date(vence - HORAS_INVITACION * H_MS);
  return {
    t: 'Invitación pendiente',
    d: `Enviada ${haceCuanto(enviada).toLowerCase()} a ${u.correo}. El enlace vence en ${duracion(horas)}.`,
    icono: 'mail-forward',
    bg: '#fff7e6',
    color: '#8a5a00',
    w: `${Math.max(4, Math.round((horas / HORAS_INVITACION) * 100))}%`,
    fill: '#e2a400',
    btn: 'Reenviar invitación',
  };
}

function duracion(horas: number): string {
  return horas < 1 ? `${Math.max(1, Math.round(horas * 60))} min` : `${Math.round(horas)} h`;
}

// Correos de «Invitar personas»

export type EstadoCorreo = 'ok' | 'invalido' | 'repetido' | 'existe';

export interface TokenCorreo {
  correo: string;
  estado: EstadoCorreo;
}

/** Parte un texto pegado en correos (comas, espacios, saltos de línea; quita `<` `>`). */
export function partirCorreos(texto: string): string[] {
  return texto
    .split(/[\s,;]+/)
    .map((x) => x.trim().replace(/^<|>$/g, '').toLowerCase())
    .filter(Boolean);
}

/** Marca cada correo: no es un correo, ya está en el equipo o repetido (el primero cuenta). */
export function evaluarCorreos(correos: string[], existentes: Set<string>): TokenCorreo[] {
  const vistos = new Set<string>();
  return correos.map((correo) => {
    let estado: EstadoCorreo = 'ok';
    if (!CORREO.test(correo)) estado = 'invalido';
    else if (existentes.has(correo)) estado = 'existe';
    else if (vistos.has(correo)) estado = 'repetido';
    vistos.add(correo);
    return { correo, estado };
  });
}

const NOTA: Record<EstadoCorreo, string> = {
  ok: '',
  invalido: 'no es un correo',
  existe: 'ya está en tu equipo',
  repetido: 'repetido',
};

/** Rojo si no es un correo; ámbar si ya está o se repite. */
export function estiloToken(t: TokenCorreo) {
  const malo = t.estado === 'invalido';
  const aviso = t.estado === 'existe' || t.estado === 'repetido';
  const [bg, fg] = tonoPersona(t.correo);
  return {
    bg: malo ? '#fdf0f1' : aviso ? '#fff7e6' : '#f4f4f4',
    color: malo ? '#9f1239' : aviso ? '#8a5a00' : '#111827',
    sombra: malo ? 'inset 0 0 0 1px #f8c9cf' : 'none',
    avBg: malo ? '#fbd5da' : aviso ? '#ffe4b0' : bg,
    avColor: malo ? '#9f1239' : aviso ? '#8a5a00' : fg,
    nota: NOTA[t.estado],
  };
}

/** Pastillas bajo el campo: «3 listos», «1 ya en tu equipo», «1 repetido», «2 no son correos». */
export function resumenCorreos(
  tokens: TokenCorreo[],
): { t: string; bg: string; color: string; punto: string }[] {
  const n = (e: EstadoCorreo) => tokens.filter((t) => t.estado === e).length;
  const filas: [number, (n: number) => string, string, string, string][] = [
    [n('ok'), (x) => `${x} ${x === 1 ? 'listo' : 'listos'}`, '#e7f6ec', '#1f6b43', '#29845a'],
    [n('existe'), (x) => `${x} ya en tu equipo`, '#fff1d6', '#8a5a00', '#e2a400'],
    [
      n('repetido'),
      (x) => `${x} ${x === 1 ? 'repetido' : 'repetidos'}`,
      '#fff1d6',
      '#8a5a00',
      '#e2a400',
    ],
    [
      n('invalido'),
      (x) => (x === 1 ? '1 no es un correo' : `${x} no son correos`),
      '#fde2e4',
      '#9f1239',
      '#e11d48',
    ],
  ];
  return filas
    .filter(([x]) => x > 0)
    .map(([x, t, bg, color, punto]) => ({ t: t(x), bg, color, punto }));
}
