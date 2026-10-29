import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Usuario } from '../../../../../../core/usuarios/models/usuario.model';
import { haceCuanto, iniciales, tonoPersona } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { ESTADO_USUARIO, estadoDe, nombreDe } from '../../../../shared/usuarios';

/** «Personas con este rol»: quiénes lo tienen y su estado si no es «con acceso». */
@Component({
  selector: 'app-personas-rol',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2.5' },
  template: `
    <span class="flex flex-col gap-0.5">
      <span class="font-display text-[15px] font-semibold text-[#111827]"
        >Personas con este rol</span
      >
      <span class="text-xs text-[#6b7280]">{{
        gente().length
          ? (gente().length === 1 ? '1 persona tiene' : gente().length + ' personas tienen') +
            ' este rol'
          : 'Aún sin personas'
      }}</span>
    </span>
    <div class="flex flex-col">
      @for (u of filas(); track u.id) {
        <div
          class="grid min-h-12 animate-[st-fade-in-up_.28s_both] grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[10px] pr-2 transition-colors duration-200 hover:bg-[#f8f8f8]"
        >
          <span
            class="flex size-8 items-center justify-center rounded-full text-[11.5px] font-semibold"
            [style.background]="u.tono[0]"
            [style.color]="u.tono[1]"
            >{{ u.ini }}</span
          >
          <span class="flex min-w-0 flex-col gap-px"
            ><span class="truncate text-[13px] font-medium text-[#111827]">{{ u.nombre }}</span
            ><span class="text-[11.5px] text-[#9ca3af]">{{ u.sub }}</span></span
          >
          @if (u.estado; as e) {
            <span
              class="inline-flex h-5 items-center gap-[5px] whitespace-nowrap rounded-md px-[7px] text-[11px] font-medium"
              [style.background]="e.bg"
              [style.color]="e.fg"
              ><span class="size-1.5 rounded-full" [style.background]="e.punto"></span
              >{{ e.t }}</span
            >
          }
        </div>
      } @empty {
        <div class="flex items-center gap-2.5 py-2.5">
          <span
            class="flex size-8 items-center justify-center rounded-full bg-[#f4f4f4] text-[#9ca3af]"
            ><app-ic nombre="user-off" [size]="14"
          /></span>
          <span class="text-[12.5px] text-[#6b7280]"
            >Nadie tiene este rol todavía. Asígnalo desde Usuarios.</span
          >
        </div>
      }
    </div>
    <button
      type="button"
      (click)="verUsuarios.emit()"
      class="ml-[42px] self-start text-xs font-medium text-[#4b5563] underline decoration-[#c9c9c9] underline-offset-2 hover:text-[#111827] hover:decoration-[#111827]"
    >
      Asignar o cambiar roles en Usuarios
    </button>
  `,
})
export class PersonasRolComponent {
  readonly gente = input.required<Usuario[]>();
  readonly verUsuarios = output<void>();

  protected filas() {
    return this.gente().map((u) => {
      const nombre = nombreDe(u);
      const e = estadoDe(u);
      // «Entró hace 3 h», «Último acceso hace 2 meses» (sin acceso) o «Aún no ha entrado».
      const visto = u.ultimoAcceso ? haceCuanto(u.ultimoAcceso).toLowerCase() : '';
      const sub =
        !visto || u.invitacion
          ? 'Aún no ha entrado'
          : e === 'inactivo'
            ? `Último acceso ${visto}`
            : `Entró ${visto}`;
      return {
        id: u.id,
        nombre,
        sub,
        ini: iniciales(nombre),
        tono: tonoPersona(nombre),
        estado: e === 'activo' ? null : ESTADO_USUARIO[e],
      };
    });
  }
}
