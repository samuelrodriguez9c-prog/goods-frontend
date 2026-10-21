import { NgTemplateOutlet, SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import {
  IconAdjustments, IconAlertCircle, IconAlertTriangle, IconAlignLeft, IconArrowDownLeft, IconArrowUpRight,
  IconArrowsMaximize, IconArrowsMinimize, IconBell, IconCamera, IconChartPie, IconCheck, IconChevronDown,
  IconChevronUp, IconCloudUpload, IconCornerDownRight, IconDots, IconEye, IconFolder, IconForms, IconFolderOff, IconHash,
  IconHistory, IconId, IconInfoCircle, IconLink, IconLock, IconPackages, IconPhoto, IconPointer, IconRefresh,
  IconSelector, IconStar, IconStarFilled, IconTag, IconTrash, IconWeight, IconWorld, IconX, TablerIconComponent,
} from '@tabler/icons-angular';
import { forkJoin } from 'rxjs';
import { InventarioService, MovimientoInventario } from '../../../../core/inventario/inventario.service';
import { ESTADOS_PRODUCTO, EstadoProducto } from '../../../../core/producto/models/producto.model';
import { ProductoService } from '../../../../core/producto/producto.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PistaService } from '../../../../core/ui/pista.service';
import { UploadService } from '../../../../core/upload/upload.service';
import { AutofocoDirective } from '../../../../shared/ui/autofoco.directive';
import { CamposPropiosComponent } from '../../../../shared/ui/campos-propios/campos-propios.component';
import { RouterLink } from '@angular/router';
import { Borrador, Pestana, ProductosStore, cop, num, pct, slugDe } from '../../productos.store';

const MAX_IMAGEN = 8e6;
const MOTIVOS = ['Conteo físico', 'Merma', 'Daño', 'Regalo', 'Otro'];
const DESC_ESTADO: Record<EstadoProducto, string> = {
  activo: 'Se ve y se vende en la tienda.',
  agotado: 'Se ve en la tienda, pero no se puede comprar.',
  descontinuado: 'Se oculta de la tienda y conserva su historial.',
};

/**
 * Ficha del producto. Lee y escribe el borrador del
 * `ProductosStore` del padre. Seis pestañas; cada una en tarjetas de 2 columnas
 * que pasan a 1 con poco ancho.
 */
@Component({
  selector: 'app-producto-ficha',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TablerIconComponent, NgTemplateOutlet, SlicePipe, AutofocoDirective, CamposPropiosComponent, RouterLink],
  templateUrl: './producto-ficha.component.html',
  host: { class: 'contents' },
})
export class ProductoFichaComponent {
  protected readonly s = inject(ProductosStore);
  private readonly api = inject(ProductoService);
  private readonly inventarioApi = inject(InventarioService);
  private readonly upload = inject(UploadService);
  private readonly alertas = inject(AlertaService);
  private readonly pista = inject(PistaService);

  protected readonly ic = {
    x: IconX, arriba: IconChevronUp, abajo: IconChevronDown, max: IconArrowsMaximize, min: IconArrowsMinimize,
    dots: IconDots, trash: IconTrash, star: IconStar, starOn: IconStarFilled, hash: IconHash, lock: IconLock,
    id: IconId, ajustes: IconAdjustments, folder: IconFolder, sinFolder: IconFolderOff, selector: IconSelector,
    hija: IconCornerDownRight, check: IconCheck, texto: IconAlignLeft, foto: IconPhoto, camara: IconCamera,
    subir: IconCloudUpload, tag: IconTag, pie: IconChartPie, alerta: IconAlertTriangle, info: IconInfoCircle,
    error: IconAlertCircle, cajas: IconPackages, campana: IconBell, historial: IconHistory, peso: IconWeight,
    mundo: IconWorld, ojo: IconEye, link: IconLink, regen: IconRefresh, puntero: IconPointer,
    entrada: IconArrowDownLeft, salida: IconArrowUpRight, campos: IconForms,
  };
  protected readonly EST = ESTADOS_PRODUCTO;
  protected readonly estados = Object.keys(ESTADOS_PRODUCTO) as EstadoProducto[];
  protected readonly DESC_ESTADO = DESC_ESTADO;
  protected readonly MOTIVOS = MOTIVOS;
  protected readonly cop = cop;
  protected readonly num = num;
  protected readonly pestanas: [Pestana, string][] = [
    ['general', 'General'], ['multimedia', 'Multimedia'], ['precio', 'Precio'],
    ['inventario', 'Inventario'], ['envio', 'Envío'], ['tienda', 'Tienda / SEO'],
  ];

