import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  Area,
  MapaNiveles,
  Modulo,
  idsDeNiveles,
  nivelesDeRol,
} from '../../../../../../core/roles/niveles';
import { Rol } from '../../../../../../core/roles/models/rol.model';
import { normalizar } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import {
  ICONO_ROL_POR_DEFECTO,
  NIVELES,
  TONO_NIVEL,
  iconoRol,
  modulosCon,
} from '../../../../shared/permisos';
import {
  MarcoModalComponent,
  PieModalComponent,
} from '../../../../shared/ui/marco-modal/marco-modal.component';
import { ModalCabeceraComponent } from '../../../../shared/ui/modal-cabecera/modal-cabecera.component';
import { PuntoRadioComponent } from '../../../../shared/ui/punto-radio/punto-radio.component';
import { SelectorIconoComponent } from '../../../../shared/ui/selector-icono/selector-icono.component';

export interface NuevoRol {
  nombre: string;
  descripcion?: string;
  /** Permisos del rol base, o vacío si empieza en blanco. */
  permisoIds: number[];
  /** Ícono de Tabler sin `ti-`. */
  icono: string;
}

type Base = number | 'blanco';

/**
 * Modal «Nuevo rol»: nombre, descripción e ícono a la izquierda; a la
 * derecha, desde qué rol empezar y con qué niveles quedará por área. No llama
 * al backend: emite `crear` y la página guarda.
 */
