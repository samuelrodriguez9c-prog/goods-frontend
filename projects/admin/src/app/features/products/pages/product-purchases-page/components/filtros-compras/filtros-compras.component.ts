import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono } from '../../../../shared/ui/iconos';
import { DOCUMENTOS, FiltroDocumento, RANGOS, RangoFecha } from '../../compras.modelo';
import { ControlSegmentadoComponent } from '../control-segmentado/control-segmentado.component';

/** Contenido del popover "Filtros": fecha, documento y proveedor. */
@Component({
  selector: 'app-filtros-compras',
  standalone: true,
  imports: [TablerIconComponent, ControlSegmentadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex items-center justify-between px-1 pt-0.5 pb-2.5">
      <span class="font-[Archivo] text-[15px] font-semibold text-[#111827]">Filtros</span>
      <button type="button" (click)="limpiar.emit()"
        class="cursor-pointer text-[12px] font-medium text-[#6b7280] underline [text-underline-offset:3px]">Limpiar</button>
    </div>
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <span class="text-[11.5px] font-semibold text-[#6b7280]">Fecha</span>
        <app-control-segmentado [opciones]="rangos" [valor]="rango()" (elegir)="rango.set($any($event))" />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="text-[11.5px] font-semibold text-[#6b7280]">Documento</span>
        <app-control-segmentado [opciones]="documentos" [valor]="documento()" (elegir)="documento.set($any($event))" />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="text-[11.5px] font-semibold text-[#6b7280]">Proveedor</span>
        <div class="flex max-h-45 flex-col gap-[1px] overflow-y-auto">
          @for (o of opciones(); track o.id) {
            @let activa = o.id === proveedor();
            <button type="button" (click)="proveedor.set(o.id)"
              class="flex h-8 cursor-pointer items-center justify-between rounded-lg px-2.5 text-left text-[12.5px] text-[#111827] hover:bg-[#f4f4f4]!"
              [class]="activa ? 'bg-[#f4f4f4] font-semibold' : 'bg-transparent font-medium'">
              <span class="truncate">{{ o.nombre }}</span>
              @if (activa) {
                <tabler-icon [icon]="icono('check')" [size]="14" [stroke]="2" />
              }
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class FiltrosComprasComponent {
  readonly rango = model.required<RangoFecha>();
  readonly documento = model.required<FiltroDocumento>();
  readonly proveedor = model.required<number | null>();
  /** "Todos los proveedores" (id null) y los que tienen compras. */
  readonly opciones = input.required<{ id: number | null; nombre: string }[]>();
  readonly limpiar = output<void>();

  protected readonly icono = icono;
  protected readonly rangos = RANGOS;
  protected readonly documentos = DOCUMENTOS;
}