  protected readonly indicePestana = computed(() => this.pestanas.findIndex((x) => x[0] === this.s.pestana()));
  protected readonly menu = signal<'mas' | 'estado' | 'categoria' | null>(null);
  protected readonly arrastrando = signal<number | null>(null);
  protected readonly movimientos = signal<MovimientoInventario[] | null>(null);
  protected readonly ajuste = signal<{ signo: '+' | '-'; cantidad: string; motivo: string; otro: string } | null>(null);

  protected readonly b = computed(() => this.s.borrador());
  protected readonly esNuevo = computed(() => this.s.abierto() === 'nuevo');
  protected readonly p = computed(() => {
    const a = this.s.abierto();
    return typeof a === 'number' ? (this.s.producto(a) ?? null) : null;
  });
  protected readonly soloLectura = computed(() => !this.s.puede(this.esNuevo() ? 'productos.crear' : 'productos.editar'));
  protected readonly imagenes = computed(() => this.p()?.imagenes ?? []);
  protected readonly posicion = computed(() => {
    const ids = this.s.idsVisibles(), i = ids.indexOf(this.s.abierto() as number);
    return { i, n: ids.length, hay: i >= 0 && !this.esNuevo() };
  });

  /** Un error se muestra si ya intentó guardar o si tocó ese campo. */
  protected err(k: keyof Borrador): string {
    const e = this.s.errores()[k], b = this.b(), g = this.s.guardado();
    return e && (this.s.intento() || b?.[k] !== g?.[k]) ? e : '';
  }
  protected readonly errPestana = computed(() => ({
    general: !!(this.err('nombre') || this.err('sku')),
    precio: !!this.err('precio'),
    tienda: !!this.err('slug'),
  }) as Partial<Record<Pestana, boolean>>);
  protected anillo(k: keyof Borrador): string {
    return this.err(k) ? '0 0 0 1px #d82c0d' : '0 0 0 1px #e5e5e5';
  }

  // valores formateados de los inputs
  protected dinero(k: 'precio' | 'precioComparacion' | 'costo'): string {
    const v = this.b()?.[k] ?? '';
    return v === '' ? '' : Number(v).toLocaleString('es-CO');
  }
  protected poner(k: keyof Borrador, raw: string, el?: HTMLInputElement): void {
    let v = raw;
    if (['precio', 'precioComparacion', 'costo', 'stockMinimo', 'pesoGramos'].includes(k)) v = raw.replace(/[^\d]/g, '');
    if (['altoCm', 'anchoCm', 'largoCm'].includes(k)) v = raw.replace(',', '.').replace(/[^\d.]/g, '');
    this.s.editar(k, v as never);
    // Si lo tecleado no cambió el borrador (p. ej. una letra), el binding
    // [value] no se vuelve a pintar y la letra quedaría en pantalla.
    if (el) {
      const visto = k === 'precio' || k === 'precioComparacion' || k === 'costo' ? this.dinero(k) : v;
      if (el.value !== visto) el.value = visto;
    }
  }

  protected readonly categoriaEtiqueta = computed(() => {
    const id = this.b()?.categoriaId;
    if (!id) return 'Sin categoría';
    const c = this.s.categoria(+id);
    return c?.categoriaPadreId ? this.s.nombreCategoria(c.categoriaPadreId) + ' › ' + c.nombre : (c?.nombre ?? 'Sin categoría');
  });

