import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Interruptor chico (32×19) de Automático: oscuro prendido, gris apagado. */
@Component({
  selector: 'app-interruptor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './interruptor.component.html',
  host: { class: 'flex shrink-0' },
})
export class InterruptorComponent {
  readonly activo = input.required<boolean>();
  readonly etiqueta = input.required<string>();
  readonly desactivado = input(false);
  /** Mientras se guarda: no se puede volver a tocar. */
  readonly ocupado = input(false);
  readonly cambiar = output<void>();

  protected tocar(e: Event): void {
    e.stopPropagation();
    if (this.desactivado() || this.ocupado()) return;
    this.cambiar.emit();
  }
}
