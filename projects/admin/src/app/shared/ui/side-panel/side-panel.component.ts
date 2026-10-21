import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IconX, TablerIconComponent } from '@tabler/icons-angular';

/**
 * Panel que se desliza desde la derecha (lo usa Documentos internos). Mismo
 * fondo y criterio de cierre que `ModalComponent`, pero más ancho y anclado a
 * la derecha para formularios largos.
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
    // Como en `ModalComponent`: solo cierra si el clic fue directo sobre el fondo.
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }
}
