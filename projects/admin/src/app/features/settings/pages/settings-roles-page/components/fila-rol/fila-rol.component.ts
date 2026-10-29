import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Rol } from '../../../../../../core/roles/models/rol.model';
import { Usuario } from '../../../../../../core/usuarios/models/usuario.model';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { cuentaPersonas, iconoRol } from '../../../../shared/permisos';
import { PilaAvataresComponent } from '../../../../shared/ui/pila-avatares/pila-avatares.component';
import { nombreDe } from '../../../../shared/usuarios';

/**
 * Contenido de la fila de un rol: ícono redondo (negro si está abierto, con
 * punto ámbar si tiene cambios sin guardar), nombre con candado si es
 * plantilla, descripción y quiénes lo tienen.
 */
@Component({
  selector: 'app-fila-rol',
  standalone: true,
  imports: [IcComponent, PilaAvataresComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @let r = rol();
    <span
      class="relative flex size-9 items-center justify-center rounded-full transition-colors duration-[260ms]"
      [style.background]="seleccionada() ? '#303030' : resaltada() ? '#f1f1f1' : '#e4e4e4'"
      [style.color]="seleccionada() ? '#fff' : '#4b5563'"
    >
      <app-ic [nombre]="icono()" [size]="16" />
      @if (conCambios()) {
        <span
          title="Cambios sin guardar"
          class="absolute -right-px -top-px size-2.5 rounded-full bg-[#e2a400] shadow-[0_0_0_2px_#fff]"
        ></span>
      }
    </span>
    <span class="flex min-w-0 flex-col gap-0.5">
      <span class="flex min-w-0 items-center gap-1.5">
        <span class="min-w-0 truncate text-[13px] font-semibold text-[#111827]">{{
          r.nombre
        }}</span>
        @if (r.empresaId === null) {
          <app-ic
            nombre="lock"
            [size]="12"
            class="shrink-0 text-[#9ca3af]"
            title="Plantilla de Goods · solo lectura"
          />
        }
      </span>
      <span class="truncate text-xs text-[#6b7280]">{{ r.descripcion }}</span>
    </span>
    <span class="flex flex-col items-end gap-1">
      @if (personas().length) {
        <app-pila-avatares [nombres]="nombres()" [borde]="resaltada() ? '#fff' : '#f1f1f1'" />
      }
      <span class="whitespace-nowrap text-[11px] tabular-nums text-[#9ca3af]">{{ cuenta() }}</span>
    </span>
  `,
})
export class FilaRolComponent {
  readonly rol = input.required<Rol>();
  readonly personas = input.required<Usuario[]>();
  readonly seleccionada = input(false);
  readonly resaltada = input(false);
  readonly conCambios = input(false);

  protected readonly icono = computed(() => iconoRol(this.rol()));
  protected readonly nombres = computed(() => this.personas().map(nombreDe));
  protected readonly cuenta = computed(() => cuentaPersonas(this.personas().length));
}
