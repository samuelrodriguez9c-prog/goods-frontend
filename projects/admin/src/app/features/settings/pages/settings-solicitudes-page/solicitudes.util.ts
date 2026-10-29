import {
  ESTADO_SOLICITUD,
  EstadoSolicitud,
  EventoSolicitud,
  Solicitud,
  SolicitudPublica,
  TipoSolicitud,
} from '../../../../core/solicitudes/models/solicitud.model';
import { haceCuanto, iniciales, tonoPersona } from '../../../../shared/ui/persona';

/** Presentación de las solicitudes a Goods: tipos, tonos de estado, pasos y eventos de la conversación. */

export const TIPO_UI: Record<TipoSolicitud, { t: string; icono: string; bg: string; fg: string }> =
  {
    ajuste_modulo: { t: 'Mejora', icono: 'sparkles', bg: '#eef2ff', fg: '#3730a3' },
    campo_personalizado: { t: 'Datos propios', icono: 'forms', bg: '#e0f7f5', fg: '#00605b' },
    modulo_nuevo: { t: 'Sección nueva', icono: 'layout-grid-add', bg: '#fff1d6', fg: '#8a5a00' },
    otro: { t: 'Otra cosa', icono: 'message-dots', bg: '#f1f1f1', fg: '#4b5563' },
  };

export type Tono = { bg: string; fg: string; punto: string };

/** Colores de cada `tono` de `ESTADO_SOLICITUD`. */
export const TONO: Record<string, Tono> = {
  neutral: { bg: '#f1f1f1', fg: '#4b5563', punto: '#9ca3af' },
  info: { bg: '#e0f2fe', fg: '#075985', punto: '#0284c7' },
  warning: { bg: '#fff1d6', fg: '#8a5a00', punto: '#e2a400' },
  success: { bg: '#e7f6ec', fg: '#1f6b43', punto: '#29845a' },
  critical: { bg: '#fde2e4', fg: '#9f1239', punto: '#e11d48' },
};

export const ICONO_ESTADO: Record<EstadoSolicitud, string> = {
  recibida: 'inbox',
  en_evaluacion: 'eye',
  aprobada: 'circle-check',
  rechazada: 'circle-x',
  en_desarrollo: 'code',
  entregada: 'rocket',
  cancelada: 'ban',
};

/** Camino feliz: los 5 pasos de la barra de progreso. */
const PASOS: EstadoSolicitud[] = [
  'recibida',
  'en_evaluacion',
  'aprobada',
  'en_desarrollo',
  'entregada',
];

/** Ícono de cada área de Goods (`modulo.codigo`). */
export const ICONO_AREA: Record<string, string> = {
  dashboard: 'chart-bar',
  orders: 'shopping-bag',
  products: 'tag',
  customers: 'user',
  discounts: 'discount',
  messages: 'messages',
  users: 'users',
  roles: 'shield',
  asistente_ia: 'sparkles',
  tienda: 'building-store',
  whatsapp: 'brand-whatsapp',
  actividad_equipo: 'history',
};

/**
 * Nombre de cada área como lo da `GET /mis-solicitudes/areas` (el `nombre`
 * de `modulo` es el interno, en inglés). Sirve mientras las áreas cargan.
 */
export const NOMBRE_AREA: Record<string, string> = {
  orders: 'Pedidos',
  products: 'Productos',
  customers: 'Clientes',
  discounts: 'Descuentos',
  tienda: 'Tienda en línea',
  whatsapp: 'WhatsApp',
  dashboard: 'Inicio y reportes',
  users: 'Equipo',
  roles: 'Roles y permisos',
  messages: 'Soporte',
  asistente_ia: 'Asistente de IA',
  actividad_equipo: 'Actividad del equipo',
};

