import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { haceCuanto } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import {
  SolicitudLista,
  TIPO_UI,
  areaDe,
  esPublica,
  iconoArea,
  refDe,
} from '../../solicitudes.util';

/** Título de la ficha: tipo, referencia, área, título y quién la envió (o cuándo se publicó, si es del tablero). */
@Component({
  selector: 'app-cabecera-solicitud',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2.5' },
  template: `
    @let x = solicitud();
    @let tp = tipo();
    <div class="flex items-center gap-2 text-xs text-[#6b7280]">
      <span
        class="flex items-center gap-[5px] rounded-[7px] px-2 py-[3px] font-semibold"
        [style.background]="tp.bg"
        [style.color]="tp.fg"
        ><app-ic [nombre]="tp.icono" [size]="13" />{{ tp.t }}</span
      >
      <span class="font-mono text-[11.5px]">{{ ref() }}</span
      ><span class="size-[3px] rounded-full bg-[#d4d4d4]"></span
      ><span class="flex items-center gap-1"
        ><app-ic [nombre]="iconoArea()" [size]="13" />{{ area() }}</span
      >
    </div>
    <h2
      class="m-0 text-pretty font-display text-[22px] font-semibold leading-7 tracking-[-0.01em] text-[#111827]"
    >
      {{ x.titulo }}
    </h2>
    <span class="text-[12.5px] text-[#6b7280]">{{ linea() }}</span>
  `,
})
export class CabeceraSolicitudComponent {
  readonly solicitud = input.required<SolicitudLista>();
  readonly yoId = input(-1);

  protected readonly tipo = computed(() => TIPO_UI[this.solicitud().tipo]);
  protected readonly area = computed(() => areaDe(this.solicitud()));
  protected readonly iconoArea = computed(() => iconoArea(this.solicitud()));
  protected readonly ref = computed(() => refDe(this.solicitud().id));
  protected readonly linea = computed(() => {
    const x = this.solicitud();
    if (esPublica(x)) {
      const f = x.publicadaEn ?? x.actualizadoEn;
      return `De otras tiendas · publicada ${haceCuanto(f).toLowerCase()}`;
    }
    const c = x.creadaPor;
    const quien = c?.id === this.yoId() ? 'ti' : (c?.nombre ?? 'tu equipo');
    return `Enviada por ${quien} · ${haceCuanto(x.creadoEn).toLowerCase()}`;
  });
}
