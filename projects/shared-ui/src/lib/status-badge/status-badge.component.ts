import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

/**
 * Tonos de color disponibles, uno por cada estado documentado en
 * ADMIN_DISENO.md > "Lenguaje visual general > Tokens de color":
 * verde (éxito), ámbar (pendiente/en espera), gris (neutro), rojo
 * (crítico/error — todavía sin muestra real, usa el placeholder) y azul
 * (informativo — sumado 2026-09-17 para "Información corroborada" en
 * Empresas: ni ámbar, porque ya no hay nada pendiente del lado del
 * staff, ni verde, porque todavía no es cliente activo).
 */
export type StatusBadgeTone = 'success' | 'warning' | 'neutral' | 'critical' | 'info';

/**
 * Estilo del indicador circular que antecede al texto. En las capturas
 * de Shopify este punto distingue el TIPO de estado, no solo su color:
 * relleno (●) para el estado de pago (ej. "Paid"), y anillo/contorno (○)
 * para el estado de cumplimiento (ej. "Unfulfilled") — ver
 * ADMIN_DISENO.md > "Pedidos/Órdenes > Página de detalle de la orden".
 * "Active" y estados similares no llevan indicador ('none').
 */
export type StatusBadgeDot = 'none' | 'filled' | 'ring';

/**
 * Fondo + texto por tono. Los fondos vienen de los tokens extraídos con
 * pipeta (@theme en styles.css); el texto usa una escala neutra estándar
 * de Tailwind (no un token propio) porque solo necesita contraste
 * legible sobre el fondo claro, sin ser parte de la identidad visual.
 */
const TONE_CLASSES: Record<StatusBadgeTone, string> = {
  success: 'bg-badge-success-bg text-emerald-900',
  warning: 'bg-badge-warning-bg text-amber-900',
  neutral: 'bg-badge-neutral-bg text-gray-700',
  // Sin muestra real de un badge claro de error todavía (ver nota en
  // ADMIN_DISENO.md) — se deriva del placeholder sólido con opacidad
  // baja para simular el mismo patrón "fondo claro + texto del tono".
  critical: 'bg-badge-error-solid/15 text-badge-error-solid',
  info: 'bg-badge-info-bg text-sky-900',
};

/**
 * Badge de estado — componente base más reutilizado del admin (aparece
 * en Pedidos, Productos y Clientes). Envuelve `p-tag` de PrimeNG usando
 * solo su pass-through API (`pt`) para inyectar clases de Tailwind: con
 * `providePrimeNG({ theme: 'none' })` ya configurado, `p-tag` no trae
 * ningún estilo propio, así que el look final es 100% el que se define
 * aquí — ver ADMIN_DISENO.md > "Decisión: stack de UI para el admin".
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-tag [value]="label()" [pt]="pt()">
      @if (dot() !== 'none') {
        <span [class]="dotClasses()"></span>
      }
    </p-tag>
  `,
})
export class StatusBadgeComponent {
  /** Texto del badge, ej. "Paid", "Unfulfilled", "Active". */
  readonly label = input.required<string>();

  /** Tono de color — ver {@link StatusBadgeTone}. */
  readonly tone = input<StatusBadgeTone>('neutral');

  /** Indicador circular opcional — ver {@link StatusBadgeDot}. */
  readonly dot = input<StatusBadgeDot>('none');

  protected readonly pt = computed(() => ({
    root: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium leading-none ${TONE_CLASSES[this.tone()]}`,
    label: 'leading-none',
  }));

  protected readonly dotClasses = computed(() => {
    const base = 'inline-block h-1.5 w-1.5 shrink-0 rounded-full';
    return this.dot() === 'filled' ? `${base} bg-current` : `${base} border border-current`;
  });
}