  /** Medidor de stock bajo la cabecera. */
  protected readonly medidor = computed(() => {
    const p = this.p();
    if (!p) return null;
    const i = this.s.stock(p.id), st = this.s.estadoStock(p.id), tope = Math.max(i.min * 2, i.disp, 1);
    return {
      txt: num(i.disp) + (i.disp === 1 ? ' disponible' : ' disponibles'),
      res: i.res ? num(i.res) + (i.res === 1 ? ' reservada' : ' reservadas') : '',
      nota: i.min ? (st === 'ok' ? 'Mínimo ' + i.min : st === 'bajo' ? 'Bajo el mínimo (' + i.min + ')' : 'Sin stock') : 'Sin mínimo',
      notaC: st === 'ok' ? '#6b7280' : st === 'bajo' ? '#8a5a00' : '#d82c0d',
      w: Math.min(100, (Math.max(0, i.disp) / tope) * 100) + '%',
      c: st === 'ok' ? '#303030' : st === 'bajo' ? '#ffb904' : '#d82c0d',
      minL: i.min ? (i.min / tope) * 100 + '%' : null,
    };
  });

  protected readonly rentabilidad = computed(() => {
    const b = this.b()!, pr = +b.precio || 0, co = b.costo === '' ? null : +b.costo, cp = b.precioComparacion === '' ? null : +b.precioComparacion;
    const hay = co != null && pr > 0;
    return {
      margen: hay ? pct((pr - co!) / pr) : '—',
      ganancia: co != null ? cop(pr - co) : '—',
      descuento: cp && cp > pr ? pct((cp - pr) / cp) : '—',
      color: hay && co! > pr ? '#d82c0d' : '#111827',
      barra: hay ? { costo: Math.min(100, (co! / pr) * 100) + '%', gana: Math.max(0, 100 - (co! / pr) * 100) + '%', c: co! > pr ? '#d82c0d' : '#2be0d5', costoTxt: cop(co!) } : null,
      pierde: co != null && co > pr,
      sinCosto: co == null,
      compBaja: !!cp && cp <= pr && pr > 0,
    };
  });

  protected readonly inv = computed(() => {
    const p = this.p();
    const i = p ? this.s.stock(p.id) : { disp: 0, res: 0, min: +(this.b()?.stockMinimo || 0) };
    const st = p ? this.s.estadoStock(p.id) : 'ok';
    return {
      disp: num(i.disp), res: num(i.res), vend: num(i.disp - i.res), vendC: i.disp - i.res < 0 ? '#d82c0d' : '#111827',
      estado: { sin: 'Sin stock', bajo: 'Bajo el mínimo', ok: 'Stock al día' }[st],
      estadoC: p ? { sin: '#d82c0d', bajo: '#8a5a00', ok: '#087b5d' }[st] : '#6b7280',
    };
  });

  /** Caja isométrica proporcional a las medidas. */
  protected readonly caja = computed(() => {
    const b = this.b()!;
    const A = +b.anchoCm || 10, L = +b.largoCm || 10, H = +b.altoCm || 6, k = 64 / Math.max(A, L, H), a = A * k, l = L * k, h = H * k;
    const P = (x: number, y: number, z: number) => (90 + (x - y) * 0.866).toFixed(1) + ',' + (78 + (x + y) * 0.5 - z).toFixed(1);
    const g = +b.pesoGramos;
    return {
      top: [P(0, 0, h), P(a, 0, h), P(a, l, h), P(0, l, h)].join(' '),
      right: [P(a, 0, 0), P(a, l, 0), P(a, l, h), P(a, 0, h)].join(' '),
      left: [P(0, l, 0), P(a, l, 0), P(a, l, h), P(0, l, h)].join(' '),
      txt: (b.largoCm || '—') + ' × ' + (b.anchoCm || '—') + ' × ' + (b.altoCm || '—') + ' cm',
      peso: b.pesoGramos ? (g >= 1000 ? (g / 1000).toLocaleString('es-CO') + ' kg' : g + ' g') : 'Sin peso',
      vol: b.altoCm && b.anchoCm && b.largoCm ? 'Volumen ' + num(+b.altoCm * +b.anchoCm * +b.largoCm) + ' cm³' : 'Completa las tres medidas',
    };
  });

