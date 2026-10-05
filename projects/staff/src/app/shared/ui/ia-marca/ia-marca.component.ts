import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Marca del Asistente de IA (v3, 2026-10-02). Reemplaza a `IconRobot`.
 *
 * Un arco blanco de 280° (una "G" abierta) con un punto turquesa que se
 * escapa por la abertura, arriba a la derecha. Va siempre sobre un fondo
 * negro (#0a0a0a), que pone el contenedor.
 *
 * `ritmo`:
 *  - `quieto`: sin giro (cabeceras).
 *  - `reposo`: 8 s por vuelta (botón del borde en reposo).
 *  - `atento`: 1,4 s (hover / arrastre del botón).
 *  - `activo`: 1,1 s con ease (la IA está respondiendo; avatares).
 * `brillo`: halo y latido en el punto (solo el botón del borde).
 */
@Component({
  selector: 'app-ia-marca',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="relative block" [style.width.px]="size()" [style.height.px]="size()" [style.animation]="animacion()">
      <span class="absolute inset-0 rounded-full" [style]="arco()"></span>
      <span
        class="absolute rounded-full bg-[#2be0d5]"
        [class.ia-latido]="brillo()"
        [style.left.px]="punto().x"
        [style.top.px]="punto().y"
        [style.width.px]="punto().d"
        [style.height.px]="punto().d"
        [style.box-shadow]="brillo() ? '0 0 10px 1px rgba(43,224,213,0.7)' : 'none'"
      ></span>
    </span>
  `,
})
export class IaMarcaComponent {
  /** Diámetro en px: 26 en el botón del borde, 16 en cabeceras, 14-15 en avatares. */
  readonly size = input(16);
  readonly ritmo = input<'quieto' | 'reposo' | 'atento' | 'activo'>('quieto');
  readonly brillo = input(false);

  private readonly grosor = computed(() => +(this.size() * 0.19).toFixed(1));

  protected readonly arco = computed(() => {
    const t = this.grosor();
    const mask = `radial-gradient(farthest-side, transparent calc(100% - ${t}px), #000 calc(100% - ${t - 0.5}px))`;
    return {
      background: 'conic-gradient(from 85deg, #fff 0deg 280deg, transparent 280deg)',
      '-webkit-mask': mask,
      mask,
    };
  });

  /** El punto se centra sobre el trazo a 45° (arriba a la derecha), justo en la abertura. */
  protected readonly punto = computed(() => {
    const r = this.size() / 2;
    const rc = r - this.grosor() / 2;
    const o = rc * Math.SQRT1_2;
    const d = Math.round(this.size() * 0.31);
    return { x: +(r + o - d / 2).toFixed(1), y: +(r - o - d / 2).toFixed(1), d };
  });

  protected readonly animacion = computed(
    () =>
      ({
        quieto: 'none',
        reposo: 'ia-girar 8s linear infinite',
        atento: 'ia-girar 1.4s linear infinite',
        activo: 'ia-girar 1.1s cubic-bezier(0.55,0.15,0.45,0.85) infinite',
      })[this.ritmo()],
  );
}
