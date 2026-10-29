import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ESTADO_SOLICITUD } from '../../../../../../core/solicitudes/models/solicitud.model';
import { haceCuanto } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import {
  ICONO_ESTADO,
  SolicitudLista,
  TIPO_UI,
  areaDe,
  esPublica,
  iconoArea,
  refDe,
  tonoDe,
} from '../../solicitudes.util';

/**
 * Contenido de la fila de una solicitud (propia o del tablero): tipo con sello
 * de estado, título, estado · área · referencia, cuándo cambió y sus votos.
 */
@Component({
  selector: 'app-fila-solicitud',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @let x = solicitud();
    @let tn = tono();
    @let tp = tipo();
    @let chip = resaltada() ? '#f4f4f4' : '#e6e6e6';
    <span
      class="relative flex size-[38px] items-center justify-center rounded-[11px]"
      [style.background]="tp.bg"
      [style.color]="tp.fg"
    >
      <app-ic [nombre]="tp.icono" [size]="17" />
      <span
        [title]="estado().texto"
        class="absolute -bottom-[3px] -right-[3px] flex size-[18px] items-center justify-center rounded-full"
        [style.background]="tn.bg"
        [style.color]="tn.fg"
        [style.box-shadow]="'0 0 0 2px ' + (resaltada() ? '#fff' : '#f1f1f1')"
        ><app-ic [nombre]="iconoEstado()" [size]="10"
      /></span>
    </span>
    <span class="flex min-w-0 flex-col gap-[5px]">
      <span class="flex min-w-0 items-center gap-1.5">
        @if (nuevo()) {
          <span
            title="Nueva respuesta"
            class="size-[7px] shrink-0 rounded-full bg-[#2be0d5] shadow-[0_0_0_3px_rgba(43,224,213,.2)]"
          ></span>
        }
        <span
          class="line-clamp-2 min-w-0 text-pretty text-[13px] font-semibold leading-[18px] text-[#111827]"
          >{{ x.titulo }}</span
        >
      </span>
      <span class="flex min-w-0 flex-wrap items-center gap-1">
        <span
          class="inline-flex h-5 items-center gap-[5px] rounded-md px-[7px] text-[11px] font-medium"
          [style.background]="tn.bg"
          [style.color]="tn.fg"
          ><span class="size-1.5 rounded-full" [style.background]="tn.punto"></span
          >{{ estado().texto }}</span
        >
        <span
          class="inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-[#4b5563]"
          [style.background]="chip"
          ><app-ic [nombre]="iconoArea()" [size]="11" />{{ area() }}</span
        >
        <span
          class="inline-flex h-5 items-center rounded-md px-1.5 font-mono text-[10.5px] font-medium text-[#6b7280]"
          [style.background]="chip"
          >{{ ref() }}</span
        >
      </span>
    </span>
    <span class="flex flex-col items-end gap-1.5 pt-px">
      <span class="whitespace-nowrap text-[11.5px] font-medium tabular-nums text-[#9ca3af]">{{
        cuando()
      }}</span>
      <span
        [title]="votoTitulo()"
        class="flex items-center gap-0.5 text-[11.5px] font-semibold tabular-nums"
        [style.color]="votado() ? '#00a39b' : '#9ca3af'"
        ><app-ic [nombre]="votado() ? 'caret-up-filled' : 'caret-up'" [size]="13" />{{
          x.votos
        }}</span
      >
    </span>
  `,
})
export class FilaSolicitudComponent {
  readonly solicitud = input.required<SolicitudLista>();
  readonly resaltada = input(false);

  protected readonly tono = computed(() => tonoDe(this.solicitud()));
  protected readonly tipo = computed(() => TIPO_UI[this.solicitud().tipo]);
  protected readonly estado = computed(() => ESTADO_SOLICITUD[this.solicitud().estado]);
  protected readonly iconoEstado = computed(() => ICONO_ESTADO[this.solicitud().estado]);
  protected readonly area = computed(() => areaDe(this.solicitud()));
  protected readonly iconoArea = computed(() => iconoArea(this.solicitud()));
  protected readonly ref = computed(() => refDe(this.solicitud().id));
  protected readonly cuando = computed(() => haceCuanto(this.solicitud().actualizadoEn));
  protected readonly nuevo = computed(() => {
    const x = this.solicitud();
    return !esPublica(x) && x.ultimaRespuestaDeGoods;
  });
  /** En el tablero: si la tienda la votó o ya la había pedido. */
  protected readonly votado = computed(() => {
    const x = this.solicitud();
    return esPublica(x) && (x.voto || x.esMia);
  });
  protected readonly votoTitulo = computed(() => {
    const x = this.solicitud();
    if (esPublica(x) && x.esMia) return 'Tu tienda ya la pidió';
    if (esPublica(x) && x.voto) return 'Te interesa';
    return x.votos === 1 ? '1 tienda la pide' : `${x.votos} tiendas la piden`;
  });
}
