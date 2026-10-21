import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IconX, TablerIconComponent } from '@tabler/icons-angular';

/**
 * Modal genérico (backdrop + tarjeta centrada) para formularios de
 * crear/editar y confirmaciones de eliminar.
 *
 * Local a `staff`: se pasa a `shared-ui` solo cuando otro proyecto también
 * lo necesite. No usa `p-dialog` de PrimeNG a propósito: un `<div>` con
 * Tailwind alcanza y evita estilizarlo con `pt` (passthrough).
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
    // Solo cierra si el clic cae sobre el backdrop, no dentro de la tarjeta.
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }
}
