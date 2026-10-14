import { ChangeDetectionStrategy, Component, computed, HostListener, inject } from '@angular/core';
import { AlertaService } from '../../../core/ui/alerta.service';
import { EstadoIconoComponent } from '../estado-icono/estado-icono.component';

/**
 * La alerta que se pone **encima de la pantalla**. Dos variantes, misma pieza:
 *
 * - `tarjeta` — modal blanco centrado sobre la pantalla atenuada. Es la que
 *   lleva acciones (Reintentar, Ver la Empresa): el botón necesita un plano
 *   sólido donde apoyarse.
 * - `velo` — sin tarjeta: el ícono y dos líneas flotan directo sobre el velo
 *   oscuro con blur. Para operaciones sin decisión, donde el que manda es el
 *   estado y no el contenedor.
 *
 * Va una sola vez en el shell, junto a `app-alerta-pila`.
 */
@Component({
  selector: 'app-alerta-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EstadoIconoComponent],
  templateUrl: './alerta-overlay.component.html',
})
export class AlertaOverlayComponent {
  private readonly servicio = inject(AlertaService);

  protected readonly alerta = this.servicio.overlay;
  protected readonly cargando = computed(() => this.alerta()?.estado === 'cargando');

  /** Color del tramo "paso" — el único acento de color del bloque de texto. */
  protected readonly tonoPaso = computed(() => {
    const a = this.alerta();
    if (!a) {
      return '';
    }
    const velo = a.variante === 'velo';
    switch (a.estado) {
      case 'success':
        return velo ? '#5fe39b' : '#087b5d';
      case 'error':
        return velo ? '#ff8f7a' : '#d82c0d';
      case 'warning':
        return velo ? '#ffd24a' : '#b07400';
      case 'info':
        return velo ? '#7dd3fc' : '#0284c7';
      default:
        return velo ? 'rgba(255,255,255,0.82)' : '#6b7280';
    }
  });

  /** Mientras la operación está en vuelo no hay salida: ya se mandó. */
  @HostListener('document:keydown.escape')
  protected alEscape(): void {
    if (this.alerta() && !this.cargando()) {
      this.servicio.cerrarOverlay();
    }
  }

  protected clicEnVelo(): void {
    if (!this.cargando()) {
      this.servicio.cerrarOverlay();
    }
  }
}
