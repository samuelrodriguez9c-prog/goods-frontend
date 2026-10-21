import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconHandStop, IconKey, IconMoon, IconSparkles, IconUsers, TablerIconComponent } from '@tabler/icons-angular';
import { ClavePaso } from '../../automatico';
import { InterruptorComponent } from '../interruptor/interruptor.component';
import { IaMarcaComponent } from '../../../../../../shared/ui/ia-marca/ia-marca.component';

export interface PasoVista {
  k: ClavePaso;
  n: number;
  titulo: string;
  resumen: string;
  on: boolean;
  /** Se puede prender/apagar (permiso y, en la IA, que Goods la tenga). */
  editable: boolean;
}

/**
 * «Así responde Goods»: los cuatro pasos en orden de
 * prioridad, cada uno con número, interruptor y resumen. El elegido se edita a
 * la derecha; el que respondería en el simulador se ilumina en turquesa.
 */
@Component({
  selector: 'app-pasos-respuesta',
  imports: [IaMarcaComponent, TablerIconComponent, InterruptorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pasos-respuesta.component.html',
  host: { class: 'block' },
})
export class PasosRespuestaComponent {
  readonly pasos = input.required<PasoVista[]>();
  readonly elegido = input.required<ClavePaso>();
  /** Paso que respondería al mensaje del simulador ('equipo' = nadie). */
  readonly golpe = input<ClavePaso | 'equipo' | null>(null);
  readonly ocupado = input<ClavePaso | null>(null);
  readonly elegir = output<ClavePaso>();
  readonly alternar = output<ClavePaso>();

  protected readonly iconos: Record<ClavePaso, typeof IconKey> = { palabras: IconKey, ia: IconSparkles, fuera: IconMoon, bienvenida: IconHandStop };
  protected readonly iEquipo = IconUsers;

  protected claseNumero(p: PasoVista): string {
    if (this.golpe() === p.k) return 'bg-[#2be0d5] text-[#003331] shadow-[0_0_0_4px_rgba(43,224,213,.25)]';
    return p.on ? 'bg-[#303030] text-white' : 'bg-[#ececec] text-[#9ca3af]';
  }

  protected claseFila(p: PasoVista): string {
    const sel = this.elegido() === p.k;
    const sombra =
      this.golpe() === p.k
        ? 'shadow-[inset_0_0_0_1.5px_#2be0d5]'
        : sel
          ? 'shadow-[inset_0_0_0_1.5px_#303030]'
          : 'shadow-[inset_0_0_0_1px_#f0f0f0]';
    return `${sel ? 'bg-white' : 'bg-[#fafafa]'} ${sombra}`;
  }

  protected claseIcono(p: PasoVista): string {
    return !p.on ? 'text-[#c0c0c0]' : p.k === 'ia' ? 'text-[#00a39b]' : 'text-[#111827]';
  }
}
