import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Indicador "la IA está escribiendo" (v3). Reemplaza al texto
 * "Pensando…" / "Consultando …": solo tres puntos en una píldora gris.
 * Cada punto sube, crece y pasa por turquesa (`ia-tecleo`, 1,25 s,
 * desfase de 160 ms).
 */
@Component({
  selector: 'app-ia-escribiendo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="status"
      aria-label="El asistente está escribiendo"
      class="ia-msg-in flex items-center gap-[5px] self-start rounded-full bg-[#f4f4f4] px-3.5 shadow-[inset_0_0_0_1px_#ececec]"
      [style.height.px]="alto()"
    >
      @for (n of [0, 1, 2]; track n) {
        <span class="ia-tecleo size-[7px] rounded-full bg-[#0a0a0a]" [style.animation-delay.ms]="n * 160"></span>
      }
    </div>
  `,
})
export class IaEscribiendoComponent {
  /** 34 en pantalla completa, 30 en el mini chat. */
  readonly alto = input(34);
}
