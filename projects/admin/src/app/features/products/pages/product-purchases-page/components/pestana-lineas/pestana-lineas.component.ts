import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../../shared/catalogo.store';
import { cop, norm, num, pl } from '../../../../shared/formato';
import { ProductoV5 } from '../../../../shared/modelos';
import { icono } from '../../../../shared/ui/iconos';
import { CHIP_VARIACION, FichaCompra, LineaBorrador, conMiles, miniaturaDe, soloDigitos, variacionPrecio } from '../../compras.modelo';
import { ChipAsistenteComponent } from '../asistente/asistente.component';
import { BloqueoRecibir, BotonMantenerComponent } from '../boton-mantener/boton-mantener.component';
import { MiniaturaProductoComponent } from '../miniatura-producto/miniatura-producto.component';

/** Cambio en una línea del formulario. */
export interface CambioLinea {
  k: number;
  cambio: Partial<LineaBorrador>;
}

/**
 * Pestaña "Líneas": el detalle de lo comprado (lectura, con el impacto en el
 * stock y la revisión de lo que llegó) o las líneas editables con buscador de
 * producto; el resumen de totales y, si está pendiente, la recepción.
 */
@Component({
  selector: 'app-pestana-lineas',
  standalone: true,
  imports: [TablerIconComponent, MiniaturaProductoComponent, ChipAsistenteComponent, BotonMantenerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pestana-lineas.component.html',
  host: { class: 'flex animate-[fade-in-up_.22s_ease-out] flex-col gap-1.5' },
})
export class PestanaLineasComponent {
  private readonly catalogo = inject(CatalogoStore);

  readonly ficha = input.required<FichaCompra>();
  /** Los campos se pueden editar (permiso). */
  readonly editable = input(false);
  /** Ya se intentó guardar: se marcan los errores. */
  readonly intento = input(false);
  readonly errores = input<Record<string, string | number>>({});
  readonly bloqueo = input<BloqueoRecibir>(null);
  /** Líneas marcadas como "llegó completa" (por índice). */
  readonly revisadas = model<Record<number, boolean>>({});
  readonly cambiarLinea = output<CambioLinea>();
  readonly agregarLinea = output<void>();
  readonly quitarLinea = output<number>();
  readonly verProducto = output<number>();
  readonly recibir = output<number>();
  readonly bloqueado = output<BloqueoRecibir>();

  protected readonly icono = icono;
  protected readonly cop = cop;
  protected readonly chipVariacion = CHIP_VARIACION;

  protected readonly lineaEncima = signal<number | null>(null);
  /** Línea con el buscador de producto abierto. */
  protected readonly buscando = signal<number | null>(null);

  /** Impacto en el stock y revisión de cada línea. */
  private readonly impacto = computed(() => {
    const revisadas = this.revisadas();
    return this.ficha().items.map((it, k) => {
      const st = this.catalogo.stockDe(it.productoId), despues = st.disponible + it.cantidad, escala = Math.max(despues, st.minimo * 1.4, 1);
      return {
        ahora: num(st.disponible),
        despues: num(despues),
        anchoAhora: (Math.max(0, st.disponible) / escala) * 100,
        anchoSuma: (it.cantidad / escala) * 100,
        posicionMinimo: st.minimo > 0 ? (st.minimo / escala) * 100 : null,
        cubre: st.disponible < st.minimo && despues >= st.minimo,
        sigueBajo: despues < st.minimo && st.minimo > 0,
        revisada: !!revisadas[k],
      };
    });
  });

  /** Detalle de lectura. */
  protected readonly detalle = computed(() => {
    const f = this.ficha(), c = f.compra;
    if (f.formulario || !c) return [];
    const total = Math.max(1, this.catalogo.totalCompra(c)), impacto = this.impacto();
    return c.items.map((it, k) => {
      const subtotal = it.cantidad * it.precioUnitario;
      return {
        k,
        productoId: it.productoId,
        nombre: this.catalogo.producto(it.productoId)?.nombre ?? '?',
        miniatura: miniaturaDe(this.catalogo.producto(it.productoId), this.catalogo),
        cantidad: num(it.cantidad),
        precio: cop(it.precioUnitario),
        subtotal: cop(subtotal),
        participacion: (subtotal / total) * 100,
        porcentaje: Math.round((subtotal / total) * 100) + ' %',
        /** Entrada escalonada (tope en la línea 10). */
        retraso: Math.min(k, 10) * 35,
        variacion: variacionPrecio(this.catalogo, it.productoId, it.precioUnitario, f.fecha, c.id),
        ...impacto[k],
      };
    });
  });

  /** Líneas del formulario. */
  protected readonly lineas = computed(() => {
    const f = this.ficha(), d = f.borrador;
    if (!f.formulario || !d) return [];
    const errores = this.errores(), intento = this.intento(), buscando = this.buscando();
    return d.items.map((it, k) => {
      const q = norm((it.busqueda || '').trim());
      const opciones = buscando === k
        ? this.catalogo.productos().filter((p) => p.estado !== 'descontinuado' && (!q || norm(p.nombre).includes(q) || norm(p.sku).includes(q))).slice(0, 7)
        : [];
      const cantidad = +it.cantidad || 0, precio = +soloDigitos(it.precioUnitario) || 0;
      const st = it.productoId ? this.catalogo.stockDe(it.productoId) : null, despues = st ? st.disponible + cantidad : 0;
      return {
        k,
        busqueda: it.busqueda,
        textoFactura: it.textoFactura,
        ia: it.ia,
        cantidad: it.cantidad,
        precio: conMiles(it.precioUnitario),
        subtotal: cop(cantidad * precio),
        desconocida: !it.productoId && !!it.textoFactura,
        sinProducto: intento && !!errores['p' + k],
        sinCantidad: intento && !!errores['q' + k],
        opciones: opciones.map((p) => ({
          p,
          detalle: (p.sku || 'Sin SKU') + ' · costo ' + (p.costo != null ? cop(p.costo) : '—'),
          miniatura: miniaturaDe(p, this.catalogo),
        })),
        stock: st && cantidad > 0 ? { ahora: num(st.disponible), despues: num(despues), cubre: st.disponible < st.minimo && despues >= st.minimo } : null,
        variacion: it.productoId ? variacionPrecio(this.catalogo, it.productoId, precio, f.fecha, f.compra?.id) : null,
      };
    });
  });
  protected readonly desconocidas = computed(() => this.lineas().filter((l) => l.desconocida).length);

  protected readonly resumen = computed(() => {
    const f = this.ficha();
    return [
      { k: 'Subtotal', v: cop(f.total) },
      { k: 'Unidades', v: num(f.unidades) },
      { k: 'Costo promedio por unidad', v: f.unidades ? cop(f.total / f.unidades) : '—' },
    ];
  });

  /** Bloque "Entrarán…" con el botón de recibir (solo pendientes guardadas). */
  protected readonly recepcion = computed(() => {
    const f = this.ficha();
    if (f.esNueva || f.estado !== 'pendiente') return null;
    const impacto = this.impacto(), revisadas = impacto.filter((r) => r.revisada).length, cubren = impacto.filter((r) => r.cubre).length;
    return {
      compraId: f.compra!.id,
      titulo: 'Entrarán ' + pl(f.unidades, 'unidad', 'unidades') + ' en ' + pl(f.items.length, 'producto', 'productos'),
      cubren: cubren ? pl(cubren, 'vuelve', 'vuelven') + ' a cubrir el mínimo' : null,
      revisadas: revisadas + ' de ' + f.items.length + ' revisadas',
      progreso: f.items.length ? (revisadas / f.items.length) * 100 : 0,
      nota: this.bloqueo() === 'sucio'
        ? 'Guarda los cambios antes de recibir.'
        : 'Marca lo que llegó completo (opcional). Al recibir se registra la entrada en Inventario con la referencia de esta compra.',
    };
  });

  protected alternarRevisada(k: number, e: Event): void {
    e.stopPropagation();
    this.revisadas.update((r) => ({ ...r, [k]: !r[k] }));
  }
  protected buscar(k: number, texto: string): void {
    this.cambiarLinea.emit({ k, cambio: { busqueda: texto, productoId: null } });
    this.buscando.set(k);
  }
  protected elegirProducto(k: number, p: ProductoV5, e: Event): void {
    e.preventDefault();
    const precio = this.ficha().borrador?.items[k]?.precioUnitario;
    this.cambiarLinea.emit({ k, cambio: { productoId: p.id, busqueda: p.nombre, precioUnitario: precio || (p.costo == null ? '' : String(p.costo)), textoFactura: '', ia: false } });
    this.buscando.set(null);
  }
  /** Deja terminar el mousedown de una opción antes de cerrar. */
  protected cerrarBuscador(k: number): void {
    setTimeout(() => {
      if (this.buscando() === k) this.buscando.set(null);
    }, 150);
  }
  protected cambiarCantidad(k: number, campo: HTMLInputElement): void {
    const cantidad = soloDigitos(campo.value);
    this.cambiarLinea.emit({ k, cambio: { cantidad, ia: false } });
    campo.value = cantidad;
  }
  /** Costo unitario: solo dígitos, mostrado con separador de miles. */
  protected cambiarPrecio(k: number, campo: HTMLInputElement): void {
    const raw = soloDigitos(campo.value);
    this.cambiarLinea.emit({ k, cambio: { precioUnitario: raw, ia: false } });
    campo.value = conMiles(raw);
  }
}
