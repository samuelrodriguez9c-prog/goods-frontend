import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IcComponent } from '../ic/ic.component';

/**
 * Hoja de la derecha (lista + hoja de los módulos v5): tarjeta blanca con
 * cabecera fija (`[cabecera]`, `[pestanas]`) y cuerpo con scroll. Sin
 * registro abierto (`vacio`) muestra el aviso centrado.
 */
@Component({
  selector: 'app-hoja',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'relative z-[1] flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,.04),0_18px_40px_-24px_rgba(0,0,0,.22)]',
  },
  template: `
    @if (vacio()) {
      <div class="flex flex-1 animate-[fade-in-up_.25s_ease-out] flex-col items-center justify-center gap-2 p-10 text-center">
        <span class="mb-1 flex size-12 items-center justify-center rounded-full bg-[#f4f4f4] text-[#9ca3af]">
          <app-ic [nombre]="vacioIcono()" [size]="22" />
        </span>
        <span class="font-[Archivo] text-[16px] font-semibold text-[#111827]">{{ vacioTitulo() }}</span>
        <span class="max-w-70 text-[13px] leading-[19px] text-[#6b7280]">{{ vacioTexto() }}</span>
      </div>
    } @else {
      <div class="shrink-0 px-6 pt-4">
        <ng-content select="[cabecera]" />
        <ng-content select="[pestanas]" />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-8">
        <ng-content />
      </div>
    }
  `,
})
export class HojaComponent {
  readonly vacio = input(false);
  readonly vacioIcono = input('arrow-left');
  readonly vacioTitulo = input('');
  readonly vacioTexto = input('');
}