/** Ícono de cada sección (`área:clave`); las que no están van con un punto. */
const ICONO_SECCION: Record<string, string> = {
  'orders:envios': 'truck-delivery',
  'orders:pagos': 'credit-card',
  'orders:estados': 'progress',
  'orders:comprobantes': 'file-invoice',
  'products:inventario': 'packages',
  'products:variantes': 'versions',
  'products:categorias': 'category',
  'products:compras': 'shopping-cart',
  'products:precios': 'currency-dollar',
  'customers:datos': 'user',
  'customers:historial': 'history',
  'customers:grupos': 'users-group',
  'discounts:cupones': 'ticket',
  'discounts:promociones': 'speakerphone',
  'tienda:catalogo': 'layout-grid',
  'tienda:pedidos': 'shopping-bag',
  'tienda:diseno': 'palette',
  'whatsapp:bandeja': 'inbox',
  'whatsapp:campanas': 'speakerphone',
  'whatsapp:plantillas': 'template',
  'whatsapp:automatico': 'bolt',
  'whatsapp:asistente': 'message-chatbot',
  'dashboard:metricas': 'chart-line',
  'dashboard:reportes': 'report',
  'users:invitaciones': 'mail-forward',
  'users:accesos': 'lock',
  'asistente_ia:respuestas': 'message-chatbot',
  'asistente_ia:documentos': 'file-text',
};

export function iconoSeccion(area: string, clave: string): string {
  return ICONO_SECCION[`${area}:${clave}`] ?? 'point';
}

export function nombreArea(codigo: string, porDefecto = codigo): string {
  return NOMBRE_AREA[codigo] ?? porDefecto;
}

export function iconoArea(s: Pick<Solicitud, 'modulo' | 'tipo'>): string {
  if (s.modulo) return ICONO_AREA[s.modulo.codigo] ?? 'layout-grid';
  return s.tipo === 'modulo_nuevo' ? 'layout-grid-add' : 'layout-grid';
}

/** Referencia corta que se muestra y se busca: `#S-128`. */
export function refDe(id: number): string {
  return `#S-${id}`;
}

/** Lo que muestran la fila y la ficha, sea propia o del tablero. */
export type SolicitudLista = Solicitud | SolicitudPublica;

export function esPublica(s: SolicitudLista): s is SolicitudPublica {
  return 'esMia' in s;
}

/** Cuántas tiendas más (sin contar la propia) la piden. */
export function otrasQueLaPiden(s: SolicitudLista): number {
  const propia = esPublica(s) ? s.voto || s.esMia : true;
  return Math.max(0, s.votos - (propia ? 1 : 0));
}

export function tonoDe(s: Pick<Solicitud, 'estado'>): Tono {
  return TONO[ESTADO_SOLICITUD[s.estado].tono];
}

export function areaDe(s: Pick<Solicitud, 'modulo' | 'tipo'>): string {
  if (s.modulo) return nombreArea(s.modulo.codigo, s.modulo.nombre);
  return s.tipo === 'modulo_nuevo' ? 'Nueva sección' : 'General';
}

/** El área con su sección: «Productos › Inventario y stock». */
export function areaCompleta(s: SolicitudLista): string {
  const sec = esPublica(s) ? null : s.seccion;
  return sec ? `${areaDe(s)} › ${sec.nombre}` : areaDe(s);
}

/** Ícono de la sección si tiene, si no el del área. */
export function iconoAreaCompleta(s: SolicitudLista): string {
  const sec = esPublica(s) ? null : s.seccion;
  return sec && s.modulo ? iconoSeccion(s.modulo.codigo, sec.clave) : iconoArea(s);
}

export interface PasoProgreso {
  t: string;
  icono: string;
  hecho: boolean;
  actual: boolean;
  /** No llegó todavía. */
  futuro: boolean;
  relleno: string;
  /** «Hace 3 días», «Desde hoy», «Aún no llega»: solo se ve en el paso enfocado. */
  fecha: string;
  /** Título nativo del paso. */
  titulo: string;
  peso: number;
  tColor: string;
}

export type FuenteProgreso = Pick<Solicitud, 'estado' | 'creadoEn'> &
  Pick<Partial<Solicitud>, 'eventos'>;

const DIA = 86_400_000;

function diasDesde(fecha: string | null | undefined): number | null {
  if (!fecha) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / DIA));
}

