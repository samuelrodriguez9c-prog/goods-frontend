import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MapaNiveles, Modulo } from '../../../../../../core/roles/niveles';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { NIVELES, vistaModulo } from '../../../../shared/permisos';
import { RolUsuario } from '../../usuarios.util';
import { NivelesNodosComponent } from '../niveles-nodos/niveles-nodos.component';

/**
 * «Permisos por módulo» de una persona: los de su rol, de solo lectura. Con un
 * rol propuesto muestra qué gana o pierde cada módulo y la barra para
 * aplicarlo; los módulos que no cambian se apagan.
 */
@Component({
  selector: 'app-permisos-usuario',
  standalone: true,
  imports: [IcComponent, NivelesNodosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  template: `
    <span class="flex flex-col gap-0.5">
      <span class="font-display text-[15px] font-semibold text-[#111827]">Permisos por módulo</span>
      <span class="text-pretty text-xs leading-[17px] text-[#6b7280]">{{ ayuda() }}</span>
    </span>
    @if (propuesto(); as rp) {
      <div
        class="flex animate-[st-fade-in-up_.25s_both] flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-xl bg-[#f7f7f7] py-2.5 pr-2.5 pl-3.5"
      >
        <span class="flex min-w-[200px] flex-1 flex-col gap-0.5">
          <span class="text-[13px] text-[#111827]"
            >Pasar de <strong class="font-semibold">{{ actual()?.nombre }}</strong> a
            <strong class="font-semibold">{{ rp.nombre }}</strong></span
          >
          <span class="text-xs text-[#6b7280]">{{ comparacion() }}</span>
        </span>
        <button
          type="button"
          (click)="cancelar.emit()"
          class="rounded-lg px-2.5 py-[7px] text-[12.5px] font-medium text-[#4b5563] hover:bg-[#ececec] hover:text-[#111827]"
        >
          Cancelar
        </button>
        <button
          type="button"
          (click)="aplicar.emit()"
          class="rounded-lg bg-[#303030] px-3 py-[7px] text-[12.5px] font-medium text-white shadow-[inset_0_-1px_0_#000] hover:opacity-90"
        >
          Cambiar rol
        </button>
      </div>
    }
    <div class="flex flex-col gap-0.5">
      <div
        class="grid grid-cols-[minmax(96px,1fr)_minmax(96px,150px)_16px] items-end gap-2 px-2 pb-1"
      >
        <span class="min-w-0 truncate text-[11.5px] text-[#6b7280]">{{ resumen() }}</span>
        <span
          class="grid grid-cols-3 text-center text-[10.5px] font-semibold tracking-[.05em] text-[#9ca3af] uppercase"
          ><span>Ver</span><span>Editar</span><span>Todo</span></span
        >
        <span></span>
      </div>
      <!-- Se ven 6 módulos y medio (filas de 46 + 2); la cabecera queda fuera del scroll. -->
      <div
        class="flex max-h-[311px] flex-col gap-0.5 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
      >
        @for (f of filas(); track f.m.codigo) {
          <div
            class="rounded-xl transition-[background-color,opacity] duration-[250ms]"
            [style.opacity]="f.op"
          >
            <button
              type="button"
              (click)="alternar(f.m.codigo)"
              [attr.aria-expanded]="f.abierto"
              class="grid min-h-[46px] w-full grid-cols-[minmax(96px,1fr)_minmax(96px,150px)_16px] items-center gap-2 rounded-xl px-2 text-left transition-colors duration-200 hover:bg-[#f7f7f7]"
            >
              <span class="flex min-w-0 items-center gap-[9px]">
                <span
                  class="flex size-[26px] shrink-0 items-center justify-center rounded-lg transition-colors duration-[250ms]"
                  [style.background]="f.v.iBg"
                  [style.color]="f.v.iColor"
                  ><app-ic [nombre]="f.m.icono" [size]="13"
                /></span>
                <span class="flex min-w-0 flex-col gap-px">
                  <span class="truncate text-[13px] font-medium" [style.color]="f.v.tColor">{{
                    f.m.nombre
                  }}</span>
                  <span
                    class="flex items-center gap-[3px] whitespace-nowrap text-[11.5px] transition-colors duration-[250ms]"
                    [style.color]="f.v.color"
                  >
                    @if (f.v.cambia) {
                      <app-ic
                        [nombre]="f.v.sube ? 'arrow-up-right' : 'arrow-down-right'"
                        [size]="12"
                      />
                    }
                    {{ f.nivel }}
                  </span>
                </span>
              </span>
              <app-niveles-nodos [antes]="f.v.a" [despues]="f.v.b" />
              <app-ic
                nombre="chevron-down"
                [size]="14"
                class="justify-self-end text-[#9ca3af] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
                [style.transform]="f.abierto ? 'rotate(180deg)' : 'none'"
              />
            </button>
            <div
              class="grid transition-[grid-template-rows] duration-[320ms] ease-[cubic-bezier(.2,.8,.2,1)]"
              [style.grid-template-rows]="f.abierto ? '1fr' : '0fr'"
            >
              <div class="min-h-0 overflow-hidden">
                <div class="flex flex-col gap-0.5 pr-3 pb-2.5 pl-[43px]">
                  @for (x of f.v.acciones; track x.codigo) {
                    <div
                      class="flex min-h-[26px] items-center gap-2 text-[12.5px] transition-colors duration-[250ms]"
                      [style.color]="x.color"
                    >
                      <span
                        class="flex size-4 shrink-0 items-center justify-center rounded-full transition-colors duration-[250ms]"
                        [style.background]="x.icBg"
                        [style.color]="x.icColor"
                        ><app-ic [nombre]="x.icono" [size]="10"
                      /></span>
                      <span class="min-w-0 flex-1">{{ x.t }}</span>
                      <span class="shrink-0 text-[10.5px] text-[#b5b5b5]">{{ x.nivel }}</span>
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
          </div>
        }
      </div>
    </div>
  `,
})
export class PermisosUsuarioComponent {
  readonly modulos = input.required<Modulo[]>();
  readonly actual = input<RolUsuario | null>(null);
  readonly propuesto = input<RolUsuario | null>(null);
  /** Es tu propia ficha y eres el dueño. */
  readonly duenoYo = input(false);
  readonly cancelar = output<void>();
  readonly aplicar = output<void>();

  private readonly abierto = signal<string | null>(null);

  private readonly antes = computed<MapaNiveles>(() => this.actual()?.niveles ?? {});
  private readonly despues = computed<MapaNiveles>(() => this.propuesto()?.niveles ?? this.antes());

  protected readonly filas = computed(() =>
    this.modulos().map((m) => {
      const v = vistaModulo(m, this.antes()[m.codigo] ?? 0, this.despues()[m.codigo] ?? 0, {
        gana: 'Gana',
        pierde: 'Pierde',
      });
      return {
        m,
        v,
        nivel: v.cambia ? `${NIVELES[v.a]} → ${NIVELES[v.b]}` : NIVELES[v.a],
        op: this.propuesto() && !v.cambia ? 0.5 : 1,
        abierto: this.abierto() === m.codigo,
      };
    }),
  );

  protected readonly ayuda = computed(() => {
    const rp = this.propuesto();
    if (this.duenoYo())
      return 'Eres el dueño de la tienda: tienes todos los permisos y tu rol no se puede cambiar.';
    if (rp) return `Vista previa como ${rp.nombre}: en verde lo que gana y en rojo lo que pierde.`;
    return `Lo que puede ver y editar como ${this.actual()?.nombre ?? 'su rol'}. Cambia el rol arriba para comparar.`;
  });

  /** «Ve 5 módulos · edita 3 · todo en 1», con el rol propuesto si hay. */
  protected readonly resumen = computed(() => {
    const n = this.despues();
    const c = (lv: number) => this.modulos().filter((m) => (n[m.codigo] ?? 0) >= lv).length;
    return `Ve ${c(1)} módulos · edita ${c(2)} · todo en ${c(3)}`;
  });

  /** «Gana 2 permisos y pierde 1.» o «Tiene los mismos permisos.» */
  protected readonly comparacion = computed(() => {
    const filas = this.filas();
    const gana = filas.filter((f) => f.v.b > f.v.a).length;
    const pierde = filas.filter((f) => f.v.b < f.v.a).length;
    const partes = [
      gana && `gana ${gana} ${gana === 1 ? 'permiso' : 'permisos'}`,
      pierde && `pierde ${pierde}`,
    ]
      .filter(Boolean)
      .join(' y ');
    return partes
      ? partes.charAt(0).toUpperCase() + partes.slice(1) + '.'
      : 'Tiene los mismos permisos.';
  });

  protected alternar(k: string): void {
    this.abierto.update((a) => (a === k ? null : k));
  }
}
