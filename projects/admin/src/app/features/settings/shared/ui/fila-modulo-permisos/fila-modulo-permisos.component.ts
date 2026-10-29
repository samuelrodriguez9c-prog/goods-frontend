import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Modulo, Nivel } from '../../../../../core/roles/niveles';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';
import { VistaModulo } from '../../permisos';
import { BarraNivelesComponent } from '../barra-niveles/barra-niveles.component';

/**
 * Fila de un módulo en «Permisos por módulo»: ícono, nombre, nivel (o el
 * cambio propuesto), la barra Ver · Editar · Todo y, al abrirla, cada
 * permiso con lo que gana o pierde.
 *
 * `detalle`: qué se muestra a la derecha de cada permiso, el código
 * (`pedidos.ver`, en Roles) o el nivel que lo incluye (en Usuarios).
 */
@Component({
  selector: 'app-fila-modulo-permisos',
  standalone: true,
  imports: [IcComponent, BarraNivelesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block rounded-[9px] transition-colors duration-200',
    '[style.background]': "abierto() ? '#f8f8f8' : 'transparent'",
  },
  template: `
    @let p = vista();
    <div
      class="grid min-h-11 grid-cols-[minmax(0,1fr)_minmax(84px,132px)_14px] items-center gap-2 px-1.5"
    >
      <button
        type="button"
        (click)="alternar.emit()"
        [attr.aria-expanded]="abierto()"
        class="flex min-w-0 items-center gap-[9px] text-left"
      >
        <span
          class="flex size-[26px] shrink-0 items-center justify-center rounded-lg transition-colors duration-[250ms]"
          [style.background]="p.iBg"
          [style.color]="p.iColor"
          ><app-ic [nombre]="modulo().icono" [size]="13"
        /></span>
        <span class="flex min-w-0 flex-col gap-px">
          <span class="truncate text-[13px] font-medium" [style.color]="p.tColor">{{
            modulo().nombre
          }}</span>
          <span
            class="flex min-w-0 items-center gap-[3px] whitespace-nowrap text-[11.5px] transition-colors duration-[250ms]"
            [style.color]="p.color"
          >
            @if (p.cambia) {
              <app-ic
                [nombre]="p.sube ? 'arrow-up-right' : 'arrow-down-right'"
                [size]="12"
                class="shrink-0"
              />
            }
            <span class="min-w-0 truncate">{{ p.nivel }}</span>
          </span>
        </span>
      </button>
      <app-barra-niveles
        [base]="p.a"
        [valor]="p.b"
        [soloLectura]="soloLectura()"
        (cambio)="cambio.emit($event)"
      />
      <button
        type="button"
        (click)="alternar.emit()"
        aria-label="Ver qué incluye"
        class="flex justify-end text-[#9ca3af]"
      >
        <app-ic
          nombre="chevron-down"
          [size]="14"
          class="transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
          [style.transform]="abierto() ? 'rotate(180deg)' : 'none'"
        />
      </button>
    </div>
    <div
      class="grid transition-[grid-template-rows] duration-[320ms] ease-[cubic-bezier(.2,.8,.2,1)]"
      [style.grid-template-rows]="abierto() ? '1fr' : '0fr'"
    >
      <div class="min-h-0 overflow-hidden">
        <div class="flex flex-col gap-0.5 pb-2.5 pl-[41px] pr-2.5">
          @for (x of p.acciones; track x.codigo) {
            <div
              class="flex min-h-7 items-center gap-2 text-[12.5px] transition-colors duration-[250ms]"
              [style.color]="x.color"
            >
              <span
                class="flex size-4 shrink-0 items-center justify-center rounded-full transition-colors duration-[250ms]"
                [style.background]="x.icBg"
                [style.color]="x.icColor"
                ><app-ic [nombre]="x.icono" [size]="10"
              /></span>
              <span class="min-w-0 flex-1">{{ x.t }}</span>
              @if (detalle() === 'codigo') {
                <span
                  class="shrink-0 rounded-[5px] bg-[#f4f4f4] px-1.5 py-px font-mono text-[10.5px] text-[#6b7280]"
                  >{{ x.codigo }}</span
                >
              } @else {
                <span class="shrink-0 text-[10.5px] text-[#b5b5b5]">{{ x.nivel }}</span>
              }
              @if (x.tag) {
                <span
                  class="shrink-0 animate-[st-pop_.25s_both] rounded-[5px] px-1.5 text-[10.5px] font-semibold"
                  [style.background]="x.tagBg"
                  [style.color]="x.tagColor"
                  >{{ x.tag }}</span
                >
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class FilaModuloPermisosComponent {
  readonly modulo = input.required<Modulo>();
  readonly vista = input.required<VistaModulo>();
  readonly abierto = input(false);
  readonly soloLectura = input(false);
  readonly detalle = input<'codigo' | 'nivel'>('codigo');
  readonly alternar = output<void>();
  readonly cambio = output<Nivel>();
}
