import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconCalendar, TablerIconComponent } from '@tabler/icons-angular';

export type TonoMetrica = 'neutro' | 'exito' | 'aviso' | 'peligro' | 'info' | 'apagado';

export interface MetricaCabecera {
  id: string;
  etiqueta: string;
  valor: string | number;
  /** "+2 esta semana", "supera 10 días"… `null` o vacío muestra "—". */
  delta?: string | null;
  /** Tinta del valor y del trazo. */
  tono?: TonoMetrica;
  /** Tinta del delta. Por defecto: verde si empieza con "+", gris si no. */
  deltaTono?: TonoMetrica;
  /** Puntos de la línea (el más viejo primero). Sin serie no se dibuja trazo. */
  serie?: number[] | null;
  /** Color del trazo si no sale del tono (ej. Solicitudes #78350f en Empresas). */
  trazo?: string;
  /** Tooltip de la etiqueta punteada. */
  titulo?: string;
}

export type TonoBadge = 'neutro' | 'marca' | 'vivo';

const BADGE: Record<TonoBadge, { fondo: string; tinta: string }> = {
  neutro: { fondo: '#e3e3e3', tinta: '#4b5563' },
  marca: { fondo: '#e0f7f5', tinta: '#00605b' },
  vivo: { fondo: '#ffffff', tinta: '#0c5132' },
};

const TINTA: Record<TonoMetrica, string> = {
  neutro: '#111827',
  exito: '#064e3b',
  aviso: '#b45309',
  peligro: '#d82c0d',
  info: '#075985',
  apagado: '#6b7280',
};

const TRAZO: Record<TonoMetrica, string> = {
  neutro: '#303030',
  exito: '#087b5d',
  aviso: '#b45309',
  peligro: '#d82c0d',
  info: '#075985',
  apagado: '#9ca3af',
};

const ANCHO = 84;
const ALTO = 28;

/**
 * Cabecera común de los módulos del panel de staff: título, badge, acciones
 * y tira de métricas con su línea.
 *
 * Slots:
 *   [icono]     ícono del módulo (20px)
 *   [acciones]  botones de la derecha
 *   [lectura]   subtítulo — bajo el título si hay `[badge]`; si no, bajo la
 *               tira de métricas junto a `[total]`
 */
@Component({
  selector: 'app-cabecera-modulo',
  standalone: true,
  imports: [TablerIconComponent],
  templateUrl: './cabecera-modulo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabeceraModuloComponent {
  readonly titulo = input.required<string>();
  readonly periodo = input<string | null>('Hoy');
  readonly periodoTitulo = input<string>('');
  readonly metricas = input<MetricaCabecera[]>([]);
  /** id de la métrica que está filtrando la vista. */
  readonly activa = input<string | null>(null);
  /** Dato que identifica al módulo, al lado del título: "14 clientes", "En
   *  vivo". Sube `[lectura]` bajo el título y hace que `[total]` se ignore. */
  readonly badge = input<string>('');
  readonly badgeTono = input<TonoBadge>('neutro');
  /** Se muestra abajo junto a `[lectura]`. Se ignora si hay `[badge]`. */
  readonly total = input<string>('');

  readonly metricaClick = output<string>();
  readonly periodoClick = output<void>();

  protected readonly iconCalendario = IconCalendar;
  protected readonly badgeEstilo = computed(() => BADGE[this.badgeTono()]);

  protected readonly vista = computed(() =>
    this.metricas().map((m) => {
      const tono = m.tono ?? 'neutro';
      const hayDelta = !!m.delta;
      const deltaTono: TonoMetrica =
        m.deltaTono ?? (hayDelta && m.delta!.trim().startsWith('+') ? 'exito' : hayDelta ? 'apagado' : 'apagado');
      return {
        ...m,
        delta: hayDelta ? m.delta : '—',
        tinta: TINTA[tono],
        trazo: m.trazo ?? TRAZO[tono],
        deltaColor: hayDelta ? (deltaTono === 'exito' ? '#047857' : TINTA[deltaTono]) : '#9ca3af',
        linea: this.linea(m.serie),
        activa: this.activa() === m.id,
      };
    }),
  );

  private linea(serie?: number[] | null): string {
    if (!serie || serie.length < 2) {
      return '';
    }
    // y = 27 − ((v − min) / rango) × 24, rango ≥ 1.
    const max = Math.max(1, ...serie);
    const min = Math.min(...serie);
    const rango = Math.max(1, max - min);
    const paso = ANCHO / (serie.length - 1);
    return serie
      .map((v, i) => `${i ? 'L' : 'M'}${(i * paso).toFixed(1)} ${(ALTO - 1 - ((v - min) / rango) * (ALTO - 4)).toFixed(1)}`)
      .join(' ');
  }
}

/**
 * Agrupa fechas en `cubos` intervalos de `dias` días hacia atrás desde hoy y
 * devuelve el acumulado — la forma que usa la línea de las métricas.
 */
export function serieAcumulada(fechas: (Date | string)[], cubos = 8, dias = 21): number[] {
  const hoy = Date.now();
  const b = Array<number>(cubos).fill(0);
  for (const f of fechas) {
    const d = Math.floor((hoy - new Date(f).getTime()) / 86_400_000);
    const i = cubos - 1 - Math.floor(d / dias);
    b[Math.max(0, Math.min(cubos - 1, i))]++;
  }
  let acc = 0;
  return b.map((v) => (acc += v));
}

/**
 * Conteo por intervalo (NO acumulado): cuántas fechas caen en cada uno de
 * los últimos `cubos` intervalos de `horas`. Es la forma de las líneas de
 * Soporte, Notificaciones y Auditoría (sube y baja con la actividad).
 */
export function serieConteo(fechas: (Date | string | null | undefined)[], cubos = 8, horas = 24): number[] {
  const ahora = Date.now();
  const ancho = horas * 3_600_000;
  const b = Array<number>(cubos).fill(0);
  for (const f of fechas) {
    if (!f) continue;
    const i = cubos - 1 - Math.floor((ahora - new Date(f).getTime()) / ancho);
    if (i >= 0 && i < cubos) b[i]++;
  }
  return b;
}

/** Cuántas fechas caen en los últimos `dias` días. Útil para el delta "+n esta semana". */
export function recientes(fechas: (Date | string)[], dias = 7): number {
  const limite = Date.now() - dias * 86_400_000;
  return fechas.filter((f) => new Date(f).getTime() >= limite).length;
}
