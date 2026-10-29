import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Usuario } from '../../../../../../core/usuarios/models/usuario.model';
import { PopoverDirective } from '../../../../../../shared/ui/popover.directive';
import { iniciales, tonoPersona } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { iconoRol } from '../../../../shared/permisos';
import { PuntoRadioComponent } from '../../../../shared/ui/punto-radio/punto-radio.component';
import { ESTADO_USUARIO, estadoDe, nombreDe } from '../../../../shared/usuarios';
import { RolUsuario, arbolRoles, textoAcceso } from '../../usuarios.util';

/**
 * Cabecera de la ficha de una persona: avatar (con punto verde si está en
 * línea), nombre, estado y cuándo entró; a la derecha su rol con el engranaje
 * que abre «Cambiar rol». Elegir un rol solo lo propone (`proponer`); se
 * aplica desde «Permisos por módulo». Tu propio rol no se cambia.
 */
@Component({
  selector: 'app-identidad-usuario',
  standalone: true,
  imports: [IcComponent, PopoverDirective, PuntoRadioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative flex flex-wrap items-center gap-3.5' },
  template: `
    @let e = estado();
    @let el = elegido();
    <span
      class="relative flex size-14 shrink-0 items-center justify-center rounded-full font-display text-lg font-semibold"
      [style.background]="tono()[0]"
      [style.color]="tono()[1]"
    >
      {{ ini() }}
      @if (enLinea()) {
        <span
          title="En línea"
          class="absolute right-px bottom-px size-3.5 rounded-full bg-[#29845a] shadow-[0_0_0_3px_#fff]"
        ></span>
      }
    </span>
    <div class="flex min-w-[180px] flex-[1_1_200px] flex-col gap-1.5">
      <span class="flex flex-wrap items-center gap-2">
        <span
          class="font-display text-[22px] leading-[26px] font-semibold tracking-[-0.01em] text-[#111827]"
          >{{ nombre() }}</span
        >
        @if (yo()) {
          <span
            class="rounded-md bg-[#f1f1f1] px-[7px] py-px text-[11.5px] font-semibold text-[#4b5563]"
            >Tú</span
          >
        }
      </span>
      <span class="flex flex-wrap items-center gap-1.5">
        <span
          class="inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-md px-2 text-[11.5px] font-medium"
          [style.background]="e.bg"
          [style.color]="e.fg"
          ><span class="size-1.5 rounded-full" [style.background]="e.punto"></span>{{ e.t }}</span
        >
        <span class="whitespace-nowrap text-xs text-[#9ca3af]">{{ acceso() }}</span>
      </span>
    </div>

    <span class="relative ml-auto shrink-0 self-start">
      <div class="flex items-center gap-3">
        <span class="flex min-w-0 flex-col items-end gap-0.5 text-right">
          <span class="text-[10.5px] font-semibold tracking-[.06em] text-[#9ca3af] uppercase"
            >Rol</span
          >
          <span
            class="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-[#111827]"
          >
            @if (propuesto()) {
              <span
                class="rounded-[5px] bg-[#e7f6ec] px-[5px] text-[10.5px] font-semibold text-[#1f6b43]"
                >Sin aplicar</span
              >
            }
            {{ el?.nombre }}
          </span>
          <span class="whitespace-nowrap text-[11.5px] text-[#6b7280]">{{ info() }}</span>
        </span>
        <span
          class="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-[#303030] text-white transition-shadow duration-200"
          [style.box-shadow]="anillo()"
        >
          <app-ic [nombre]="iconoDe(el)" [size]="20" />
          <button
            type="button"
            (click)="$event.stopPropagation(); yo() || alternarMenu.emit()"
            [title]="yo() ? 'Tu propio rol no se puede cambiar' : 'Cambiar rol'"
            aria-label="Cambiar rol"
            class="absolute -right-[3px] -bottom-[3px] flex size-[18px] items-center justify-center rounded-full bg-white text-[#303030] shadow-[0_0_0_2px_#fff,0_0_0_3px_#e5e5e5,0_2px_5px_rgba(0,0,0,.14)] transition-[transform,color] duration-[350ms] ease-[cubic-bezier(.3,1.4,.5,1)] hover:text-black"
            [style.cursor]="yo() ? 'default' : 'pointer'"
            [style.transform]="menuAbierto() ? 'rotate(90deg)' : 'none'"
          >
            <app-ic [nombre]="yo() ? 'lock' : 'settings'" [size]="11" />
          </button>
        </span>
      </div>

      <div
        [appPopover]="menuAbierto() && !yo()"
        (click)="$event.stopPropagation()"
        class="absolute top-[calc(100%+8px)] right-0 z-[45] flex w-[300px] max-w-full origin-top-right flex-col rounded-[14px] bg-white p-1.5 shadow-[0_0_0_1px_rgba(0,0,0,.06),0_24px_48px_-20px_rgba(0,0,0,.35)] [transition:opacity_.18s_ease,_transform_.26s_cubic-bezier(.2,.8,.2,1)]"
      >
        <div class="flex flex-col gap-px px-2 pt-1.5 pb-2">
          <span class="font-display text-sm font-semibold text-[#111827]">Cambiar rol</span>
          <span class="text-[11.5px] leading-4 text-[#6b7280]"
            >Elige uno para ver qué gana o pierde antes de aplicarlo.</span
          >
        </div>
        @for (g of arbol(); track g.t; let gi = $index) {
          <div class="flex h-[30px] items-center gap-2 px-2" [style.margin-top.px]="gi ? 6 : 0">
            <span
              class="flex size-[22px] items-center justify-center rounded-[7px] bg-[#efefef] text-[#4b5563]"
              ><app-ic [nombre]="g.icono" [size]="12"
            /></span>
            <span class="text-xs font-semibold text-[#111827]">{{ g.t }}</span>
            <span class="text-[11px] tabular-nums text-[#9ca3af]">{{ g.roles.length }}</span>
          </div>
          @for (r of g.roles; track r.id) {
            @let on = el?.id === r.id;
            <button
              type="button"
              (click)="proponer.emit(r)"
              class="group flex min-h-[42px] w-full items-center rounded-[9px] py-1 pr-2 pl-[30px] text-left transition-colors duration-150 hover:bg-[#f7f7f7]"
            >
              <app-punto-radio variante="aparece" [on]="on" />
              <span class="flex min-w-0 flex-1 flex-col gap-px">
                <span class="flex items-center gap-1.5 text-[12.5px] font-medium text-[#111827]">
                  {{ r.nombre }}
                  @if (r.id === usuario().rolId) {
                    <span
                      class="rounded-[5px] bg-[#f1f1f1] px-[5px] text-[10.5px] font-semibold text-[#6b7280]"
                      >Actual</span
                    >
                  }
                </span>
                <span class="truncate text-[11.5px] text-[#8a8a8a]">{{ r.descripcion }}</span>
              </span>
              <span
                title="Módulos con acceso"
                class="ml-2 text-[11px] tabular-nums text-[#9ca3af]"
                >{{ r.modulosTexto }}</span
              >
            </button>
          }
        }
        <div
          class="-mx-1.5 mt-1 -mb-1.5 flex items-center justify-between gap-2.5 rounded-b-[14px] border-t border-[#f1f1f1] bg-[#fafafa] px-3 py-2"
        >
          <button
            type="button"
            (click)="gestionarRoles.emit()"
            class="text-xs font-medium text-[#4b5563] underline decoration-[#c9c9c9] underline-offset-2 hover:text-[#111827] hover:decoration-[#111827]"
          >
            Gestionar roles y permisos
          </button>
          <span class="flex items-center gap-1 text-[11px] text-[#9ca3af]"
            ><kbd
              class="flex h-[18px] items-center rounded bg-[#ececec] px-[5px] font-sans text-[10.5px] font-semibold text-[#6b7280]"
              >Esc</kbd
            >cerrar</span
          >
        </div>
      </div>
    </span>
  `,
})
export class IdentidadUsuarioComponent {
  readonly usuario = input.required<Usuario>();
  readonly yo = input(false);
  readonly enLinea = input(false);
  readonly roles = input.required<RolUsuario[]>();
  readonly totalModulos = input(0);
  readonly actual = input<RolUsuario | null>(null);
  readonly propuesto = input<RolUsuario | null>(null);
  readonly menuAbierto = input(false);
  readonly alternarMenu = output<void>();
  readonly proponer = output<RolUsuario>();
  readonly gestionarRoles = output<void>();

  protected readonly iconoDe = iconoRol;
  protected readonly nombre = computed(() => nombreDe(this.usuario()));
  protected readonly ini = computed(() => iniciales(this.nombre()));
  protected readonly tono = computed(() => tonoPersona(this.nombre()));
  protected readonly estado = computed(() => ESTADO_USUARIO[estadoDe(this.usuario())]);
  protected readonly acceso = computed(() => textoAcceso(this.usuario(), this.enLinea()));
  protected readonly arbol = computed(() => arbolRoles(this.roles()));
  /** El rol que se está mostrando: el propuesto o el actual. */
  protected readonly elegido = computed(() => this.propuesto() ?? this.actual());

  /** «Hoy es Vendedor · 5 de 7 módulos · Plantilla de Goods». */
  protected readonly info = computed(() => {
    const el = this.elegido();
    if (!el) return '';
    const n = Object.values(el.niveles).filter(Boolean).length;
    const tipo = el.esDueno
      ? 'Dueño de la tienda'
      : el.propio
        ? 'Rol de tu tienda'
        : 'Plantilla de Goods';
    const antes = this.propuesto() && this.actual() ? `Hoy es ${this.actual()!.nombre} · ` : '';
    return `${antes}${n} de ${this.totalModulos()} módulos · ${tipo}`;
  });

  /** Anillo del ícono del rol: negro con el menú abierto, verde con un rol propuesto. */
  protected readonly anillo = computed(() => {
    if (this.menuAbierto() && !this.yo()) return '0 0 0 3px #fff,0 0 0 4.5px #303030';
    if (this.propuesto()) return '0 0 0 3px #fff,0 0 0 4.5px #5fc79a';
    return 'none';
  });
}
