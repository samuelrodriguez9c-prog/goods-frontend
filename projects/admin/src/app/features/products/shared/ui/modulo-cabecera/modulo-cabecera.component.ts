import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TablerIconComponent, type TablerIcon } from '@tabler/icons-angular';

/**
 * Cabecera de los módulos lista + hoja (Categorías, Inventario, Proveedores,
 * Compras, Pedidos, Clientes, Settings): ícono + título + cuenta en gris +
 * pastilla «Al día» (o una propia en `[pastilla]`), la lectura debajo y las
 * acciones a la derecha (contenido proyectado).
 *
 *   <app-modulo-cabecera [icono]="i.packages" titulo="Inventario" [cuenta]="32" [lectura]="lectura()">
 *     <button ...>Exportar</button>
 *   </app-modulo-cabecera>
 */
@Component({
  selector: 'app-modulo-cabecera',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap items-start justify-between gap-x-6 gap-y-3' },
  template: `
    <div class="min-w-0 flex-[1_1_420px]">
      <div class="flex items-center gap-2 text-[20px] text-[#303030]">
        <tabler-icon [icon]="icono()" [size]="20" [stroke]="2" />
        <h1 class="font-[Archivo] text-[22px] leading-[28px] font-semibold tracking-[-0.01em] text-[#111827]">{{ titulo() }}</h1>
        <span [title]="cuentaTitulo()" class="font-[Archivo] text-[22px] leading-[28px] font-medium tracking-[-0.01em] text-[#b5b5b5] tabular-nums">{{ cuenta() }}</span>
        @if (alDia()) {
          <span title="Todo al día · sin cambios pendientes"
            class="ml-1 inline-flex h-5.5 items-center gap-1.5 rounded-full bg-[rgba(41,132,90,.08)] pr-[9px] pl-2 text-[11.5px] font-medium whitespace-nowrap text-[#1f6e49]">
            <span class="relative flex size-1.5">
              <span class="absolute inset-0 animate-[gp-latido_2.4s_ease-in-out_infinite] rounded-full bg-[#29845a]"></span>
              <span class="relative size-1.5 rounded-full bg-[#29845a]"></span>
            </span>
            Al día
          </span>
        }
        <ng-content select="[pastilla]" />
      </div>
      <p class="mt-2 max-w-160 text-[13px] leading-[20px] text-pretty text-[#6b7280]">{{ lectura() }}</p>
    </div>
    <div class="flex items-center gap-2 pt-0.5"><ng-content /></div>
  `,
})
export class ModuloCabeceraComponent {
  readonly icono = input.required<TablerIcon>();
  readonly titulo = input.required<string>();
  readonly cuenta = input<string | number | null>(null);
  readonly cuentaTitulo = input('');
  readonly lectura = input('');
  /** Pastilla «Al día». Pedidos la esconde mientras hay pedidos nuevos de la tienda sin confirmar. */
  readonly alDia = input(true);
}
