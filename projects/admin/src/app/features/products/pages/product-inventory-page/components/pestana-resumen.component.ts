import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, viewChild } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../shared/catalogo.store';
import { codigoCompra, hace, num } from '../../../shared/formato';
import { CompraV5, Stock } from '../../../shared/modelos';
import { icono } from '../../../shared/ui/iconos';
import { Ajuste, MOTIVOS, Signo, deltaAjuste, soloDigitos } from '../inventario.modelo';

const SIGNOS: { signo: Signo; titulo: string; icono: string }[] = [
  { signo: '+', titulo: 'Entrada', icono: 'arrow-down-left' },
  { signo: '-', titulo: 'Salida', icono: 'arrow-up-right' },
];

/**
 * Pestaña Resumen de la hoja: compras en camino, ajustar stock (con vista
 * previa del resultado) y stock mínimo. Los borradores viven en la página
 * (alimentan "Cambios sin guardar"); acá solo se editan.
 */
@Component({
  selector: 'app-pestana-resumen',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[fade-in-up_.22s_ease-out] flex-col gap-3.5' },
  templateUrl: './pestana-resumen.component.html',
})
export class PestanaResumenComponent {
  private readonly catalogo = inject(CatalogoStore);

  readonly stock = input.required<Stock>();
  /** Compras pendientes que traen el producto. */
  readonly enCamino = input<CompraV5[]>([]);
  readonly ajuste = input.required<Ajuste>();
  /** Borrador del mínimo (texto del campo). */
  readonly minimo = input.required<string>();
  readonly editable = input(false);
  readonly cambiarAjuste = output<Partial<Ajuste>>();
  readonly cambiarMinimo = output<string>();
  readonly guardar = output<void>();
  readonly irCompra = output<number>();

  protected readonly icono = icono;
  protected readonly num = num;
  protected readonly signos = SIGNOS;
  private readonly campoOtro = viewChild<ElementRef<HTMLInputElement>>('otro');

  protected readonly compras = computed(() => {
    const pid = this.stock().productoId, hoy = this.catalogo.hoy();
    return this.enCamino().map((c) => ({
      id: c.id,
      texto: `${c.items.find((it) => it.productoId === pid)!.cantidad} u en camino · ${codigoCompra(c.id)} · ${this.catalogo.proveedor(c.proveedorId)?.nombre ?? '—'}`,
      detalle: 'Pedida ' + hace(c.fecha, hoy),
    }));
  });
  protected readonly motivos = computed(() => MOTIVOS[this.ajuste().signo]);
  /** Vista previa: cómo queda el disponible si se guarda el ajuste. */
  protected readonly delta = computed(() => deltaAjuste(this.ajuste()));
  protected readonly resultado = computed(() => this.stock().disponible + this.delta());
  protected readonly invalido = computed(() => this.resultado() < 0);
  protected readonly minimoNumero = computed(() => +soloDigitos(this.minimo()) || 0);

  protected elegirSigno(signo: Signo): void {
    if (!this.editable()) return;
    const motivo = this.ajuste().motivo;
    this.cambiarAjuste.emit({ signo, motivo: MOTIVOS[signo].some((m) => m.nombre === motivo) ? motivo : 'Conteo físico' });
  }
  protected escribirCantidad(ev: Event): void {
    const campo = ev.target as HTMLInputElement;
    campo.value = soloDigitos(campo.value);
    this.cambiarAjuste.emit({ cantidad: campo.value });
  }
  protected elegirMotivo(motivo: string): void {
    if (!this.editable()) return;
    this.cambiarAjuste.emit({ motivo });
    if (motivo === 'Otro') setTimeout(() => this.campoOtro()?.nativeElement.focus(), 60);
  }
  protected escribirOtro(ev: Event): void {
    this.cambiarAjuste.emit({ otro: (ev.target as HTMLInputElement).value.slice(0, 60) });
  }
  protected escribirMinimo(ev: Event): void {
    const campo = ev.target as HTMLInputElement;
    campo.value = soloDigitos(campo.value);
    this.cambiarMinimo.emit(campo.value);
  }
  protected pasoMinimo(d: number): void {
    if (this.editable()) this.cambiarMinimo.emit(String(Math.max(0, this.minimoNumero() + d)));
  }
}
