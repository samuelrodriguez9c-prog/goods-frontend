import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Usuario } from '../../../../../../core/usuarios/models/usuario.model';
import { haceCuanto, iniciales, tonoPersona } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { ESTADO_USUARIO, estadoDe, nombreDe } from '../../../../shared/usuarios';

/**
 * Contenido de la fila de una persona (va en `app-fila-lista`, columnas
 * `38px minmax(0,1fr) auto`, arriba):
 * - Avatar redondo de 38 px con su tono; punto verde de 12 px si está en
 *   línea; si no tiene acceso normal, insignia de 18 px (pendiente, vencida o
 *   sin acceso).
 * - Nombre (600 si está abierta) con la marca «Tú»; debajo el correo con su
 *   ícono y, solo si no tiene acceso normal, la etiqueta de su estado.
 * - Derecha: «hace 2 h» + «último acceso»; sin aceptar, «Sin entrar» +
 *   «invitación enviada / vencida».
 */
@Component({
  selector: 'app-fila-usuario',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @let e = estado();
    <span
      class="relative flex size-[38px] items-center justify-center rounded-full text-[12.5px] font-semibold"
      [style.background]="tono()[0]"
      [style.color]="tono()[1]"
    >
      <span [style.opacity]="e === 'inactivo' ? 0.55 : 1">{{ ini() }}</span>
      @if (enLinea() && e === 'activo') {
        <span
          title="En línea"
          class="absolute -right-px -bottom-px size-3 rounded-full bg-[#29845a] transition-shadow duration-[260ms]"
          [style.box-shadow]="'0 0 0 2px ' + anillo()"
        ></span>
      }
      @if (e !== 'activo') {
        <span
          [title]="ui().t"
          class="absolute -right-[3px] -bottom-[3px] flex size-[18px] items-center justify-center rounded-full transition-shadow duration-[260ms]"
          [style.background]="ui().bg"
          [style.color]="ui().fg"
          [style.box-shadow]="'0 0 0 2px ' + anillo()"
          ><app-ic [nombre]="ui().icono" [size]="10"
        /></span>
      }
    </span>
    <span class="flex min-w-0 flex-col gap-[5px]">
      <span class="flex min-w-0 items-center gap-1.5">
        <span
          class="min-w-0 truncate text-[13px] leading-[18px]"
          [style.font-weight]="abierta() ? 600 : 500"
          [style.color]="e === 'inactivo' ? '#6b7280' : '#111827'"
          >{{ nombre() }}</span
        >
        @if (yo()) {
          <span
            class="shrink-0 rounded-[5px] px-[5px] text-[10.5px] leading-[17px] font-semibold text-[#4b5563] transition-colors duration-[260ms]"
            [style.background]="resaltada() ? '#f4f4f4' : '#e6e6e6'"
            >Tú</span
          >
        }
      </span>
      <span
        class="-mt-[3px] flex min-w-0 items-center gap-1 overflow-hidden text-xs leading-4 text-[#6b7280]"
        ><app-ic nombre="mail" [size]="12" class="shrink-0 text-[#9ca3af]" /><span
          class="min-w-0 truncate"
          >{{ usuario().correo }}</span
        ></span
      >
      @if (e !== 'activo') {
        <span class="flex min-w-0 flex-wrap items-center gap-1">
          <span
            class="inline-flex h-5 shrink-0 items-center gap-[5px] whitespace-nowrap rounded-md px-[7px] text-[11px] font-medium"
            [style.background]="ui().bg"
            [style.color]="ui().fg"
            ><app-ic [nombre]="ui().icono" [size]="11" />{{ ui().t }}</span
          >
        </span>
      }
    </span>
    <span class="flex flex-col items-end gap-1.5 pt-px">
      <span
        class="whitespace-nowrap text-[13px] font-semibold tabular-nums"
        [style.color]="e === 'activo' ? '#303030' : '#9ca3af'"
        >{{ acceso().v }}</span
      >
      <span class="whitespace-nowrap text-[11.5px] font-medium text-[#9ca3af]">{{
        acceso().l
      }}</span>
    </span>
  `,
})
export class FilaUsuarioComponent {
  readonly usuario = input.required<Usuario>();
  readonly yo = input(false);
  readonly enLinea = input(false);
  readonly resaltada = input(false);
  /** Es la abierta en la ficha (nombre en 600). */
  readonly abierta = input(false);

  protected readonly nombre = computed(() => nombreDe(this.usuario()));
  protected readonly ini = computed(() => iniciales(this.nombre()));
  protected readonly tono = computed(() => tonoPersona(this.nombre()));
  protected readonly estado = computed(() => estadoDe(this.usuario()));
  protected readonly ui = computed(() => {
    const e = this.estado();
    return { ...ESTADO_USUARIO[e], icono: e === 'activo' ? 'check' : ESTADO_USUARIO[e].icono };
  });
  protected readonly anillo = computed(() => (this.resaltada() ? '#fff' : '#f1f1f1'));
  protected readonly acceso = computed(() => {
    const u = this.usuario();
    const e = this.estado();
    if (e === 'pendiente' || e === 'vencida')
      return {
        v: 'Sin entrar',
        l: e === 'pendiente' ? 'invitación enviada' : 'invitación vencida',
      };
    if (this.enLinea() && e === 'activo') return { v: 'Ahora', l: 'último acceso' };
    return { v: u.ultimoAcceso ? haceCuanto(u.ultimoAcceso) : '—', l: 'último acceso' };
  });
}
