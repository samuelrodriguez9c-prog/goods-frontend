import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IconX, TablerIconComponent } from '@tabler/icons-angular';

/**
 * Panel deslizante desde la derecha (p. ej. el detalle de una empresa).
 * Mismo backdrop y cierre que `ModalComponent`, pero más ancho
 * y anclado a la derecha para formularios con textos de ayuda que no caben
 * en un modal chico.
 *
 * Local a `staff`: se pasa a `shared-ui` solo si `admin` también lo necesita.
 */
@Component({
  selector: 'app-side-panel',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './side-panel.component.html',
})
export class SidePanelComponent {
  @Input() titulo = '';
  @Output() cerrar = new EventEmitter<void>();

  protected readonly iconClose = IconX;

  protected onBackdropClick(event: MouseEvent): void {
    // Solo cierra si el clic cae sobre el backdrop, no dentro del panel.
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }
}
