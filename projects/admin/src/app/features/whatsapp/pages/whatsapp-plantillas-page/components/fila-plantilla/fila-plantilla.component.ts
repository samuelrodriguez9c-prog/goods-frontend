import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Plantilla } from '../../../../../../core/whatsapp/whatsapp.model';
import { ESTADO_PLANTILLA, partes, pctLeida } from '../../plantillas.util';

/**
 * Una plantilla en la lista: punto de estado, nombre mono, nota
 * ("94% la leen", "Meta revisando", "Rechazada"), el mensaje en 2 líneas
 * (4 al elegirla) y, a la derecha, los envíos con una barra comparativa.
 */
@Component({
  selector: 'app-fila-plantilla',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fila-plantilla.component.html',
  host: {
    role: 'button',
    tabindex: '0',
    class: 'fila-plantilla flex cursor-pointer items-start gap-3 rounded-xl p-3',
    '[class.fila-plantilla--elegida]': 'elegida()',
    '[style.animation-delay.ms]': 'indice() * 40',
    '(click)': 'elegir.emit()',
    '(keydown.enter)': 'elegir.emit()',
  },
})
export class FilaPlantillaComponent {
  readonly plantilla = input.required<Plantilla>();
  readonly elegida = input(false);
  /** Posición dentro del grupo, para la entrada escalonada. */
  readonly indice = input(0);
  /** Envíos de la plantilla que más se usa (100% de la barra). */
  readonly maxEnvios = input(1);
  readonly elegir = output<void>();

  protected readonly estado = computed(() => ESTADO_PLANTILLA[this.plantilla().estado]);
  protected readonly partes = computed(() => partes(this.plantilla().cuerpo, this.plantilla().ejemplos));
  protected readonly nota = computed(() => {
    const p = this.plantilla();
    if (p.estado === 'pendiente') return { t: 'Meta revisando', c: 'text-[#b45309]' };
    if (p.estado === 'rechazada') return { t: 'Rechazada', c: 'text-[#b42318]' };
    const pct = pctLeida(p);
    return { t: pct ? `${pct} la leen` : '', c: 'text-[#9ca3af]' };
  });
  protected readonly envios = computed(() => this.plantilla().uso?.enviados ?? 0);
  protected readonly barra = computed(() => `${(this.envios() / Math.max(1, this.maxEnvios())) * 100}%`);
}
