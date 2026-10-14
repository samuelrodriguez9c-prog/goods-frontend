import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { IconFlask, IconHandStop, IconKey, IconMoon, IconSparkles, IconSun, IconUser, IconUsers, TablerIconComponent } from '@tabler/icons-angular';
import { ClavePaso } from '../../automatico';
import { IaMarcaComponent } from '../../../../../../shared/ui/ia-marca/ia-marca.component';

export interface RespuestaSimulada {
  paso: ClavePaso | 'equipo';
  quien: string;
  texto: string;
}

const EJEMPLOS = ['¿Tienen catálogo?', '¿Aceptan Nequi?', 'Hola', '¿Precio del taladro?'];

/**
 * "Pruébalo" (handoff-whatsapp §6): el dueño escribe como si fuera un cliente,
 * elige cliente nuevo/conocido y tienda abierta/cerrada, y ve quién
 * respondería. La página calcula la respuesta con las reglas reales.
 */
@Component({
  selector: 'app-simulador-respuesta',
  imports: [IaMarcaComponent, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulador-respuesta.component.html',
  host: { class: 'block' },
})
export class SimuladorRespuestaComponent {
  readonly texto = model('');
  readonly nuevo = model(true);
  readonly abierto = model(true);
  readonly respuesta = input<RespuestaSimulada | null>(null);

  protected readonly ejemplos = EJEMPLOS;
  protected readonly i = { prueba: IconFlask, cliente: IconUser, sol: IconSun, luna: IconMoon };
  private readonly iconos: Record<RespuestaSimulada['paso'], typeof IconKey> = {
    palabras: IconKey,
    ia: IconSparkles,
    fuera: IconMoon,
    bienvenida: IconHandStop,
    equipo: IconUsers,
  };
  protected readonly icono = computed(() => this.iconos[this.respuesta()?.paso ?? 'equipo']);
}