@Component({
  selector: 'app-modal-nuevo-rol',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    IcComponent,
    MarcoModalComponent,
    PieModalComponent,
    ModalCabeceraComponent,
    PuntoRadioComponent,
    SelectorIconoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <app-marco-modal etiqueta="Nuevo rol" alto="min(600px,100%)" (cerrar)="cerrar.emit()">
      <app-modal-cabecera
        [icono]="icono()"
        [iconoBg]="nombre().trim() ? '#303030' : '#f1f1f1'"
        [iconoColor]="nombre().trim() ? '#fff' : '#4b5563'"
        titulo="Nuevo rol"
        [referencia]="slug()"
        [sub]="sub()"
        (cerrar)="cerrar.emit()"
      />
      <div
        class="grid min-h-0 flex-1 grid-cols-[minmax(0,1.2fr)_minmax(260px,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden"
      >
        <!-- Izquierda: datos e ícono -->
        <div
          class="box-border flex h-full min-h-0 min-w-0 flex-col gap-[22px] overflow-hidden px-[18px] pt-[18px]"
        >
          <div class="flex shrink-0 flex-col gap-2">
            <span class="text-[12.5px] font-semibold text-[#111827]">Tu rol</span>
            <span class="-mt-1.5 text-xs leading-[17px] text-[#6b7280]"
              >El nombre aparece en Usuarios y en la invitación que recibe cada persona.</span
            >
            <div
              class="flex flex-col rounded-[14px] bg-white shadow-[0_0_0_1px_#e5e5e5] transition-shadow duration-200 focus-within:shadow-[0_0_0_1px_#303030,0_0_0_4px_rgba(48,48,48,.07)]"
            >
              <input
                #campoNombre
                [value]="nombre()"
                (input)="nombre.set($any($event.target).value)"
                (keydown.enter)="enviar()"
                maxlength="40"
                placeholder="Ej. Atención al cliente"
                class="h-[46px] border-0 bg-transparent px-3.5 font-display text-[15.5px] font-semibold text-[#111827] outline-none"
              />
              <div class="mx-3.5 h-px bg-[#f1f1f1]"></div>
              <textarea
                [value]="descripcion()"
                (input)="descripcion.set($any($event.target).value)"
                rows="2"
                maxlength="80"
                placeholder="¿Qué hace esta persona en tu tienda?"
                class="min-h-[60px] resize-none border-0 bg-transparent px-3.5 py-2.5 text-[13px] leading-5 text-[#111827] outline-none [field-sizing:content]"
              ></textarea>
            </div>
          </div>
          <div class="flex min-h-0 flex-1 flex-col gap-2">
            <span class="text-[12.5px] font-semibold text-[#111827]">Ícono</span>
            <span class="-mt-1.5 text-xs leading-[17px] text-[#6b7280]"
              >Lo verás junto al nombre en la lista de roles y en cada ficha.</span
            >
            <app-selector-icono [(valor)]="icono" />
          </div>
        </div>

        <!-- Derecha: desde dónde empezar y con qué quedará -->
        <div
          class="box-border flex h-full min-h-0 min-w-0 flex-col gap-3.5 overflow-y-auto border-l border-[#f1f1f1] bg-[#fcfcfc] p-[18px] [scrollbar-width:thin]"
        >
          <div class="flex flex-col gap-2">
            <span class="text-[12.5px] font-semibold text-[#111827]">Empezar desde</span>
            <span class="-mt-1.5 text-xs leading-[17px] text-[#6b7280]"
              >Copia los permisos de un rol que ya existe o arma uno en blanco.</span
            >
            <div role="radiogroup" class="flex flex-col gap-0.5">
              <ng-template #opcion let-k="k" let-t="t" let-i="i" let-n="n" let-sangria="sangria">
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="base() === k"
                  (click)="base.set(k)"
                  class="group flex min-h-[34px] animate-[st-fade-in_.2s_both] items-center py-0.5 pr-1.5 text-left"
                  [style.padding-left]="sangria"
                >
                  <app-punto-radio variante="aparece" [on]="base() === k" />
                  <span
                    class="mr-[9px] flex size-6 shrink-0 items-center justify-center rounded-[7px] text-[#6b7280]"
                    ><app-ic [nombre]="i" [size]="13"
                  /></span>
                  <span
                    class="min-w-0 flex-1 truncate text-[12.5px] text-[#111827]"
                    [class.font-semibold]="base() === k"
                    [class.font-medium]="base() !== k"
                    >{{ t }}</span
                  >
                  <span class="ml-2 text-[11px] tabular-nums text-[#9ca3af]">{{ n }}</span>
                </button>
              </ng-template>
              <ng-container
                *ngTemplateOutlet="
                  opcion;
                  context: {
                    k: 'blanco',
                    t: 'En blanco',
                    i: 'square-dashed',
                    n: '0/' + modulos().length,
                    sangria: '2px',
                  }
                "
              />
              @for (g of grupos(); track g.t) {
                <div class="mt-1.5 flex h-8 items-center gap-[9px] pl-0.5 pr-1.5">
                  <span
                    class="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-[#efefef] text-[#6b7280]"
                    ><app-ic [nombre]="g.i" [size]="13"
                  /></span>
                  <span class="min-w-0 flex-1 text-[12.5px] font-medium text-[#111827]">{{
                    g.t
                  }}</span>
                  <span class="text-[11px] text-[#9ca3af]">{{ g.items.length }}</span>
                </div>
                @for (x of g.items; track x.id) {
                  <ng-container
                    *ngTemplateOutlet="
                      opcion;
                      context: {
                        k: x.id,
                        t: x.nombre,
                        i: iconoDe(x),
                        n: conAcceso(x),
                        sangria: '30px',
                      }
                    "
                  />
                }
              }
            </div>
          </div>
          <div class="flex flex-col gap-1 border-t border-[#f1f1f1] pt-3">
            <span class="flex items-baseline justify-between gap-2">
              <span
                class="pb-1 text-[10.5px] font-semibold uppercase tracking-[.06em] text-[#9ca3af]"
                >Quedará con</span
              >
              <span class="text-[11px] text-[#9ca3af]">{{ resumen() }}</span>
            </span>
            @for (a of resumenAreas(); track a.t) {
              <div
                class="grid min-h-[30px] grid-cols-[minmax(0,1fr)_minmax(64px,96px)_34px] items-center gap-2.5"
              >
                <span
                  class="min-w-0 truncate text-xs"
                  [style.color]="a.con ? '#111827' : '#9ca3af'"
                  >{{ a.t }}</span
                >
                <span [title]="a.detalle" class="flex h-2 gap-0.5">
                  @for (c of a.ticks; track $index) {
                    <span
                      class="min-w-0 flex-1 rounded-sm transition-colors duration-300"
                      [style.background]="c"
                    ></span>
                  }
                </span>
                <span class="text-right text-[11.5px] tabular-nums text-[#6b7280]">{{ a.n }}</span>
              </div>
            }
            <span class="flex flex-wrap gap-x-3 gap-y-1 pt-1.5 text-[11px] text-[#9ca3af]">
              @for (l of leyenda; track l.t) {
                <span class="flex items-center gap-[5px]"
                  ><span class="size-2 rounded-sm" [style.background]="l.bg"></span>{{ l.t }}</span
                >
              }
            </span>
          </div>
        </div>
      </div>
      <app-pie-modal
        [texto]="pie()"
        [accion]="creando() ? 'Creando…' : 'Crear rol'"
        [deshabilitado]="!nombre().trim() || !!repetido() || creando()"
        (cancelar)="cerrar.emit()"
        (aceptar)="enviar()"
      />
    </app-marco-modal>
  `,
})
export class ModalNuevoRolComponent {
  readonly roles = input.required<Rol[]>();
  readonly modulos = input.required<Modulo[]>();
  readonly areas = input.required<Area[]>();
  readonly creando = input(false);
  readonly crear = output<NuevoRol>();
  readonly cerrar = output<void>();

  protected readonly nombre = signal('');
  protected readonly descripcion = signal('');
  protected readonly icono = signal(ICONO_ROL_POR_DEFECTO);
  protected readonly base = signal<Base>('blanco');
  private readonly campoNombre = viewChild<ElementRef<HTMLInputElement>>('campoNombre');

  protected readonly leyenda = [1, 2, 3].map((n) => ({ t: NIVELES[n], bg: TONO_NIVEL[n] }));
  protected readonly iconoDe = iconoRol;

  protected readonly grupos = computed(() =>
    [
      {
        t: 'Plantillas de Goods',
        i: 'lock',
        items: this.roles().filter((x) => x.empresaId === null),
      },
      {
        t: 'Roles de tu tienda',
        i: 'building-store',
        items: this.roles().filter((x) => x.empresaId !== null),
      },
    ].filter((g) => g.items.length),
  );
  protected readonly rolBase = computed(() => {
    const b = this.base();
    return b === 'blanco' ? null : (this.roles().find((r) => r.id === b) ?? null);
  });
  private readonly niveles = computed<MapaNiveles>(() => {
    const b = this.rolBase();
    return b ? nivelesDeRol(b, this.modulos()) : {};
  });
  protected readonly slug = computed(
    () =>
      'rol/' +
      (normalizar(this.nombre().trim())
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'sin-nombre'),
  );
  protected readonly sub = computed(() => {
    const n = this.nombre().trim();
    const b = this.rolBase();
    if (!n) return 'Ponle un nombre que tu equipo reconozca y elige desde dónde empezar.';
    return `«${n}» ${b ? 'empezará con los permisos de ' + b.nombre + '.' : 'empezará sin permisos.'} Podrás ajustarlos después.`;
  });
  /** El backend no deja repetir el nombre de un rol de la tienda (sin distinguir mayúsculas). */
  protected readonly repetido = computed(() => {
    const n = this.nombre().trim().toLowerCase();
    return n
      ? (this.roles().find((r) => r.empresaId !== null && r.nombre.toLowerCase() === n) ?? null)
      : null;
  });
  protected readonly pie = computed(() => {
    if (!this.nombre().trim()) return 'Ponle un nombre para crearlo';
    const r = this.repetido();
    if (r) return `Ya tienes un rol llamado «${r.nombre}». Elige otro nombre.`;
    const b = this.rolBase();
    return b
      ? `Copia los permisos de ${b.nombre}. Podrás ajustarlos después.`
      : 'Empieza sin permisos; los eliges en la ficha.';
  });
  /** «Ve 3 · edita 1 · todo 0» del rol de base. */
  protected readonly resumen = computed(() => {
    const n = this.niveles();
    const c = (lv: number) => this.modulos().filter((m) => (n[m.codigo] ?? 0) >= lv).length;
    return `Ve ${c(1)} · edita ${c(2)} · todo ${c(3)}`;
  });
  /** Ticks por área, de mayor a menor nivel, con el detalle por módulo en el `title`. */
  protected readonly resumenAreas = computed(() =>
    this.areas().map((a) => {
      const lv = a.modulos.map((m) => this.niveles()[m.codigo] ?? 0);
      const con = lv.filter(Boolean).length;
      return {
        t: a.nombre,
        n: `${con}/${lv.length}`,
        con,
        ticks: [...lv].sort((x, y) => y - x).map((v) => TONO_NIVEL[v]),
        detalle: a.modulos.map((m, i) => `${m.nombre}: ${NIVELES[lv[i]]}`).join(' · '),
      };
    }),
  );

  constructor() {
    afterNextRender(() => this.campoNombre()?.nativeElement.focus());
  }

  protected conAcceso(r: Rol): string {
    return modulosCon(r, this.modulos());
  }

  protected enviar(): void {
    const nombre = this.nombre().trim();
    if (!nombre || this.repetido() || this.creando()) return;
    this.crear.emit({
      nombre,
      descripcion: this.descripcion().trim() || undefined,
      permisoIds: idsDeNiveles(this.niveles(), this.modulos()),
      icono: this.icono(),
    });
  }
}
