import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { haceCuanto } from '../../../../../../shared/ui/persona';
import { Rol } from '../../../../../../core/roles/models/rol.model';
import { NIVELES, NIVEL_DESCRIPCION } from '../../../../shared/permisos';
import {
  DatoLateral,
  ListaDatosComponent,
} from '../../../../shared/ui/lista-datos/lista-datos.component';

/** Lateral de la ficha del rol: resumen, cambios sin guardar y cómo funcionan los niveles. */
@Component({
  selector: 'app-lateral-rol',
  standalone: true,
  imports: [ListaDatosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'sticky top-4 flex min-w-0 max-w-[300px] flex-[1_1_240px] flex-col gap-4 self-start',
  },
  template: `
    <app-lista-datos titulo="Resumen" [datos]="resumen()" [anchoEtiqueta]="104" />
    @if (cambios().total) {
      <app-lista-datos
        titulo="Cambios sin guardar"
        [anchoEtiqueta]="104"
        [datos]="[
          { t: 'Se suman', i: 'arrow-up-right', v: '' + cambios().gana },
          { t: 'Se quitan', i: 'arrow-down-right', v: '' + cambios().pierde },
        ]"
      />
    } @else if (edicion().length) {
      <app-lista-datos titulo="Última edición" [anchoEtiqueta]="104" [datos]="edicion()" />
    }
    <div class="flex flex-col gap-1.5 border-t border-[#f1f1f1] pt-3">
      <span class="pb-1 text-[10.5px] font-semibold uppercase tracking-[.06em] text-[#9ca3af]"
        >Cómo funcionan los niveles</span
      >
      @for (l of niveles; track l.t) {
        <div class="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-2">
          <span class="flex h-[18px] items-center gap-0.5">
            @for (c of l.puntos; track $index) {
              <span class="size-[5px] rounded-full" [style.background]="c"></span>
            }
          </span>
          <span class="text-xs leading-[17px] text-[#4b5563]"
            ><strong class="font-semibold text-[#111827]">{{ l.t }}.</strong> {{ l.d }}</span
          >
        </div>
      }
    </div>
  `,
})
export class LateralRolComponent {
  readonly rol = input.required<Rol>();
  readonly personas = input(0);
  /** «5/9» */
  readonly modulos = input('');
  /** Permisos que tendría con el borrador y el total que se pueden asignar. */
  readonly permisos = input(0);
  readonly totalPermisos = input(0);
  readonly cambios = input.required<{ gana: number; pierde: number; total: number }>();

  protected readonly niveles = [1, 2, 3].map((n) => ({
    t: NIVELES[n],
    d: NIVEL_DESCRIPCION[n - 1],
    puntos: [1, 2, 3].map((x) => (x <= n ? '#303030' : '#e0e0e0')),
  }));
  protected readonly resumen = computed<DatoLateral[]>(() => {
    const propio = this.rol().empresaId !== null;
    return [
      { t: 'Tipo', i: propio ? 'building-store' : 'lock', v: propio ? 'Propio' : 'Plantilla' },
      { t: 'Personas', i: 'users', v: String(this.personas()) },
      { t: 'Módulos', i: 'layout-grid', v: this.modulos().replace('/', ' de ') },
      { t: 'Permisos', i: 'key', v: `${this.permisos()} de ${this.totalPermisos()}` },
    ];
  });
  /** Las plantillas las mantiene Goods; un rol propio, quien lo creó (si el backend lo manda). */
  protected readonly edicion = computed<DatoLateral[]>(() => {
    const r = this.rol();
    if (r.empresaId === null) {
      return [
        { t: 'Fecha', i: 'clock', v: 'La mantiene Goods' },
        { t: 'Por', i: 'user', v: 'Equipo de Goods' },
      ];
    }
    if (!r.creadoEn) return [];
    // Los roles creados antes de guardar el autor llegan con `creadoPor: null`.
    return [
      { t: 'Fecha', i: 'clock', v: haceCuanto(r.creadoEn) },
      { t: 'Por', i: 'user', v: r.creadoPor?.nombre ?? 'Sin registro' },
    ];
  });
}
