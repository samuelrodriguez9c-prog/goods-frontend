import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
} from '@angular/core';
import { LugarVisible } from '../../../../../../core/campos/campo-personalizado.model';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { BorradorCampo, LUGARES, aplicaTienda, nombreEntidad } from '../../campos.util';
import { CambioCampo } from '../pestana-general/pestana-general.component';
import { SegmentosComponent } from '../segmentos/segmentos.component';
import { TarjetaCampoComponent } from '../tarjeta-campo/tarjeta-campo.component';

/**
 * Pestaña «Visibilidad»: dónde aparece el campo (el formulario siempre; la
 * tienda solo en productos y pedidos) y quién lo puede editar.
 *
 * @remarks
 * El backend guarda la preferencia de exportación e importación, pero esas
 * funciones todavía no existen: el interruptor no cambia nada hoy.
 */
@Component({
  selector: 'app-pestana-visibilidad',
  standalone: true,
  imports: [IcComponent, TarjetaCampoComponent, SegmentosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[st-fade-in-up_.2s_ease-out] flex-col gap-3' },
  template: `
    <app-tarjeta-campo
      class="!gap-1.5"
      icono="eye"
      titulo="Dónde aparece"
      descripcion="Solo aplica mientras el campo esté activo."
    >
      <div class="pt-2.5"></div>
      @for (x of lugares(); track x.k) {
        <button
          type="button"
          role="switch"
          [attr.aria-checked]="x.on"
          (click)="alternar(x.k)"
          [disabled]="x.fijo || soloLectura()"
          class="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-2.5 text-left transition-colors duration-150 hover:bg-[#fafafa] disabled:cursor-default"
          [style.opacity]="x.noAplica ? 0.5 : 1"
        >
          <span
            class="flex size-8 items-center justify-center rounded-[9px] bg-[#f4f4f4] text-[#4b5563]"
            ><app-ic [nombre]="x.icono" [size]="16"
          /></span>
          <span class="flex min-w-0 flex-col gap-0.5"
            ><span class="text-[13px] font-semibold text-[#303030]">{{ x.t }}</span
            ><span class="text-xs text-[#6b7280]">{{ x.d }}</span></span
          >
          <span
            class="relative h-5 w-[34px] shrink-0 rounded-full transition-colors duration-150"
            [style.background]="x.on ? '#303030' : '#d4d4d4'"
            ><span
              class="absolute top-0.5 size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left] duration-200"
              [style.left.px]="x.on ? 16 : 2"
            ></span
          ></span>
        </button>
      }
    </app-tarjeta-campo>

    <app-tarjeta-campo
      class="!gap-3.5"
      icono="users"
      titulo="Quién lo puede editar"
      [descripcion]="
        borrador().editan === 'admin'
          ? 'El resto del equipo lo ve, pero no lo puede cambiar.'
          : 'Cualquiera que pueda editar el registro puede llenarlo.'
      "
    >
      <app-segmentos
        class="grid-cols-2"
        [alto]="32"
        [tamano]="13"
        [items]="editan"
        [valor]="borrador().editan"
        [deshabilitado]="soloLectura()"
        (elegir)="cambio.emit({ k: 'editan', v: $any($event) })"
      />
    </app-tarjeta-campo>
  `,
})
export class PestanaVisibilidadComponent {
  readonly borrador = input.required<BorradorCampo>();
  readonly soloLectura = input(false, { transform: booleanAttribute });
  readonly cambio = output<CambioCampo>();

  protected readonly editan = [
    { k: 'todos', t: 'Todo el equipo' },
    { k: 'admin', t: 'Solo administradores' },
  ];
  protected readonly lugares = computed(() => {
    const b = this.borrador();
    const ent = nombreEntidad(b.entidad).toLowerCase();
    return LUGARES.map((l) => {
      const noAplica = l.k === 'tienda' && !aplicaTienda(b.entidad);
      const fijo = l.k === 'formulario' || noAplica;
      return {
        ...l,
        d: noAplica ? `No aplica a ${ent}.` : l.d.replace('{ent}', ent),
        on: l.k === 'formulario' || (!noAplica && b.visibilidad[l.k as LugarVisible]),
        fijo,
        noAplica,
      };
    });
  });

  protected alternar(k: string): void {
    const v = this.borrador().visibilidad;
    const lugar = k as LugarVisible;
    this.cambio.emit({ k: 'visibilidad', v: { ...v, [lugar]: !v[lugar] } });
  }
}