function haceDias(d: number, hoy = 'Hoy'): string {
  return d <= 0 ? hoy : d === 1 ? 'Hace 1 día' : `Hace ${d} días`;
}

function fuera(s: Pick<Solicitud, 'estado'>): boolean {
  return s.estado === 'rechazada' || s.estado === 'cancelada';
}

/** Índice del paso en que va (o en el que se quedó si se rechazó o canceló). */
export function indicePaso(s: FuenteProgreso): number {
  return fuera(s) ? ultimoPaso(s) : PASOS.indexOf(s.estado);
}

/** Cuándo llegó a un paso: su evento de estado, o el envío para el primero. */
function fechaPaso(s: FuenteProgreso, p: EstadoSolicitud): string | null {
  return (
    s.eventos?.find((e) => e.tipo === 'estado' && e.estadoNuevo === p)?.creadoEn ??
    (p === 'recibida' ? s.creadoEn || null : null)
  );
}

/**
 * Los 5 pasos con su avance. Si se rechazó o canceló, el progreso se queda
 * en el último paso del camino feliz por el que pasó.
 */
export function pasosDe(s: FuenteProgreso): PasoProgreso[] {
  const out = fuera(s);
  const idx = indicePaso(s);
  return PASOS.map((p, i) => {
    const hecho = i < idx || (i === idx && (p === 'entregada' || out));
    const actual = i === idx && !hecho;
    const futuro = i > idx;
    const d = diasDesde(fechaPaso(s, p));
    const fecha = futuro
      ? 'Aún no llega'
      : d === null
        ? '—'
        : actual
          ? haceDias(d, 'Desde hoy')
          : haceDias(d);
    const t = ESTADO_SOLICITUD[p].texto;
    return {
      t,
      icono: hecho ? 'circle-check-filled' : ICONO_ESTADO[p],
      hecho,
      actual,
      futuro,
      relleno: hecho ? '100%' : actual ? '55%' : '0%',
      fecha,
      titulo: `${t} · ${fecha === '—' ? 'sin fecha' : fecha.toLowerCase()}`,
      peso: actual ? 600 : 500,
      tColor: actual ? '#111827' : hecho ? '#374151' : '#a3a3a3',
    };
  });
}

function ultimoPaso(s: FuenteProgreso): number {
  const vistos = (s.eventos ?? [])
    .filter((e) => e.tipo === 'estado' && e.estadoAnterior)
    .map((e) => PASOS.indexOf(e.estadoAnterior!));
  return Math.max(0, ...vistos);
}

/** Qué esperar en cada estado cuando no hay fecha de entrega comprometida. */
const ETA: Record<EstadoSolicitud, string> = {
  recibida: 'Respuesta en 2 días hábiles',
  en_evaluacion: 'Decisión en estos días',
  aprobada: 'Fecha por definir',
  en_desarrollo: 'Fecha por definir',
  entregada: 'Ya está en tu cuenta',
  rechazada: 'No se hará por ahora',
  cancelada: 'Se cerró sin hacerse',
};

export interface EtapaSolicitud {
  /** «Paso 2 de 5 · lleva 3 días aquí». */
  paso: string;
  eta: string;
  etaIcono: string;
  /** La persona de Goods que respondió último; `null` si no hay conversación (tablero). */
  responsable: { t: string; ini: string } | null;
  /** Los 5 segmentos junto al estado. */
  mini: { w: string; bg: string }[];
}

