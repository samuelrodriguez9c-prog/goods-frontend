import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { fecha } from '../../../../shared/formato';
import { icono } from '../../../../shared/ui/iconos';
import { FichaCompra } from '../../compras.modelo';

/** Cómo se ve cada paso: hecho, en camino (a tiempo o atrasado), recibido, cancelado o por venir. */
type TonoPaso = 'hecho' | 'camino' | 'atrasado' | 'recibido' | 'cancelado' | 'futuro';
interface Paso {
  label: string;
  detalle: string;
  tono: TonoPaso;
}

const CIRCULO: Record<TonoPaso, string> = {
  hecho: 'bg-[#303030] shadow-[inset_0_0_0_1.5px_#303030]',
  camino: 'bg-[#ffb904] shadow-[inset_0_0_0_1.5px_#ffb904]',
  atrasado: 'bg-[#d82c0d] shadow-[inset_0_0_0_1.5px_#d82c0d]',
  recibido: 'bg-[#29845a] shadow-[inset_0_0_0_1.5px_#29845a]',
  cancelado: 'bg-[#9ca3af] shadow-[inset_0_0_0_1.5px_#9ca3af]',
  futuro: 'bg-white shadow-[inset_0_0_0_1.5px_#e3e3e3]',
};
const ICONO: Record<TonoPaso, string | null> = {
  hecho: 'check', camino: 'truck', atrasado: 'truck', recibido: 'check', cancelado: 'x', futuro: null,
};

/** Seguimiento de la compra: Creada → En camino → Recibida (o Creada → Cancelada). */
@Component({
  selector: 'app-seguimiento-compra',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center rounded-[14px] bg-[#fafafa] px-3.5 py-3 shadow-[inset_0_0_0_1px_#f0f0f0]' },
  template: `
    @for (p of pasos(); track p.label; let k = $index, ultimo = $last) {
      <div class="flex min-w-0 animate-[fade-in-up_.3s_ease-out_both] items-center gap-[9px]" [class]="ultimo ? 'flex-none' : 'flex-1'"
        [style.animation-delay.ms]="k * 90">
        <span class="flex size-5.5 shrink-0 items-center justify-center rounded-full text-white" [class]="circulo[p.tono]">
          @if (iconoDe[p.tono]; as nombre) {
            <tabler-icon [icon]="icono(nombre)" [size]="12" [stroke]="2" />
          }
        </span>
        <span class="flex min-w-0 flex-col gap-[1px]">
          <span class="text-[12.5px] font-semibold whitespace-nowrap" [class]="p.tono === 'futuro' ? 'text-[#9ca3af]' : 'text-[#111827]'">{{ p.label }}</span>
          <span class="text-[11px] whitespace-nowrap text-[#9ca3af] tabular-nums">{{ p.detalle }}</span>
        </span>
        @if (!ultimo) {
          <span class="mx-1.5 h-0 min-w-4 flex-1 border-t-[1.5px] border-dashed"
            [class]="pasos()[k + 1].tono === 'futuro' ? 'border-t-[#dedede]' : 'border-t-[#9a9a9a]'"></span>
        }
      </div>
    }
  `,
})
export class SeguimientoCompraComponent {
  readonly ficha = input.required<FichaCompra>();

  protected readonly icono = icono;
  protected readonly circulo = CIRCULO;
  protected readonly iconoDe = ICONO;
  protected readonly pasos = computed<Paso[]>(() => {
    const { compra: c, esNueva, estado, dias, atrasada } = this.ficha();
    if (estado === 'cancelada') {
      return [
        { label: 'Creada', detalle: fecha(c!.fecha), tono: 'hecho' },
        { label: 'Cancelada', detalle: 'no sumó stock', tono: 'cancelado' },
      ];
    }
    const pendiente = estado === 'pendiente';
    return [
      { label: 'Creada', detalle: esNueva ? 'sin guardar' : fecha(c!.fecha), tono: esNueva ? 'futuro' : 'hecho' },
      {
        label: 'En camino',
        detalle: esNueva ? '—' : pendiente ? (dias === 0 ? 'desde hoy' : dias + ' días') : 'entregada',
        tono: esNueva ? 'futuro' : pendiente ? (atrasada ? 'atrasado' : 'camino') : 'hecho',
      },
      {
        label: 'Recibida',
        detalle: estado === 'recibida' && c!.recibidaEn ? fecha(c!.recibidaEn) : 'el stock entra aquí',
        tono: estado === 'recibida' ? 'recibido' : 'futuro',
      },
    ];
  });
}
