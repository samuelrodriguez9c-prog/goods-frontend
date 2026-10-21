import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IconArrowRight, IconCheck, IconFilter, TablerIconComponent } from '@tabler/icons-angular';
import { AlertaService } from '../../../core/ui/alerta.service';
import { PistaService } from '../../../core/ui/pista.service';

/**
 * Pista flotante de `PistaService` (atajos, navegación, filtros aplicados).
 * Se monta UNA vez en `shell.component.html`, al lado de `<app-alerta-pila />`.
 * Siempre en el DOM: entra y sale con transición; el contenido se re-anima
 * cuando llega otra pista (alterna dos keyframes idénticas por `id`).
 */
@Component({
  selector: 'app-pista',
  standalone: true,
  imports: [TablerIconComponent],
  templateUrl: './pista.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PistaComponent {
  protected readonly pista = inject(PistaService);
  /** La Pista sube por encima de la pila de alertas para no pisarse. */
  protected readonly alertas = inject(AlertaService);
  private readonly iconos = { navegar: IconArrowRight, hecho: IconCheck, filtro: IconFilter };

  protected readonly p = computed(() => this.pista.actual());
  protected readonly icono = computed(() => {
    const t = this.p()?.tipo;
    return t && t !== 'atajo' ? this.iconos[t] : null;
  });
  protected readonly par = computed(() => (this.p()?.id ?? 0) % 2 === 0);
}
