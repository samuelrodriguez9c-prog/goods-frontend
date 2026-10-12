import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CatalogoStore } from '../../../shared/catalogo.store';
import { codigoCompra, cop, dias, fecha } from '../../../shared/formato';
import { EstadoCompra } from '../../../shared/modelos';
import { statProveedor } from '../../../shared/proveedores.util';
import { ESTADO_COMPRA } from '../proveedores.modelo';
import { SeccionHojaComponent } from './seccion-hoja.component';

/** Días que cubre la línea de tiempo. */
const ALCANCE = 180;
const PUNTO_ESTADO: Record<EstadoCompra, string> = { recibida: 'bg-[#303030]', pendiente: 'bg-[#ffb904]', cancelada: 'bg-[#d4d4d4]' };
const MARCAS = [180, 120, 60, 0].map((d) => ({ texto: d ? 'hace ' + d + ' d' : 'hoy', posicion: 100 - (d / ALCANCE) * 100 }));

/**
 * Relación con el proveedor: frecuencia, última compra y una línea de tiempo de
 * 6 meses con un punto por compra (el tamaño es el monto; clic = ir a la compra).
 */
@Component({
  selector: 'app-relacion-proveedor',
  standalone: true,
  imports: [SeccionHojaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @let r = relacion();
    <app-seccion-hoja icono="timeline" titulo="Relación" detalle="Compras de los últimos 6 meses. El tamaño es el monto.">
      <div class="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
        <div>
          <div class="text-[11px] text-[#9ca3af]">Frecuencia</div>
          <div class="text-[13px] font-semibold text-[#111827]">{{ r.frecuencia }}</div>
        </div>
        <div>
          <div class="text-[11px] text-[#9ca3af]">Última</div>
          <div class="text-[13px] font-semibold text-[#111827]">{{ r.ultima }}</div>
        </div>
        <div>
          <div class="text-[11px] text-[#9ca3af]">En 6 meses</div>
          <div class="text-[13px] font-semibold text-[#111827]">{{ r.enSeisMeses }}</div>
        </div>
      </div>
      @if (r.puntos.length) {
        <div class="relative mx-7.5 mt-1 h-14.5">
          <span class="absolute top-6 right-0 left-0 h-0.5 rounded-xs bg-[#efefef]"></span>
          @for (p of r.puntos; track p.id) {
            @let activo = p.id === encima();
            <span (mouseenter)="encima.set(p.id)" (mouseleave)="activo && encima.set(null)" (click)="verCompra.emit(p.id)"
              class="absolute top-[25px] z-[2] animate-[pop_.4s_cubic-bezier(.2,.8,.2,1)_both] cursor-pointer rounded-full [transition:transform_.2s_cubic-bezier(.2,.8,.2,1),_box-shadow_.2s]"
              [class]="puntoEstado[p.estado] + (activo ? ' [transform:scale(1.15)] shadow-[0_0_0_3px_#fff,0_0_0_5px_#303030]' : ' [transform:scale(1)] shadow-[0_0_0_3px_#fff]')"
              [style.left.%]="p.posicion" [style.width.px]="p.tamano" [style.height.px]="p.tamano"
              [style.margin-top.px]="-p.tamano / 2" [style.margin-left.px]="-p.tamano / 2"></span>
            @if (activo) {
              <span class="pointer-events-none absolute -top-5.5 z-[5] flex animate-[fade-in-up_.15s_ease-out] flex-col items-center rounded-[9px] bg-[#1a1a1a] px-[9px] py-[5px] whitespace-nowrap [transform:translateX(-50%)]"
                [style.left.%]="p.posicion">
                <span class="text-[11.5px] font-semibold text-white tabular-nums">{{ p.titulo }}</span>
                <span class="text-[10.5px] text-[#c4c4c4]">{{ p.detalle }}</span>
              </span>
            }
          }
          @for (m of marcas; track m.texto) {
            <span class="absolute top-11 text-[10px] whitespace-nowrap text-[#b5b5b5] [transform:translateX(-50%)]" [style.left.%]="m.posicion">{{ m.texto }}</span>
          }
        </div>
      } @else {
        <div class="rounded-xl bg-[#fafafa] p-3.5 text-center text-[12.5px] text-[#9ca3af]">Sin compras en los últimos 6 meses.</div>
      }
    </app-seccion-hoja>
  `,
})
export class RelacionProveedorComponent {
  private readonly catalogo = inject(CatalogoStore);
  readonly proveedorId = input.required<number>();
  readonly verCompra = output<number>();

  protected readonly puntoEstado = PUNTO_ESTADO;
  protected readonly marcas = MARCAS;
  /** Compra con el cursor encima (muestra su globo). */
  protected readonly encima = signal<number | null>(null);

  protected readonly relacion = computed(() => {
    const stat = statProveedor(this.catalogo, this.proveedorId()), hoy = this.catalogo.hoy();
    const recientes = stat.compras.filter((c) => dias(c.fecha, hoy) <= ALCANCE).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const mayor = Math.max(1, ...recientes.map((c) => this.catalogo.totalCompra(c)));
    const vivas = stat.compras.filter((c) => c.estado !== 'cancelada').sort((a, b) => a.fecha.localeCompare(b.fecha));
    const intervalos = vivas.slice(1).map((c, i) => dias(vivas[i].fecha, hoy) - dias(c.fecha, hoy));
    const cada = intervalos.length ? Math.round(intervalos.reduce((a, b) => a + b, 0) / intervalos.length) : null;
    return {
      frecuencia: cada ? 'Cada ~' + cada + ' días' : stat.compras.length ? 'Una sola compra' : 'Sin compras',
      ultima: stat.diasDesdeUltima == null ? '—' : stat.diasDesdeUltima === 0 ? 'Hoy' : 'Hace ' + stat.diasDesdeUltima + ' d',
      enSeisMeses: recientes.filter((c) => c.estado !== 'cancelada').length,
      puntos: recientes.map((c) => {
        const total = this.catalogo.totalCompra(c);
        return {
          id: c.id, estado: c.estado,
          posicion: 100 - (dias(c.fecha, hoy) / ALCANCE) * 100,
          tamano: 10 + Math.round((total / mayor) * 18),
          titulo: codigoCompra(c.id) + ' · ' + cop(total),
          detalle: ESTADO_COMPRA[c.estado].texto + ' · ' + fecha(c.fecha),
        };
      }),
    };
  });
}
