import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Marca del Asistente de IA (reemplaza a `IconRobot`): un anillo turquesa
 * con estela que gira y un punto central que late. `ritmo` controla la
 * velocidad del giro: `reposo` 6 s · `atento` 1,4 s (hover/arrastre) ·
 * `activo` 1 s (la IA está respondiendo).
 */
@Component({
  selector: 'app-ia-marca',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="relative block" [style.width.px]="size()" [style.height.px]="size()">
      <span
        class="absolute inset-0 rounded-full"
        style="background: conic-gradient(from 0deg, rgba(43,224,213,0) 0deg, rgba(43,224,213,0.15) 120deg, #2be0d5 310deg, #e6fffd 360deg)"
        [style.animation]="'ia-girar ' + duracion() + ' linear infinite'"
      ></span>
      <span class="absolute rounded-full bg-[#0a0a0a]" [style.inset.px]="grosor()"></span>
      <span
        class="absolute left-1/2 top-1/2 rounded-full bg-[#2be0d5]"
        [class.ia-latido]="latir()"
        [style.width.px]="punto()"
        [style.height.px]="punto()"
        [style.margin-left.px]="-punto() / 2"
        [style.margin-top.px]="-punto() / 2"
        [style.box-shadow]="size() >= 20 ? '0 0 10px 1px rgba(43,224,213,0.7)' : '0 0 6px rgba(43,224,213,0.7)'"
      ></span>
    </span>
  `,
})
export class IaMarcaComponent {
  /** Diámetro en px: 26 en el botón flotante, 16 en cabeceras, 14 en avatares. */
  readonly size = input(16);
  readonly ritmo = input<'reposo' | 'atento' | 'activo'>('reposo');
  readonly latir = input(false);

  protected readonly duracion = computed(() => ({ reposo: '6s', atento: '1.4s', activo: '1s' })[this.ritmo()]);
  protected readonly grosor = computed(() => (this.size() >= 20 ? 3 : 2));
  protected readonly punto = computed(() => Math.round(this.size() * 0.3));
}
