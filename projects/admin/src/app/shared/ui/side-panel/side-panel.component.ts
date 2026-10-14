import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IconX, TablerIconComponent } from '@tabler/icons-angular';

/**
 * Panel deslizante desde la derecha — para el panel de detalle de Empresa
 * (§3.2/§11 Paso 2, PROPUESTA_FLUJO_ALTA_ASISTIDA.md) y lo que el
 * asistente de activación del Paso 3 vaya a necesitar. Mismo backdrop
 * semitransparente y mismo criterio de cierre que `ModalComponent`
 * (`shared/ui/modal/`) — clic directo sobre el backdrop cierra, clic que
 * arrastra desde la tarjeta hacia afuera no — pero más ancho y anclado a
 * la derecha en vez de centrado, para no apretar los campos + textos de
 * ayuda de §3.2 en un modal chico.
 *
 * Local a `staff` por ahora, no en `shared-ui` — mismo criterio que
 * `ModalComponent`: se promueve a la librería recién si `admin` también
 * lo necesita.
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
    // Mismo criterio que ModalComponent.onBackdropClick: solo cierra si
    // el click fue directo sobre el backdrop.
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }
}
