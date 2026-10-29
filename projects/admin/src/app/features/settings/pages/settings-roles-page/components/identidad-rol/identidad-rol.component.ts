import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Rol } from '../../../../../../core/roles/models/rol.model';
import { Usuario } from '../../../../../../core/usuarios/models/usuario.model';
import { haceCuanto } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { cuentaPersonas, iconoRol } from '../../../../shared/permisos';
import { PilaAvataresComponent } from '../../../../shared/ui/pila-avatares/pila-avatares.component';
import { nombreDe } from '../../../../shared/usuarios';

/**
 * Cabecera de la ficha del rol: ícono, nombre y descripción (editables en el
 * lugar si es propio; guardan al salir del campo), de dónde viene y quiénes
 * lo tienen. Las plantillas muestran además el aviso con «Duplicar».
 */
@Component({
  selector: 'app-identidad-rol',
  standalone: true,
  imports: [IcComponent, PilaAvataresComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[26px]' },
  template: `
    @let r = rol();
    <div class="flex flex-wrap items-center gap-3.5">
      <span
        class="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#303030] text-white"
        ><app-ic [nombre]="icono()" [size]="24"
      /></span>
      <div class="flex min-w-[180px] flex-[1_1_200px] flex-col gap-1">
        @if (propio()) {
          <input
            [value]="r.nombre"
            (change)="renombrar.emit({ campo: 'nombre', valor: $any($event.target).value })"
            maxlength="40"
            aria-label="Nombre del rol"
            class="-mx-1.5 min-w-0 rounded-lg border-0 bg-transparent px-1.5 font-display text-[22px] font-semibold leading-[30px] tracking-[-0.01em] text-[#111827] outline-none transition-[background-color,box-shadow] duration-200 hover:bg-[#f7f7f7] focus:bg-white focus:shadow-[0_0_0_1px_#303030]"
          />
          <input
            [value]="r.descripcion ?? ''"
            (change)="renombrar.emit({ campo: 'descripcion', valor: $any($event.target).value })"
            maxlength="80"
            placeholder="Agrega una descripción corta"
            aria-label="Descripción del rol"
            class="-mx-1.5 min-w-0 rounded-[7px] border-0 bg-transparent px-1.5 py-0.5 text-[13px] text-[#6b7280] outline-none transition-[background-color,box-shadow] duration-200 hover:bg-[#f7f7f7] focus:bg-white focus:shadow-[0_0_0_1px_#303030]"
          />
        } @else {
          <span
            class="font-display text-[22px] font-semibold leading-[30px] tracking-[-0.01em] text-[#111827]"
            >{{ r.nombre }}</span
          >
          <span class="text-[13px] text-[#6b7280]">{{ r.descripcion }}</span>
        }
        <span class="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span
            class="inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-md px-2 text-[11.5px] font-medium"
            [style.background]="propio() ? '#e0f7f5' : '#f1f1f1'"
            [style.color]="propio() ? '#00605b' : '#4b5563'"
          >
            <app-ic [nombre]="propio() ? 'building-store' : 'lock'" [size]="12" />{{
              propio() ? 'Rol de tu tienda' : 'Plantilla de Goods'
            }}
          </span>
          <span class="whitespace-nowrap text-xs text-[#9ca3af]">{{ origen() }}</span>
        </span>
      </div>
      <div class="ml-auto flex shrink-0 items-center gap-3 self-start">
        <span class="flex flex-col items-end gap-0.5 text-right">
          <span class="text-[10.5px] font-semibold uppercase tracking-[.06em] text-[#9ca3af]"
            >Personas</span
          >
          <span class="whitespace-nowrap text-sm font-semibold text-[#111827]">{{
            gente().length ? cuenta() : 'Nadie aún'
          }}</span>
          <span class="whitespace-nowrap text-[11.5px] text-[#6b7280]">{{
            gente().length ? subPersonas() : 'Asígnalo en Usuarios'
          }}</span>
        </span>
        @if (gente().length) {
          <app-pila-avatares [nombres]="nombres()" [tamano]="34" />
        } @else {
          <span
            class="flex size-[34px] items-center justify-center rounded-full text-[#b5b5b5] shadow-[inset_0_0_0_1.5px_#e5e5e5]"
            ><app-ic nombre="user-off" [size]="15"
          /></span>
        }
      </div>
    </div>

    @if (!propio()) {
      <div
        class="flex animate-[st-fade-in-up_.25s_both] flex-wrap items-center gap-x-4 gap-y-3 rounded-[14px] bg-[#f6f6f6] py-3 pl-3.5 pr-3"
      >
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#4b5563]"
          ><app-ic nombre="lock" [size]="16"
        /></span>
        <span class="flex min-w-[200px] flex-1 flex-col gap-0.5">
          <span class="text-[13px] font-semibold text-[#111827]">Plantilla de Goods</span>
          <span class="text-pretty text-xs leading-[17px] text-[#4b5563]"
            >La mantiene el equipo de Goods y se actualiza sola. Para cambiar sus permisos,
            duplícala como rol propio.</span
          >
        </span>
        <button
          type="button"
          (click)="duplicar.emit()"
          class="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#303030] px-3 py-[7px] text-[12.5px] font-medium text-white shadow-[inset_0_-1px_0_#000] hover:opacity-90"
        >
          <app-ic nombre="copy" [size]="14" />Duplicar
        </button>
      </div>
    }
  `,
})
export class IdentidadRolComponent {
  readonly rol = input.required<Rol>();
  readonly gente = input.required<Usuario[]>();
  readonly renombrar = output<{ campo: 'nombre' | 'descripcion'; valor: string }>();
  readonly duplicar = output<void>();

  protected readonly propio = computed(() => this.rol().empresaId !== null);
  protected readonly icono = computed(() => iconoRol(this.rol()));
  protected readonly nombres = computed(() => this.gente().map(nombreDe));
  protected readonly cuenta = computed(() => cuentaPersonas(this.gente().length));
  /** «3 con acceso · 1 más» (los demás tienen la invitación pendiente o están sin acceso). */
  protected readonly subPersonas = computed(() => {
    const con = this.gente().filter((u) => u.activo && !u.invitacion).length;
    const resto = this.gente().length - con;
    return `${con} con acceso${resto ? ' · ' + resto + ' más' : ''}`;
  });
  protected readonly origen = computed(() => {
    const r = this.rol();
    if (!this.propio()) return 'Se actualiza con Goods';
    const cuando = r.creadoEn ? haceCuanto(r.creadoEn).toLowerCase() : '';
    if (!r.creadoPor) return cuando ? `Rol de tu tienda · creado ${cuando}` : 'Rol de tu tienda';
    return `Creado por ${r.creadoPor.nombre}${cuando ? ' · ' + cuando : ''}`;
  });
}
