// projects/staff/src/app/shared/ui/cabecera-modulo/cabecera-modulo.component.ts
//
// Cabecera compartida de los módulos del panel de staff (handoff de diseño
// "Cabecera de módulo (tipo panel, transversal)", §14 de LEEME.md,
// 2026-09-23). Adaptada del handoff original:
// - El ícono del período usaba PrimeIcons (`pi pi-calendar`), que este
//   proyecto no tiene instalado — se usa `tabler-icon` (`IconCalendar`),
//   el mismo sistema de íconos que ya usa el resto de `staff` (ver
//   TablerIconComponent en cada página de features/).
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
  /** Tinta del delta. Por defecto: verde si empieza con "+", gris si no hay. */
  deltaTono?: TonoMetrica;
  /** Puntos de la línea (el más viejo primero). Sin serie no se dibuja trazo. */
  serie?: number[];
  /** Tooltip de la etiqueta punteada. */
  titulo?: string;
}

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
 * Cabecera común de los módulos del panel de staff:
 * título + acciones · tira de métricas clicables · lectura + total.
 *
 * Slots:
 *   [icono]     ícono del módulo (20px)
 *   [acciones]  botones de la derecha
 *   [lectura]   subtítulo bajo la tira (admite <strong>)
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
  readonly total = input<string>('');

  readonly metricaClick = output<string>();
  readonly periodoClick = output<void>();

  protected readonly iconCalendario = IconCalendar;

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
        trazo: TRAZO[tono],
        deltaColor: hayDelta ? (deltaTono === 'exito' ? '#047857' : TINTA[deltaTono]) : '#9ca3af',
        linea: this.linea(m.serie),
        activa: this.activa() === m.id,
      };
    }),
  );

  private linea(serie?: number[]): string {
    if (!serie || serie.length < 2) {
      return '';
    }
    const max = Math.max(...serie);
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

/** Cuántas fechas caen en los últimos `dias` días. Útil para el delta "+n esta semana". */
export function recientes(fechas: (Date | string)[], dias = 7): number {
  const limite = Date.now() - dias * 86_400_000;
  return fechas.filter((f) => new Date(f).getTime() >= limite).length;
}
