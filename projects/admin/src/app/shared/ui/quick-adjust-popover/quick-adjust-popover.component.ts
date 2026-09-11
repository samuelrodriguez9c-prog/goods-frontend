import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Popover } from 'primeng/popover';

export type QuickAdjustMode = 'set' | 'add' | 'subtract';

export interface QuickAdjustResult {
  mode: QuickAdjustMode;
  quantity: number;
  reason: string;
}

/**
 * Popover de ajuste rápido — dropdown "Set to / Add / Subtract" +
 * cantidad, dropdown de motivo, botón de confirmar. Calcado de la
 * captura 304 (ficha de producto > Inventory) — ver ADMIN_DISENO.md >
 * "Productos/Inventario" y "Qué construir como librería propia", ítem 3.
 *
 * Filosofía igual que `DataTableComponent`: usar `p-popover` de PrimeNG
 * solo por su COMPORTAMIENTO (posicionamiento anclado al trigger, cierre
 * al hacer click afuera, foco) — el contenido interno (selects, input,
 * botón) es HTML + Tailwind propio, sin más componentes de PrimeNG
 * adentro. Después de la experiencia con `p-tableCheckbox` (que no
 * heredaba `pt`), usar `<select>`/`<input>` nativos acá es deliberado:
 * son controles simples que no necesitan lo que PrimeNG resuelve bien
 * (overlays), así que no vale la pena arriesgarse a otra limitación de
 * `pt` en un componente que no se llegó a probar.
 *
 * A diferencia de `DataTableComponent`, acá SÍ es seguro que este
 * componente encapsule `<p-popover>` en su propio template: no depende
 * de que el consumidor le pase `<ng-template pTemplate="...">` (el
 * mecanismo que falló con `p-table`) — `p-popover` acepta contenido
 * simple vía `<ng-content>` normal, que si funciona correctamente a
 * través de un nivel de wrapper.
 *
 * Nota: el modal "Adjust store credit" (Clientes/Usuarios) resuelve una
 * interacción parecida (monto + motivo + confirmar) pero es un MODAL,
 * no un popover — no comparte este componente. El día que se construya
 * un composite de modal equivalente, tiene sentido que reuse la misma
 * forma de inputs/output (`reasons`, `confirmed`).
 */
@Component({
  selector: 'app-quick-adjust-popover',
  standalone: true,
  imports: [Popover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quick-adjust-popover.component.html',
})
export class QuickAdjustPopoverComponent {
  /** Motivos del segundo dropdown (ej. "Damaged", "Restock"). */
  readonly reasons = input<string[]>(['Damaged', 'Restock', 'Theft or loss', 'Other']);

  /** Valor actual — precarga el modo "Set to" con este número al abrir. */
  readonly currentValue = input<number>(0);

  /** Se emite al confirmar; el consumidor decide qué hacer (llamar al backend, etc.). */
  readonly confirmed = output<QuickAdjustResult>();

  private readonly popover = viewChild.required(Popover);

  protected readonly mode = signal<QuickAdjustMode>('set');
  protected readonly quantity = signal(0);
  protected readonly reason = signal('');

  protected readonly pt = computed(() => ({
    root: 'rounded-lg border border-gray-200 bg-card-bg shadow-lg',
  }));

  protected toggle(event: Event): void {
    // Reinicia el formulario cada vez que se abre, precargando "Set to"
    // con el valor actual — mismo comportamiento que en Shopify.
    this.mode.set('set');
    this.quantity.set(this.currentValue());
    this.reason.set(this.reasons()[0] ?? '');
    this.popover().toggle(event);
  }

  protected onModeChange(value: string): void {
    this.mode.set(value as QuickAdjustMode);
  }

  protected onQuantityChange(value: string): void {
    this.quantity.set(Number(value) || 0);
  }

  protected onReasonChange(value: string): void {
    this.reason.set(value);
  }

  protected confirm(): void {
    this.confirmed.emit({ mode: this.mode(), quantity: this.quantity(), reason: this.reason() });
    this.popover().hide();
  }
}
