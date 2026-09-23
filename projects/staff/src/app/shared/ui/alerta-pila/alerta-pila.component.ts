import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AlertaService } from '../../../core/ui/alerta.service';
import { EstadoIconoComponent } from '../estado-icono/estado-icono.component';

/**
 * Pila de alertas en línea. Va **una sola vez** en el shell
 * (`shell.component.html`), no por página: el estado vive en `AlertaService`,
 * así que una operación lanzada en Roles sigue avisando si el usuario navega
 * a Planes mientras termina.
 */
@Component({
  selector: 'app-alerta-pila',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EstadoIconoComponent],
  templateUrl: './alerta-pila.component.html',
})
export class AlertaPilaComponent {
  private readonly servicio = inject(AlertaService);

  protected readonly alertas = this.servicio.enLinea;

  /** Halo del ícono + borde de la tarjeta, por estado. */
  protected readonly tono = computed(() => TONO);

  protected cerrar(id: number): void {
    this.servicio.cerrar(id);
  }
}

export const TONO: Record<string, { halo: string; borde: string }> = {
  cargando: { halo: 'bg-neutral-100', borde: 'border-neutral-200' },
  success: { halo: 'bg-badge-success-bg', borde: 'border-emerald-300' },
  error: { halo: 'bg-field-error-bg', borde: 'border-red-300' },
  info: { halo: 'bg-badge-info-bg', borde: 'border-sky-300' },
  warning: { halo: 'bg-badge-warning-bg', borde: 'border-amber-300' },
};
