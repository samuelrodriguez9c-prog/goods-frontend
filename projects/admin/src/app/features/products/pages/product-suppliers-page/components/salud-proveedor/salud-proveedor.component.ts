import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CatalogoStore } from '../../../../shared/catalogo.store';
import { saludProveedor } from '../../../../shared/proveedores.util';
import { SeccionHojaComponent } from '../seccion-hoja/seccion-hoja.component';

/** Perímetro del anillo (r = 26). */
const PERIMETRO = 2 * Math.PI * 26;
/** Color de la barra de cada factor según qué tan cerca está de 1. */
const barraFactor = (v: number) => (v >= 0.85 ? 'bg-[#29845a]' : v >= 0.6 ? 'bg-[#ffb904]' : 'bg-[#d82c0d]');

/** Salud del proveedor (0–100): anillo con el puntaje y una barra por factor. */
@Component({
  selector: 'app-salud-proveedor',
  standalone: true,
  imports: [SeccionHojaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @let s = salud();
    <app-seccion-hoja icono="heart-rate-monitor" titulo="Salud del proveedor" detalle="Entregas, precios y cancelaciones.">
      @if (s.tiene) {
        <div class="flex items-center gap-4">
          <span class="relative size-17 shrink-0">
            <svg width="68" height="68" viewBox="0 0 68 68" class="[transform:rotate(-90deg)]">
              <circle cx="34" cy="34" r="26" fill="none" stroke="#f1f1f1" class="[stroke-width:7]"></circle>
              <circle cx="34" cy="34" r="26" fill="none" [attr.stroke]="s.anillo" [attr.stroke-dasharray]="trazo()"
                class="[stroke-width:7] [stroke-linecap:round] [transition:stroke-dasharray_.8s_cubic-bezier(.2,.8,.2,1),_stroke_.3s]"></circle>
            </svg>
            <span class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="font-[Archivo] text-[19px] leading-[20px] font-semibold text-[#111827]">{{ s.puntaje }}</span>
              <span class="text-[9.5px] text-[#9ca3af]">de 100</span>
            </span>
          </span>
          <div class="flex min-w-0 flex-1 flex-col gap-[9px]">
            <span class="text-[13px] font-semibold" [style.color]="s.tinta">{{ s.nivel }}</span>
            @for (f of s.factores; track f.etiqueta) {
              <div class="flex flex-col gap-[3px]">
                <div class="flex justify-between gap-2 text-[11.5px]">
                  <span class="font-medium text-[#374151]">{{ f.etiqueta }}</span>
                  <span class="whitespace-nowrap text-[#6b7280]">{{ f.texto }}</span>
                </div>
                <span class="relative block h-1 rounded-full bg-[#f1f1f1]">
                  <span class="absolute top-0 bottom-0 left-0 rounded-full transition-[width] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]"
                    [class]="f.barra" [style.width.%]="f.ancho"></span>
                </span>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="rounded-xl bg-[#fafafa] p-3.5 text-center text-[12.5px] text-[#9ca3af]">Se calcula cuando tengas compras con este proveedor.</div>
      }
    </app-seccion-hoja>
  `,
})
export class SaludProveedorComponent {
  private readonly catalogo = inject(CatalogoStore);
  readonly proveedorId = input.required<number>();

  /** Puntaje, nivel y factores; la tinta del nivel y el color del anillo vienen del cálculo. */
  protected readonly salud = computed(() => {
    const s = saludProveedor(this.catalogo, this.proveedorId());
    return { ...s, factores: s.factores.map((f) => ({ ...f, ancho: Math.round(f.v * 100), barra: barraFactor(f.v) })) };
  });
  protected readonly trazo = computed(() => ((PERIMETRO * this.salud().puntaje) / 100).toFixed(1) + ' ' + PERIMETRO.toFixed(1));
}
