import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';

export type PaisTienda = 'CO' | 'US' | 'otro';

/**
 * Paso 2 · el WhatsApp donde llegan los pedidos: país en segmento + número.
 * «Probar» abre WhatsApp con ese número para confirmar que es el correcto.
 */
@Component({
  selector: 'app-seccion-whatsapp',
  standalone: true,
  imports: [FormsModule, IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex gap-0.5 rounded-[10px] bg-[#f1f1f1] p-[3px]" role="radiogroup" aria-label="País del número">
        @for (o of paises; track o.k) {
          <button type="button" role="radio" [attr.aria-checked]="pais() === o.k" (click)="pais.set(o.k)"
            class="h-[30px] cursor-pointer rounded-lg px-2.5 text-[12.5px] whitespace-nowrap transition-[background-color,color,box-shadow] duration-200"
            [class]="pais() === o.k ? 'bg-white font-semibold text-[#111827] shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_1px_rgba(0,0,0,.04)]' : 'font-medium text-[#6b7280] hover:text-[#111827]'">{{ o.t }}</button>
        }
      </div>
      <input id="numero" name="numero" type="tel" inputmode="tel" [ngModel]="numero()" (ngModelChange)="numero.set($event)"
        [placeholder]="pais() === 'CO' ? '300 123 4567' : pais() === 'US' ? '305 555 0123' : 'Indicativo y número'" aria-label="Número de WhatsApp"
        class="min-w-[180px] flex-1 rounded-[10px] border bg-white px-3 py-2 text-[13px] font-medium text-[#111827] tabular-nums outline-none transition-[border-color,box-shadow] duration-200 placeholder:font-normal placeholder:text-[#a3a3a3] focus:shadow-[0_0_0_3px_rgba(48,48,48,.08)]"
        [class]="valido() ? 'border-[#e3e3e3] focus:border-[#303030]' : 'border-[#d82c0d]'" />
      @if (whatsapp() && valido()) {
        <a [href]="'https://wa.me/' + whatsapp()" target="_blank" rel="noopener" title="Abre WhatsApp con este número"
          class="flex h-[36px] items-center gap-1.5 rounded-[10px] bg-[#e6f6ec] px-3 text-[12.5px] font-medium text-[#087b5d] transition-colors hover:bg-[#d3f0de]">
          <app-ic nombre="whatsapp" [size]="15" />Probar
        </a>
      }
    </div>
    @if (!valido()) {
      <p class="m-0 mt-1.5 text-[12px] text-[#b42318]">
        {{ pais() === 'CO' ? 'Un celular de Colombia tiene 10 dígitos y empieza por 3.' : pais() === 'US' ? 'Un número de EE. UU. tiene 10 dígitos.' : 'Escribe el indicativo del país y el número, entre 8 y 15 dígitos.' }}
      </p>
    } @else {
      <p class="m-0 mt-1.5 text-[12px] text-[#8a8a8a]">Puede ser el de WhatsApp Business o el personal. No se lo damos a nadie más.</p>
    }
  `,
})
export class SeccionWhatsappComponent {
  readonly pais = model.required<PaisTienda>();
  readonly numero = model.required<string>();
  readonly whatsapp = input<string | null>(null);
  readonly valido = input(true);
  protected readonly paises: { k: PaisTienda; t: string }[] = [
    { k: 'CO', t: '🇨🇴 +57' },
    { k: 'US', t: '🇺🇸 +1' },
    { k: 'otro', t: 'Otro país' },
  ];
}
