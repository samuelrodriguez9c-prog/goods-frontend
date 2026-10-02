import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * Saludo de bienvenida del asistente, en tres líneas apiladas:
 *   1. "Buenas noches, Laura"  (chico, gris; nombre con degradé gris→negro)
 *   2. "¿Qué revisamos hoy en" (mediano; "¿Qué revisamos" oscuro, "hoy en" gris claro)
 *   3. "Goods?"                (gigante; cada letra entra por separado)
 * Interacción: el degradé de "Goods" sigue al cursor (posición X sobre el
 * saludo) y cada letra salta/rota con rebote al pasar el mouse.
 */
@Component({
  selector: 'app-ia-saludo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2
      (mousemove)="mover($event)"
      (mouseleave)="gx.set(50)"
      class="m-0 flex max-w-full flex-col font-['Archivo',sans-serif] font-semibold leading-none"
      [class.items-center]="centrado()"
      [class.items-start]="!centrado()"
      [class.w-max]="centrado()"
      [class.px-2]="!centrado()"
    >
      <span
        class="flex flex-wrap gap-x-[0.3em] font-['Inter',sans-serif] font-medium leading-[1.3] text-[#6b7280]"
        [class.justify-center]="centrado()"
        [style.font-size.px]="mini() ? 13.5 : 15"
        [style.margin-bottom.px]="mini() ? 10 : 14"
      >
        @for (w of saludo(); track $index) {
          <span class="ia-palabra inline-block" [style.animation-delay.ms]="60 + $index * 110">{{ w }}</span>
        }
        <span class="ia-palabra ia-degrade-nombre inline-block font-semibold" [style.animation-delay.ms]="dNombre()">{{ nombre() }}</span>
      </span>

      <span
        class="flex flex-wrap gap-x-[0.24em] leading-[1.1] tracking-[-0.03em]"
        [class.justify-center]="centrado()"
        [style.font-size]="mini() ? '22px' : 'clamp(22px, 3.6vh, 34px)'"
      >
        @for (w of ['¿Qué', 'revisamos']; track $index) {
          <span class="ia-palabra inline-block text-[#111827]" [style.animation-delay.ms]="dNombre() + 240 + $index * 90">{{ w }}</span>
        }
        @for (w of ['hoy', 'en']; track $index) {
          <span class="ia-palabra inline-block text-[#b4b4b4]" [style.animation-delay.ms]="dNombre() + 420 + $index * 90">{{ w }}</span>
        }
      </span>

      <span
        class="flex items-end leading-[0.92] tracking-[-0.055em]"
        [class.justify-center]="centrado()"
        [style.margin-top.px]="mini() ? 2 : 4"
        [style.font-size]="mini() ? '64px' : 'clamp(70px, 12vh, 120px)'"
      >
        @for (l of letras; track $index) {
          <span class="ia-letra inline-block" [style.animation-delay.ms]="dNombre() + 620 + $index * 75">
            <span
              class="ia-degrade-goods inline-block cursor-default origin-[50%_90%] px-[0.02em] pb-[0.1em] transition-[translate,scale,rotate,background-position] duration-[460ms] ease-[cubic-bezier(0.3,1.7,0.5,1)] hover:-translate-y-[0.14em] hover:scale-[1.08] hover:-rotate-[4deg]"
              [style.background-position]="(gx() * 0.5 + $index * 12.5).toFixed(1) + '% 50%'"
            >{{ l }}</span>
          </span>
        }
        <span class="ia-letra inline-block" [style.animation-delay.ms]="dNombre() + 620 + 5 * 75">
          <span class="inline-block cursor-default origin-[50%_90%] pb-[0.1em] pl-[0.04em] text-[#111827] transition-[translate,rotate] duration-[520ms] ease-[cubic-bezier(0.3,1.7,0.5,1)] hover:rotate-[16deg] hover:-translate-y-[0.06em]">?</span>
        </span>
      </span>
    </h2>
  `,
})
export class IaSaludoComponent {
  readonly nombre = input.required<string>();
  /** `completo`: centrado y grande (pantalla completa) · `mini`: alineado a la izquierda. */
  readonly variante = input<'completo' | 'mini'>('completo');

  protected readonly mini = computed(() => this.variante() === 'mini');
  protected readonly centrado = computed(() => !this.mini());
  protected readonly gx = signal(50);
  protected readonly letras = ['G', 'o', 'o', 'd', 's'];

  protected readonly saludo = computed(() => {
    const h = new Date().getHours();
    return (h < 12 ? 'Buenos días,' : h < 19 ? 'Buenas tardes,' : 'Buenas noches,').split(' ');
  });
  protected readonly dNombre = computed(() => 60 + this.saludo().length * 110);

  private raf = 0;
  protected mover(e: MouseEvent): void {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const v = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.gx.set(v);
    });
  }
}