/** Cabecera del progreso: en qué paso va, desde cuándo, qué esperar y quién la lleva. */
export function etapaDe(
  s: FuenteProgreso & Pick<Partial<Solicitud>, 'fechaCompromiso'>,
): EtapaSolicitud {
  const idx = indicePaso(s);
  const lista = s.estado === 'entregada';
  const d = diasDesde(fechaPaso(s, PASOS[idx]));
  const enEtapa = lista
    ? 'completada'
    : fuera(s)
      ? ESTADO_SOLICITUD[s.estado].texto.toLowerCase()
      : d === null
        ? ''
        : d <= 0
          ? 'llegó hoy'
          : `lleva ${d === 1 ? '1 día' : d + ' días'} aquí`;
  const comp = s.fechaCompromiso && !lista && !fuera(s) ? s.fechaCompromiso : null;
  let responsable: EtapaSolicitud['responsable'] = null;
  if (s.eventos) {
    const g = [...s.eventos].reverse().find((e) => e.tipo === 'comentario' && e.deGoods && e.autor);
    responsable = g
      ? { t: `A cargo de ${g.autor!.nombre.split(' ')[0]}`, ini: iniciales(g.autor!.nombre) }
      : { t: 'Aún sin responsable', ini: '' };
  }
  return {
    paso: `Paso ${idx + 1} de 5${enEtapa ? ' · ' + enEtapa : ''}`,
    eta: comp
      ? `Entrega estimada ${new Date(comp.length === 10 ? comp + 'T12:00' : comp).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`
      : ETA[s.estado],
    etaIcono: lista ? 'circle-check' : fuera(s) ? 'circle-x' : 'calendar-time',
    responsable,
    mini: PASOS.map((_, i) => {
      const actual = i === idx && !lista && !fuera(s);
      const hecho = i < idx || (i === idx && !actual);
      return { w: actual ? '18px' : '6px', bg: hecho ? '#303030' : actual ? '#7fd6cf' : '#e5e5e5' };
    }),
  };
}

export interface VistaEvento {
  id: number;
  esEvento: boolean;
  t: string;
  cuando: string;
  evIcono: string;
  evBg: string;
  evFg: string;
  deGoods: boolean;
  /** Lo escribió quien mira: va a la derecha, en oscuro. */
  mio: boolean;
  autor: string;
  ini: string;
  avBg: string;
  avFg: string;
}

/** Los cambios de estado van como pastillas; los comentarios, como burbujas. */
export function vistaEvento(e: EventoSolicitud, yoId = -1): VistaEvento {
  if (e.tipo === 'estado' && e.estadoNuevo) {
    const tn = TONO[ESTADO_SOLICITUD[e.estadoNuevo].tono];
    return {
      id: e.id,
      esEvento: true,
      t: `Pasó a ${ESTADO_SOLICITUD[e.estadoNuevo].texto.toLowerCase()}`,
      cuando: haceCuanto(e.creadoEn).toLowerCase(),
      evIcono: ICONO_ESTADO[e.estadoNuevo],
      evBg: tn.bg,
      evFg: tn.fg,
      deGoods: false,
      mio: false,
      autor: '',
      ini: '',
      avBg: '',
      avFg: '',
    };
  }
  const mio = !e.deGoods && !!e.autor && e.autor.id === yoId;
  const n = e.autor?.nombre ?? (e.deGoods ? 'Equipo Goods' : 'Tu equipo');
  const t = tonoPersona(n);
  return {
    id: e.id,
    esEvento: false,
    t: e.texto ?? '',
    cuando: haceCuanto(e.creadoEn),
    evIcono: '',
    evBg: '',
    evFg: '',
    deGoods: e.deGoods,
    mio,
    autor: mio ? 'Tú' : e.deGoods ? n.split(' ')[0] : n,
    ini: iniciales(n),
    avBg: e.deGoods ? '#303030' : t[0],
    avFg: e.deGoods ? '#fff' : t[1],
  };
}

/** Capturas: hasta 8 por solicitud y 4 por envío, PNG, JPG, WebP o GIF de 5 MB. */
export const MAX_CAPTURAS_SOLICITUD = 8;
export const MAX_CAPTURAS_ENVIO = 4;
const TIPOS_CAPTURA = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES_CAPTURA = 5 * 1024 * 1024;

/** Las imágenes que entran (válidas y dentro de `libres`) y si se dejó alguna afuera. */
export function filtrarCapturas(files: File[], libres: number): { entran: File[]; fuera: boolean } {
  const validas = files.filter(
    (f) => TIPOS_CAPTURA.includes(f.type) && f.size <= MAX_BYTES_CAPTURA,
  );
  const entran = validas.slice(0, Math.max(0, Math.min(libres, MAX_CAPTURAS_ENVIO)));
  return { entran, fuera: entran.length < files.length };
}
