import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { Area, MapaNiveles, Modulo, Nivel } from '../../../../../../core/roles/niveles';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { VistaModulo, resumenNiveles, vistaModulo } from '../../../../shared/permisos';
import { BarraNivelesComponent } from '../../../../shared/ui/barra-niveles/barra-niveles.component';
import { FilaModuloPermisosComponent } from '../../../../shared/ui/fila-modulo-permisos/fila-modulo-permisos.component';

/**
 * «Permisos por módulo» del rol: áreas en acordeón (una abierta a la vez) y,
 * dentro, cada módulo con su barra de niveles. La barra de la cabecera del
 * área fija todos sus módulos. Muestra el borrador (`actual`) contra lo
 * guardado (`base`); quien guarda es la página.
 */
@Component({
  selector: 'app-permisos-rol',
  standalone: true,
  imports: [IcComponent, BarraNivelesComponent, FilaModuloPermisosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  template: `
    <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5">
      <span class="flex flex-col gap-0.5">
        <span class="font-display text-[15px] font-semibold text-[#111827]"
          >Permisos por módulo</span
        >
        <span class="text-pretty text-xs leading-[17px] text-[#6b7280]">{{ ayuda() }}</span>
      </span>
      <span class="text-[11.5px] tabular-nums text-[#6b7280]">{{ resumen(actual()) }}</span>
    </div>
    <div class="flex flex-col gap-1.5">
      <div class="grid grid-cols-[minmax(0,1fr)_minmax(84px,132px)_14px] items-end gap-2 px-2.5">
        <span></span>
        <span
          class="grid grid-cols-3 gap-[3px] text-center text-[10px] font-semibold uppercase tracking-[.06em] text-[#9ca3af]"
          ><span>Ver</span><span>Editar</span><span>Todo</span></span
        >
        <span></span>
      </div>
      @for (a of areas(); track a.codigo) {
        @let ar = cabecera(a);
        <div class="rounded-[14px] bg-[#f6f6f6] p-1">
          <div
            class="grid min-h-11 grid-cols-[minmax(0,1fr)_minmax(84px,132px)_14px] items-center gap-2 pl-2 pr-1.5"
          >
            <button
              type="button"
              (click)="alternarArea(a.codigo)"
              [attr.aria-expanded]="ar.abierta"
              class="flex min-w-0 items-center gap-[9px] text-left"
            >
              <app-ic
                nombre="chevron-down"
                [size]="13"
                class="text-[#9ca3af] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
                [style.transform]="ar.abierta ? 'none' : 'rotate(-90deg)'"
              />
              <span class="flex min-w-0 flex-col gap-px">
                <span class="truncate text-[13px] font-semibold text-[#111827]">{{
                  a.nombre
                }}</span>
                <span class="truncate text-[11.5px] text-[#6b7280]" [title]="ar.sub">{{
                  ar.sub
                }}</span>
              </span>
            </button>
            @if (editable()) {
              <app-barra-niveles
                [min]="ar.min"
                [max]="ar.max"
                [alto]="14"
                [area]="a.nombre"
                (cambio)="fijarArea.emit({ modulos: a.modulos, nivel: $event })"
              />
            } @else {
              <span></span>
            }
            <span></span>
          </div>
          <div
            class="grid transition-[grid-template-rows] duration-[320ms] ease-[cubic-bezier(.2,.8,.2,1)]"
            [style.grid-template-rows]="ar.abierta ? '1fr' : '0fr'"
          >
            <div class="min-h-0 overflow-hidden">
              <div
                class="flex flex-col gap-0.5 rounded-[11px] bg-white p-1 shadow-[0_0_0_1px_#ececec]"
              >
                @for (m of a.modulos; track m.codigo) {
                  <app-fila-modulo-permisos
                    [modulo]="m"
                    [vista]="vista(m)"
                    [abierto]="modAbierto() === m.codigo"
                    [soloLectura]="!editable()"
                    (alternar)="alternarModulo(m.codigo)"
                    (cambio)="elegir(m.codigo, $event)"
                  />
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PermisosRolComponent {
  readonly areas = input.required<Area[]>();
  readonly base = input.required<MapaNiveles>();
  readonly actual = input.required<MapaNiveles>();
  readonly editable = input(false);
  readonly hayCambios = input(false);
  readonly fijarModulo = output<{ codigo: string; nivel: Nivel }>();
  readonly fijarArea = output<{ modulos: Modulo[]; nivel: Nivel }>();

  protected readonly areaAbierta = signal<string | null>(null);
  protected readonly modAbierto = signal<string | null>(null);
  protected readonly resumen = resumenNiveles;

  protected ayuda(): string {
    if (!this.editable()) return 'Solo lectura. Toca un módulo para ver lo que incluye.';
    return this.hayCambios()
      ? 'Vista previa: en verde lo que se suma y en rojo lo que se quita. Guarda desde la alerta de abajo.'
      : 'Toca un segmento para fijar el nivel; la barra de cada área los cambia todos a la vez. Tócalo otra vez para bajarlo.';
  }

  protected cabecera(a: Area) {
    const lv = a.modulos.map((m) => this.actual()[m.codigo] ?? 0);
    const cambian = a.modulos.filter(
      (m) => (this.actual()[m.codigo] ?? 0) !== (this.base()[m.codigo] ?? 0),
    ).length;
    const con = lv.filter(Boolean).length;
    return {
      min: Math.min(...lv) as Nivel,
      max: Math.max(...lv) as Nivel,
      sub: cambian
        ? `${cambian} ${cambian === 1 ? 'cambio' : 'cambios'} sin guardar`
        : `${con} de ${lv.length} con acceso`,
      abierta: this.areaAbierta() === a.codigo,
    };
  }

  protected vista(m: Modulo): VistaModulo {
    return vistaModulo(m, this.base()[m.codigo] ?? 0, this.actual()[m.codigo] ?? 0, {
      gana: 'Nuevo',
      pierde: 'Se quita',
    });
  }

  protected alternarArea(k: string): void {
    this.areaAbierta.update((a) => (a === k ? null : k));
    this.modAbierto.set(null);
  }

  protected alternarModulo(k: string): void {
    this.modAbierto.update((a) => (a === k ? null : k));
  }

  protected elegir(codigo: string, nivel: Nivel): void {
    this.fijarModulo.emit({ codigo, nivel });
    if (this.editable()) this.modAbierto.set(codigo);
  }
}
