import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * Checkbox de selección — usado tanto en el header ("seleccionar todo")
 * como en cada fila de cualquier tabla del admin.
 *
 * Nota de diseño: se probó usar `p-tableCheckbox`/`p-tableHeaderCheckbox`
 * de PrimeNG (lo esperable dado que ya se usa `p-table`), pero esos dos
 * componentes NO exponen `pt` ni reciben el `pt.pcCheckbox`/
 * `pt.headerCheckbox` configurado en el `p-table` padre (confirmado
 * inspeccionando el DOM real: llega sin ninguna clase propia) — parece
 * ser una limitación de esta versión. En vez de pelear con eso, esto es
 * un checkbox propio, simple, 100% Tailwind, sin depender de PrimeNG:
 * un `<input type="checkbox">` real (accesible, transparente) superpuesto
 * a una caja + ícono dibujados a mano.
 */
@Component({
  selector: 'app-selection-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        class="peer absolute inset-0 z-10 h-4 w-4 cursor-pointer opacity-0"
        [checked]="checked()"
        [attr.aria-label]="ariaLabel()"
        (change)="onChange($event)"
      />
      <span [class]="boxClasses()"></span>
      @if (indeterminate() && !checked()) {
        <span class="pointer-events-none relative block h-1.5 w-1.5 rounded-full bg-white"></span>
      } @else if (checked()) {
        <svg
          class="pointer-events-none relative h-3 w-3 text-white"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M3 8.5L6.5 12L13 4.5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      }
    </span>
  `,
})
export class SelectionCheckboxComponent {
  readonly checked = input<boolean>(false);
  readonly indeterminate = input<boolean>(false);
  readonly ariaLabel = input<string>('Select row');

  readonly checkedChange = output<boolean>();

  protected readonly boxClasses = computed(() => {
    const base = 'absolute inset-0 rounded border transition-colors';
    return this.checked() || this.indeterminate()
      ? `${base} border-primary-button bg-primary-button`
      : `${base} border-gray-300 bg-white`;
  });

  protected onChange(event: Event): void {
    this.checkedChange.emit((event.target as HTMLInputElement).checked);
  }
}
