import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono } from '../../../shared/ui/iconos';
import { GrupoProveedores } from '../proveedores.modelo';

/**
 * Grupo plegable de la lista: cabecera pegajosa con ícono, título, cuenta y
 * chevron; las filas (o tarjetas) van como contenido y se pliegan con una transición de alto.
 */
@Component({
  selector: 'app-grupo-proveedores',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let g = grupo();
    <button type="button" (click)="alternar.emit()"
      class="sticky top-0 z-[3] flex w-[calc(100%_-_28px)] cursor-pointer items-center gap-2.5 bg-[#f1f1f1] pt-3.5 pr-2 pb-2 pl-1 text-left">
      <span class="flex size-5.5 shrink-0 items-center justify-center rounded-full" [style.background]="g.fondo" [style.color]="g.tinta">
        <tabler-icon [icon]="icono(g.icono)" [size]="13" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-[1px]">
        <span class="flex items-center gap-[7px]">
          <span class="text-[13px] font-semibold text-[#111827]">{{ g.titulo }}</span>
          <span class="rounded-full bg-[#e3e3e3] px-[7px] text-[11px] leading-[17px] font-semibold text-[#4b5563] tabular-nums">{{ g.filas.length }}</span>
        </span>
        <span class="truncate text-[11.5px] text-[#8a8a8a]">{{ g.detalle }}</span>
      </span>
      <span class="flex size-6 shrink-0 items-center justify-center rounded-full text-[#8a8a8a]">
        <tabler-icon [icon]="icono('chevron-down')" [size]="14"
          class="transition-[rotate] duration-240 ease-[cubic-bezier(.2,.8,.2,1)]" [class.-rotate-90]="!g.abierto" />
      </span>
    </button>
    <div class="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
      [class]="g.abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
      <div class="min-h-0 overflow-visible transition-[clip-path] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        [class]="g.abierto ? '[clip-path:inset(-14px_-2px_-14px_-2px)]' : '[clip-path:inset(0)]'">
        <ng-content />
      </div>
    </div>
  `,
})
export class GrupoProveedoresComponent {
  readonly grupo = input.required<GrupoProveedores>();
  readonly alternar = output<void>();
  protected readonly icono = icono;
}