  protected readonly vitrina = computed(() => {
    const b = this.b()!, pr = +b.precio || 0, cp = b.precioComparacion === '' ? null : +b.precioComparacion;
    return {
      nombre: b.nombre || 'Nombre del producto', precio: b.precio ? cop(pr) : '$0',
      comp: cp && cp > pr ? cop(cp) : '', off: cp && cp > pr ? '−' + pct((cp - pr) / cp) : '',
      img: this.imagenes()[0]?.url ?? null, cat: b.categoriaId ? this.s.nombreCategoria(+b.categoriaId) : 'Tu tienda',
      noDisponible: b.estado !== 'activo',
    };
  });

  constructor() {
    // Movimientos: se piden al entrar a la pestaña Inventario.
    effect(() => {
      const p = this.p();
      if (this.s.pestana() !== 'inventario' || !p || !this.s.puede('inventario.ver')) return;
      this.movimientos.set(null);
      this.inventarioApi.movimientos(p.id).subscribe({ next: (r) => this.movimientos.set(r.data), error: () => this.movimientos.set([]) });
    });
  }

  protected alternarMenu(m: 'mas' | 'estado' | 'categoria', e: Event): void {
    e.stopPropagation();
    if (m !== 'mas' && this.soloLectura()) return;
    this.menu.update((x) => (x === m ? null : m));
  }

