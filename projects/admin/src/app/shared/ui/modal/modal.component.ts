import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IconX, TablerIconComponent } from '@tabler/icons-angular';

/**
 * Modal genérico (fondo + tarjeta blanca centrada) para formularios y
 * confirmaciones.
 *
 * @remarks
 * No usa `p-dialog` de PrimeNG: un `<div>` con Tailwind alcanza y evita
 * estilizarlo con `pt`. Está duplicado en `staff`: se pasaría a `shared-ui`
 * si se quiere uno solo.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal.component.html',
})
export class ModalComponent {
  @Input() titulo = '';
  @Output() cerrar = new EventEmitter<void>();

  protected readonly iconClose = IconX;

  protected onBackdropClick(event: MouseEvent): void {
    // Solo cierra si el clic fue directo sobre el fondo: una selección de
    // texto que empieza en la tarjeta y termina afuera no debe cerrarlo.
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }
}
