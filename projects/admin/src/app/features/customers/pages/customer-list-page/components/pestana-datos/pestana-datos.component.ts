import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { tel } from '../../../../../orders/shared/ventas.formato';
import { Cliente } from '../../../../../orders/shared/ventas.modelos';
import { ResumenClienteComponent } from '../resumen-cliente/resumen-cliente.component';

/**
 * Pestaña Resumen (lectura): las 4 cifras, Contacto y Dirección, si acepta
 * promociones (lo decide el cliente desde WhatsApp) y «Editar datos».
 */
@Component({
  selector: 'app-pestana-datos',
  standalone: true,
  imports: [IcComponent, ResumenClienteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[fade-in-up_.22s_ease-out] flex-col gap-4' },
  template: `
    @let cl = cliente();
    <app-resumen-cliente [cliente]="cl" />
    @for (g of datos(); track g.t) {
      <div class="flex flex-col gap-4 border-b border-[#f1f1f1] pt-1 pb-[18px]">
        <div class="flex items-start gap-3">
          <span class="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#f4f4f4] text-[#303030]"><app-ic [nombre]="g.ic" [size]="17" /></span>
          <span class="text-[15px] font-semibold tracking-[-.005em] text-gray-900">{{ g.t }}</span>
        </div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-3.5 pl-[46px]">
          @for (x of g.f; track x.k) {
            <span class="flex min-w-0 flex-col gap-[3px]">
              <span class="text-xs text-[#8a8a8a]">{{ x.k }}</span>
              <span class="text-[13.5px] font-medium break-words tabular-nums" [style.color]="x.c">{{ x.v }}</span>
            </span>
          }
        </div>
      </div>
    }
    <div class="flex items-start gap-3 rounded-[14px] bg-[#fafafa] px-3.5 py-3">
      <app-ic nombre="whatsapp" [size]="17" [class]="cl.aceptaPromociones ? 'text-[#25d366]' : 'text-gray-400'" />
      <span class="flex flex-col gap-0.5">
        <span class="text-[13px] font-semibold text-gray-900">{{ cl.aceptaPromociones ? 'Acepta recibir promociones' : 'No acepta promociones' }}</span>
        <span class="text-xs text-gray-500">{{ cl.whatsappContactoId ? 'Lo decide el cliente desde WhatsApp. Aquí solo se ve.' : 'Se activa cuando el cliente lo acepta por WhatsApp.' }}</span>
      </span>
    </div>
    @if (puedeEditar()) {
      <button type="button" class="gp-btn self-start" (click)="editar.emit()"><app-ic nombre="pencil" [size]="14" />Editar datos</button>
    }
  `,
})
export class PestanaDatosComponent {
  readonly cliente = input.required<Cliente>();
  readonly puedeEditar = input(true);
  readonly editar = output<void>();

  protected readonly datos = computed(() => {
    const c = this.cliente();
    const F = (k: string, v: string, vacio = false) => ({ k, v, c: vacio ? '#9ca3af' : '#111827' });
    return [
      { ic: 'user', t: 'Contacto', f: [F('Nombre', c.nombre), F('Celular', tel(c.telefono) || 'Sin celular', !c.telefono), F('Correo', c.correo || 'Sin correo', !c.correo), F('Cédula o NIT', c.documento || 'Sin documento', !c.documento)] },
      { ic: 'map-pin', t: 'Dirección', f: [F('Dirección', c.direccion.direccion || 'Sin dirección', !c.direccion.direccion), F('Referencia', c.direccion.referencia || 'Sin referencia', !c.direccion.referencia), F('Ciudad', c.direccion.ciudad || '—', !c.direccion.ciudad)] },
    ];
  });
}