  protected movVM(m: MovimientoInventario) {
    const T = {
      entrada: [this.ic.entrada, '#e6f6ec', '#087b5d', 'Entrada'],
      salida: [this.ic.salida, '#ffe6e5', '#d82c0d', 'Salida'],
      ajuste: [this.ic.ajustes, '#e0f2fe', '#0284c7', 'Ajuste'],
    }[m.tipo];
    const signo = m.tipo === 'salida' ? -Math.abs(m.cantidad) : m.tipo === 'entrada' ? Math.abs(m.cantidad) : m.cantidad;
    const f = new Date(m.creadoEn);
    return {
      icon: T[0], bg: T[1] as string, fg: T[2] as string,
      titulo: T[3] + ' ' + (signo > 0 ? '+' : '−') + Math.abs(signo),
      motivo: m.motivo || T[3],
      ref: m.referenciaTipo === 'compra' ? 'Compra C-' + String(m.referenciaId).padStart(4, '0') : m.referenciaTipo === 'pedido' ? 'Pedido #' + m.referenciaId : '',
      fecha: f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
  }

  regenerarSlug(): void {
    this.s.borrador.update((b) => (b ? { ...b, slug: slugDe(b.nombre), slugManual: false } : b));
  }

  // imágenes
  protected subir(files: FileList | null): void {
    const p = this.p();
    if (!p) return void this.alertas.mostrar({ estado: 'warning', titulo: 'Guarda el producto antes de subir imágenes' });
    if (this.s.niega('productos.editar')) return;
    const lista = Array.from(files ?? []).filter((f) => /^image\//.test(f.type));
    if (!lista.length) return void this.alertas.mostrar({ estado: 'warning', titulo: 'Solo se aceptan imágenes (JPG, PNG o WebP)' });
    const grandes = lista.filter((f) => f.size > MAX_IMAGEN), ok = lista.filter((f) => f.size <= MAX_IMAGEN);
    if (grandes.length) {
      this.alertas.mostrar({
        estado: 'error',
        titulo: grandes.length === 1 ? 'No se pudo subir 1 imagen' : 'No se pudieron subir ' + grandes.length + ' imágenes',
        texto: grandes.map((f) => f.name).join(', ') + ' · pesa' + (grandes.length === 1 ? '' : 'n') + ' más de 8 MB. Redúcelas e inténtalo de nuevo.',
      });
    }
    if (!ok.length) return;
    // Una sola alerta que muta: "Subiendo 3 imágenes · 1 de 3" → resultado.
    const n = ok.length, nombre = n === 1 ? ok[0].name : n + ' imágenes';
    const id = this.alertas.mostrar({ titulo: 'Subiendo ' + nombre, texto: n > 1 ? '0 de ' + n : undefined });
    let hechas = 0;
    const base = p.imagenes.length;
    forkJoin(
      ok.map((f, k) => {
        const sub = this.upload.subir(f);
        return new Promise<{ url: string; k: number }>((res, rej) =>
          sub.subscribe({ next: (a) => { hechas++; if (n > 1) this.alertas.actualizar(id, { texto: hechas + ' de ' + n }); res({ url: a.url, k }); }, error: rej }),
        );
      }),
    ).subscribe({
      next: (subidas) =>
        forkJoin(subidas.map((x) => this.api.agregarImagen(p.id, x.url, base + x.k))).subscribe({
          next: (imgs) => {
            this.s.productos.update((xs) => xs.map((q) => (q.id === p.id ? { ...q, imagenes: [...q.imagenes, ...imgs].sort((a, b) => a.orden - b.orden) } : q)));
            this.alertas.resolver(id, {
              estado: 'success', titulo: n === 1 ? 'Imagen subida' : n + ' imágenes subidas', texto: 'Ya se ven en la tienda',
              accion: { label: 'Deshacer', ejecutar: () => this.quitarImagenes(p.id, imgs.map((m) => m.id)) },
            });
          },
          error: () => this.alertas.resolver(id, { estado: 'error', titulo: 'No se pudieron guardar las imágenes', texto: 'Se subieron pero el producto no las aceptó. Inténtalo de nuevo.' }),
        }),
      error: () => this.alertas.resolver(id, { estado: 'error', titulo: 'No se pudo subir', texto: 'Revisa tu conexión e inténtalo de nuevo.' }),
    });
  }

  private quitarImagenes(productoId: number, ids: number[]): void {
    this.alertas
      .seguir(forkJoin(ids.map((i) => this.api.eliminarImagen(productoId, i))), {
        titulo: ids.length === 1 ? 'Quitando imagen' : 'Quitando imágenes',
        exito: { titulo: ids.length === 1 ? 'Imagen quitada' : 'Imágenes quitadas' },
        error: { titulo: 'No se pudo quitar', texto: 'Inténtalo de nuevo.' },
      })
      .subscribe(() => this.s.productos.update((xs) => xs.map((q) => (q.id === productoId ? { ...q, imagenes: q.imagenes.filter((m) => !ids.includes(m.id)).map((m, k) => ({ ...m, orden: k })) } : q))));
  }

  protected pedirQuitarImagen(imagenId: number, e: Event): void {
    e.stopPropagation();
    const p = this.p();
    if (!p || this.s.niega('productos.editar')) return;
    this.alertas.abrirOverlay({
      variante: 'tarjeta', estado: 'warning', titulo: 'Eliminar imagen', dato: 'Se quita de la ficha y de la tienda.',
      primario: { label: 'Eliminar', ejecutar: () => { this.alertas.cerrarOverlay(); this.quitarImagenes(p.id, [imagenId]); } },
      secundario: { label: 'Cancelar', ejecutar: () => this.alertas.cerrarOverlay() },
    });
  }

  // TODO(backend): endpoint para guardar el orden (`PATCH /productos/:id/imagenes/orden`
  // con `[{id, orden}]`). Mientras tanto se reordena solo en pantalla.
  protected soltarImagen(destino: number, e: DragEvent): void {
    e.preventDefault();
    const desde = this.arrastrando(), p = this.p();
    this.arrastrando.set(null);
    if (desde == null || desde === destino || !p) return;
    const im = [...p.imagenes];
    const [x] = im.splice(desde, 1);
    im.splice(destino, 0, x);
    this.s.productos.update((xs) => xs.map((q) => (q.id === p.id ? { ...q, imagenes: im.map((m, k) => ({ ...m, orden: k })) } : q)));
    this.pista.hecho(destino === 0 ? 'Nueva portada guardada' : 'Orden guardado');
  }

  protected elegirArchivos(input: HTMLInputElement): void {
    this.subir(input.files);
    input.value = '';
  }

  // ajuste de stock
  protected cambiarAjuste(c: Partial<{ signo: '+' | '-'; cantidad: string; motivo: string; otro: string }>): void {
    this.ajuste.update((a) => (a ? { ...a, ...c } : a));
  }
  /** Solo dígitos (igual que `poner`): una letra no queda escrita. */
  protected cantidadAjuste(el: HTMLInputElement): void {
    const v = el.value.replace(/[^\d]/g, '');
    if (el.value !== v) el.value = v;
    this.cambiarAjuste({ cantidad: v });
  }
  /** Esc cierra el modal de ajuste (antes de que la página use la tecla). */
  @HostListener('window:keydown.escape', ['$event'])
  protected escapeAjuste(e: Event): void {
    if (!this.ajuste()) return;
    e.stopImmediatePropagation();
    this.ajuste.set(null);
  }
  protected abrirAjuste(): void {
    if (this.s.niega('inventario.editar')) return;
    this.ajuste.set({ signo: '+', cantidad: '', motivo: MOTIVOS[0], otro: '' });
  }
  protected readonly ajusteVM = computed(() => {
    const a = this.ajuste(), p = this.p();
    if (!a || !p) return null;
    const i = this.s.stock(p.id), q = +a.cantidad.replace(/[^\d]/g, '') || 0, despues = i.disp + (a.signo === '+' ? q : -q);
    return { antes: i.disp, despues, q, malo: despues < 0, bajo: despues >= 0 && i.min > 0 && despues < i.min, min: i.min };
  });
  protected aplicarAjuste(): void {
    const a = this.ajuste(), v = this.ajusteVM(), p = this.p();
    if (!a || !v || !p || !v.q || v.malo) return;
    const motivo = a.motivo === 'Otro' ? a.otro.trim() || 'Otro' : a.motivo;
    this.ajuste.set(null);
    this.alertas
      .seguir(this.inventarioApi.ajustar(p.id, v.despues - v.antes, motivo), {
        titulo: 'Ajustando stock', texto: p.nombre,
        exito: { titulo: 'Stock ajustado', texto: v.antes + ' → ' + v.despues + ' · ' + motivo },
        error: { titulo: 'No se pudo ajustar', texto: 'El servidor rechazó el ajuste.' },
      })
      .subscribe((inv) => {
        this.s.ponerInventario(inv);
        this.movimientos.set(null);
        this.inventarioApi.movimientos(p.id).subscribe((r) => this.movimientos.set(r.data));
      });
  }

  // TODO(backend): endpoint para «Mejorar con IA», por ejemplo
  // `POST /asistente/productos/descripcion { nombre, categoria, descripcion } → { texto }`.
  // Con él: textarea en solo lectura, escribir `texto` de a 2–4 caracteres
  // cada 24 ms y ofrecer Deshacer / Mantener.
  protected mejorarConIA(): void {
    if (!this.b()?.nombre.trim()) return void this.alertas.mostrar({ estado: 'warning', titulo: 'Escribe primero el nombre' });
    this.alertas.mostrar({ estado: 'info', titulo: 'Mejorar con IA', texto: 'Disponible cuando el Asistente tenga el endpoint de descripciones.' });
  }
}
