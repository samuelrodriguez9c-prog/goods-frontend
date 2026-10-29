import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  ESTADO_SOLICITUD,
  IMPACTO_SOLICITUD,
} from '../../../../../../core/solicitudes/models/solicitud.model';
import { haceCuanto, iniciales, tonoPersona } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import {
  SolicitudLista,
  TIPO_UI,
  areaCompleta,
  esPublica,
  iconoAreaCompleta,
  refDe,
  tonoDe,
} from '../../solicitudes.util';

type Fila =
  | { t: string; k: 'chip'; v: string; bg: string; fg: string; punto: string }
  | { t: string; k: 'icono'; v: string; icono: string; bg: string; fg: string }
  | { t: string; k: 'ref'; v: string }
  | { t: string; k: 'persona'; v: string; ini: string; bg: string; fg: string };

const GRIS = { bg: '#f1f1f1', fg: '#4b5563' };

/**
 * Lateral de la ficha: «Solicitud» (estado, tipo, área, referencia) y
 * «Seguimiento» (quién la envió y la última novedad; en el tablero, cuántas
 * tiendas la piden y cuándo se publicó).
 *
 * @remarks El «Alcance»
 * no está en el prototipo, pero sale solo cuando Goods lo definió (si es
 * exclusiva, con su costo mensual).
 */
@Component({
  selector: 'app-detalles-solicitud',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 pt-1.5' },
  template: `
    @for (g of grupos(); track g.t) {
      <div class="flex flex-col gap-0.5 border-t border-[#f1f1f1] pt-3">
        <span
          class="pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.06em] text-[#9ca3af]"
          >{{ g.t }}</span
        >
        @for (d of g.filas; track d.t) {
          <div class="grid min-h-[30px] grid-cols-[104px_minmax(0,1fr)] items-center gap-2.5">
            <span class="text-[12.5px] text-[#6b7280]">{{ d.t }}</span>
            <span class="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-[#111827]">
              @switch (d.k) {
                @case ('chip') {
                  <span
                    class="inline-flex h-[22px] items-center gap-[5px] rounded-md px-2 text-xs font-medium"
                    [style.background]="d.bg"
                    [style.color]="d.fg"
                    ><span class="size-1.5 rounded-full" [style.background]="d.punto"></span
                    >{{ d.v }}</span
                  >
                }
                @case ('icono') {
                  <span
                    class="flex size-[22px] shrink-0 items-center justify-center rounded-[7px]"
                    [style.background]="d.bg"
                    [style.color]="d.fg"
                    ><app-ic [nombre]="d.icono" [size]="12"
                  /></span>
                  <span class="truncate">{{ d.v }}</span>
                }
                @case ('ref') {
                  <span
                    class="inline-flex h-[22px] items-center rounded-md bg-[#f4f4f4] px-[7px] font-mono text-[11.5px] text-[#4b5563]"
                    >{{ d.v }}</span
                  >
                }
                @case ('persona') {
                  <span
                    class="flex size-[22px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                    [style.background]="d.bg"
                    [style.color]="d.fg"
                    >{{ d.ini }}</span
                  >
                  <span class="truncate">{{ d.v }}</span>
                }
              }
            </span>
          </div>
        }
      </div>
    }
  `,
})
export class DetallesSolicitudComponent {
  readonly solicitud = input.required<SolicitudLista>();
  readonly yoId = input(-1);

  protected readonly grupos = computed<{ t: string; filas: Fila[] }[]>(() => {
    const x = this.solicitud();
    const tn = tonoDe(x);
    const tp = TIPO_UI[x.tipo];
    const solicitud: Fila[] = [
      {
        t: 'Estado',
        k: 'chip',
        v: ESTADO_SOLICITUD[x.estado].texto,
        bg: tn.bg,
        fg: tn.fg,
        punto: tn.punto,
      },
      { t: 'Tipo', k: 'icono', v: tp.t, icono: tp.icono, bg: tp.bg, fg: tp.fg },
      { t: 'Área', k: 'icono', v: areaCompleta(x), icono: iconoAreaCompleta(x), ...GRIS },
      { t: 'Referencia', k: 'ref', v: refDe(x.id) },
    ];
    const novedad: Fila = {
      t: 'Última novedad',
      k: 'icono',
      v: haceCuanto(x.actualizadoEn),
      icono: 'clock',
      ...GRIS,
    };
    let seguimiento: Fila[];
    if (esPublica(x)) {
      seguimiento = [
        {
          t: 'La piden',
          k: 'icono',
          v: `${x.votos} ${x.votos === 1 ? 'tienda' : 'tiendas'}`,
          icono: 'building-community',
          ...GRIS,
        },
        {
          t: 'Publicada',
          k: 'icono',
          v: haceCuanto(x.publicadaEn ?? x.actualizadoEn),
          icono: 'calendar',
          ...GRIS,
        },
        novedad,
      ];
    } else {
      const c = x.creadaPor;
      const nombre = c ? (c.id === this.yoId() ? 'Tú' : c.nombre) : 'Tu equipo';
      const [bg, fg] = tonoPersona(c?.nombre ?? nombre);
      seguimiento = [
        { t: 'Enviada por', k: 'persona', v: nombre, ini: iniciales(c?.nombre ?? nombre), bg, fg },
      ];
      if (x.impacto)
        seguimiento.push({
          t: 'Impacto',
          k: 'icono',
          v: IMPACTO_SOLICITUD[x.impacto],
          icono: 'gauge',
          ...GRIS,
        });
      if (x.alcance) {
        seguimiento.push({
          t: 'Alcance',
          k: 'icono',
          v:
            x.alcance === 'exclusiva'
              ? 'Solo tu tienda' + (x.costoMensual ? ` · $${x.costoMensual}/mes` : '')
              : 'Todas las tiendas',
          icono: x.alcance === 'exclusiva' ? 'building-store' : 'world',
          ...GRIS,
        });
      }
      seguimiento.push(novedad);
    }
    return [
      { t: 'Solicitud', filas: solicitud },
      { t: 'Seguimiento', filas: seguimiento },
    ];
  });
}
