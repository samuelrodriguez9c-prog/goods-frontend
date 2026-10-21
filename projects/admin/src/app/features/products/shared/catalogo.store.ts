import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, defer, filter, finalize, firstValueFrom, forkJoin, of, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { Categoria as CategoriaApi, CategoriaService } from '../../../core/categoria/categoria.service';
import { Compra } from '../../../core/compra/models/compra.model';
import { CompraService } from '../../../core/compra/compra.service';
import { Inventario, InventarioService, MovimientoInventario } from '../../../core/inventario/inventario.service';
import { ProductoCatalogo } from '../../../core/producto/models/producto.model';
import { ProductoService } from '../../../core/producto/producto.service';
import { Proveedor, ProveedorPayload } from '../../../core/proveedor/models/proveedor.model';
import { CrearProveedorPayload, ProveedorService } from '../../../core/proveedor/proveedor.service';
import { CambiosEnVivoService } from '../../../core/realtime/cambios-en-vivo.service';
import { AccionAlerta, AlertaService } from '../../../core/ui/alerta.service';
import { codigoCompra, cop, num, pl } from './formato';
import { Categoria, CompraV5, EstadoCompra, LineaCompra, Movimiento, ProductoV5, ProveedorV5, Stock } from './modelos';

/** Tono por categoría principal, en el orden en que se crearon: [fondo, tinta, ícono]. */
const TONOS: [string, string, string][] = [
  ['#fbefd9', '#8a5a00', 'category'],
  ['#fde7ee', '#9d174d', 'category'],
  ['#e3f1fb', '#0369a1', 'category'],
  ['#eeece6', '#57534e', 'category'],
  ['#e6f6ec', '#087b5d', 'category'],
];
const TONO_SIN: [string, string, string] = ['#f1f1f1', '#4b5563', 'category'];

/** Entidades del evento `datos:cambio` que le importan a estas pantallas. */
const ENTIDADES = ['producto', 'inventario', 'categoria', 'proveedor', 'compra'];
/** Un `datos:cambio` que llega dentro de esta ventana es eco de una escritura propia. */
const ECO_PROPIO_MS = 2500;
/** El stepper del mínimo guarda cuando se deja de tocar. */
const ESPERA_MINIMO_MS = 600;

const texto = (v: string | null | undefined) => v ?? '';
const nulo = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * Estado compartido de Categorías, Inventario, Proveedores y Compras.
 * Products tiene su propio `ProductosStore`; los dos leen los mismos
 * endpoints.
 *
 * @remarks
 * - `asegurar()` lo llama cada página al entrar: la primera vez carga con
 *   esqueletos; después refresca en silencio (así lo que se cambió en
 *   Products se ve al volver).
 * - Escrituras optimistas: se ve el cambio al instante, la pila muestra
 *   el resultado y, si el servidor lo rechaza, se vuelve atrás.
 * - Cambios de otros (`datos:cambio`) refrescan solos.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoStore {
  private readonly alertas = inject(AlertaService);
  private readonly auth = inject(AuthService);
  private readonly productosApi = inject(ProductoService);
  private readonly inventarioApi = inject(InventarioService);
  private readonly categoriasApi = inject(CategoriaService);
  private readonly proveedoresApi = inject(ProveedorService);
  private readonly comprasApi = inject(CompraService);

  readonly hoy = signal(new Date());
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  /** Ya hubo una carga completa (las siguientes son silenciosas). */
  readonly cargado = signal(false);

  readonly categorias = signal<Categoria[]>([]);
  readonly productos = signal<ProductoV5[]>([]);
  readonly stock = signal<Stock[]>([]);
  /** Solo los de los productos que se abrieron en Inventario (`cargarMovimientos`). */
  readonly movimientos = signal<Movimiento[]>([]);
  readonly proveedores = signal<ProveedorV5[]>([]);
  readonly compras = signal<CompraV5[]>([]);

  private readonly porId = <T extends { id: number }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
  readonly mapaCategorias = computed(() => this.porId(this.categorias()));
  readonly mapaProductos = computed(() => this.porId(this.productos()));
  readonly mapaProveedores = computed(() => this.porId(this.proveedores()));
  readonly mapaStock = computed(() => new Map(this.stock().map((s) => [s.productoId, s])));
  /** Principales en orden de creación → índice de tono. */
  private readonly ordenRaices = computed(() =>
    new Map(this.categorias().filter((c) => !c.categoriaPadreId).sort((a, b) => a.id - b.id).map((c, i) => [c.id, i])),
  );

  private ultimaEscritura = 0;
  private cargaEnCurso = false;
  private readonly movsCargados = new Set<number>();
  private readonly timersMinimo = new Map<number, ReturnType<typeof setTimeout>>();

  constructor() {
    inject(CambiosEnVivoService)
      .huboCambio(ENTIDADES)
      .pipe(filter(() => this.cargado() && Date.now() - this.ultimaEscrituraPropia() > ECO_PROPIO_MS))
      .subscribe(() => this.refrescar());
  }

  // Carga

  private readonly alCargar: (() => void)[] = [];

  /** Corre `fn` cuando haya datos (ya, si ya cargó). Para abrir `?producto=ID` y similares. */
  alListo(fn: () => void): void {
    if (this.cargado()) queueMicrotask(fn);
    else this.alCargar.push(fn);
  }

  /** Cada página la llama al entrar. */
  asegurar(): void {
    if (this.cargado()) this.refrescar();
    else this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.traerTodo(true);
  }

  private refrescar(): void {
    this.traerTodo(false);
  }

  private traerTodo(conEsqueleto: boolean): void {
    if (this.cargaEnCurso) return;
    this.cargaEnCurso = true;
    // Sin el permiso el backend responde 403: esa parte queda vacía y el resto
    // carga igual. (No se mira `puede()` acá: al recargar la página el perfil
    // puede no haber llegado todavía.)
    const vacio = <T>(o: Observable<T[]>) =>
      o.pipe(catchError((e) => (e instanceof HttpErrorResponse && e.status === 403 ? of([] as T[]) : throwError(() => e))));
    forkJoin({
      productos: this.productosApi.catalogo(),
      inventario: vacio(this.inventarioApi.todo()),
      categorias: this.categoriasApi.listar(),
      proveedores: vacio(this.proveedoresApi.listar()),
      compras: vacio(this.comprasApi.todas()),
    })
      .pipe(finalize(() => (this.cargaEnCurso = false)))
      .subscribe({
        next: (r) => {
          this.hoy.set(new Date());
          this.productos.set(r.productos.map(aProducto));
          this.stock.set(r.inventario.map(aStock));
          this.categorias.set(r.categorias.map(aCategoria));
          this.proveedores.set(r.proveedores.map(aProveedor));
          this.compras.set(r.compras.map(aCompra));
          this.cargado.set(true);
          this.cargando.set(false);
          // Los movimientos abiertos se vuelven a pedir al abrirlos.
          this.movsCargados.clear();
          this.alCargar.splice(0).forEach((fn) => fn());
        },
        error: () => {
          this.cargando.set(false);
          if (conEsqueleto || !this.cargado()) this.error.set('No se pudo cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.');
        },
      });
  }

  /** Movimientos de un producto (Inventario → Movimientos). Una vez por carga. */
  cargarMovimientos(productoId: number): void {
    if (this.movsCargados.has(productoId)) return;
    this.movsCargados.add(productoId);
    this.inventarioApi.movimientos(productoId, 100).subscribe({
      next: (r) =>
        this.movimientos.update((xs) => [...xs.filter((m) => m.productoId !== productoId), ...r.data.map(aMovimiento)]),
      error: () => this.movsCargados.delete(productoId),
    });
  }

  // Lectura

  /** Mismos códigos que `@RequirePermissions` del backend. */
  puede(permiso: string): boolean {
    return !!this.auth.currentUser()?.permisos.includes(permiso);
  }

  /** Devuelve true si NO puede (y avisa). */
  niega(permiso: string): boolean {
    if (this.puede(permiso)) return false;
    this.alertas.mostrar({ estado: 'warning', titulo: 'Necesitas el permiso ' + permiso, texto: 'Pídele al dueño que te lo habilite en Roles y permisos.' });
    return true;
  }

  categoria = (id: number | null) => (id == null ? undefined : this.mapaCategorias().get(id));
  producto = (id: number) => this.mapaProductos().get(id);
  proveedor = (id: number) => this.mapaProveedores().get(id);
  stockDe = (id: number): Stock => this.mapaStock().get(id) ?? { productoId: id, disponible: 0, reservado: 0, minimo: 0, actualizadoEn: this.hoy().toISOString() };
  raiz = (c: Categoria | undefined): Categoria | undefined => (c?.categoriaPadreId ? this.categoria(c.categoriaPadreId) : c);
  /** [fondo, tinta, ícono] de una categoría principal (o "sin categoría"). */
  tono = (raizId: number | null | undefined): [string, string, string] => {
    const i = raizId == null ? undefined : this.ordenRaices().get(raizId);
    return i === undefined ? TONO_SIN : TONOS[i % TONOS.length];
  };
  totalCompra = (c: CompraV5) => c.items.reduce((t, it) => t + it.cantidad * it.precioUnitario, 0);
  unidadesCompra = (c: CompraV5) => c.items.reduce((t, it) => t + it.cantidad, 0);
  /** Días que lleva pendiente. ≥ 7 = "Atrasada". */
  edadCompra = (c: CompraV5) => Math.max(0, Math.floor((this.hoy().getTime() - new Date(c.fecha + 'T09:00:00').getTime()) / 864e5));
  /** Última compra recibida que trajo el producto. */
  ultimaCompraDe = (productoId: number) =>
    this.compras()
      .filter((c) => c.estado === 'recibida' && c.items.some((i) => i.productoId === productoId))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  /** Unidades en compras pendientes. */
  enCamino = (productoId: number) =>
    this.compras()
      .filter((c) => c.estado === 'pendiente')
      .reduce((t, c) => t + c.items.filter((i) => i.productoId === productoId).reduce((u, i) => u + i.cantidad, 0), 0);

  // Categorías

  /** Crea o guarda. Devuelve la categoría como quedó en el servidor (con su id real). */
  async guardarCategoria(c: Categoria, nueva: boolean): Promise<Categoria | null> {
    if (this.niega(nueva ? 'categorias.crear' : 'categorias.editar')) return null;
    const payload = {
      nombre: c.nombre.trim(),
      descripcion: nulo(c.descripcion),
      categoriaPadreId: c.categoriaPadreId,
      imagen: c.imagen,
      activo: c.activo,
    };
    const id = this.alertas.mostrar({ titulo: nueva ? 'Creando categoría' : 'Guardando cambios', texto: payload.nombre });
    try {
      const r = aCategoria(
        await firstValueFrom(this.propia(nueva ? this.categoriasApi.crear(payload) : this.categoriasApi.actualizar(c.id, payload))),
      );
      this.categorias.update((xs) => (nueva ? [...xs, r] : xs.map((x) => (x.id === r.id ? r : x))));
      this.alertas.resolver(id, { estado: 'success', titulo: nueva ? 'Categoría creada' : 'Cambios guardados', texto: r.nombre });
      return r;
    } catch (e) {
      this.alertas.resolver(id, { estado: 'error', titulo: nueva ? 'No se pudo crear' : 'No se pudo guardar', texto: mensaje(e, 'El servidor rechazó el cambio.') });
      return null;
    }
  }

  /** Arrastrar una subcategoría a otra principal (o soltar arriba = principal). */
  moverCategoria(id: number, padreId: number | null): void {
    const c = this.categoria(id);
    if (!c || c.categoriaPadreId === padreId || id === padreId || this.niega('categorias.editar')) return;
    const antes = c.categoriaPadreId;
    const poner = (p: number | null) => this.categorias.update((xs) => xs.map((x) => (x.id === id ? { ...x, categoriaPadreId: p } : x)));
    poner(padreId);
    this.propia(this.categoriasApi.actualizar(id, { categoriaPadreId: padreId })).subscribe({
      next: () =>
        this.alertas.mostrar({
          estado: 'success',
          titulo: padreId ? `Movida a ${this.categoria(padreId)?.nombre}` : 'Ahora es categoría principal',
          texto: c.nombre,
          accion: {
            label: 'Deshacer',
            ejecutar: () => {
              poner(antes);
              this.propia(this.categoriasApi.actualizar(id, { categoriaPadreId: antes })).subscribe({ error: () => poner(padreId) });
            },
          },
        }),
      error: (e) => {
        poner(antes);
        this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo mover', texto: mensaje(e, c.nombre) });
      },
    });
  }

  // Inventario

  /** −1 / +1 del hover y "Ajustar stock" de la hoja. */
  ajustarStock(productoId: number, delta: number, motivo: string, deshacible = true): void {
    if (!delta || this.niega('inventario.editar')) return;
    const s = this.stockDe(productoId);
    if (s.disponible + delta < 0) {
      this.alertas.mostrar({ estado: 'warning', titulo: 'No se puede dejar el stock en negativo', texto: `Hay ${num(s.disponible)} disponibles.` });
      return;
    }
    const p = this.producto(productoId);
    this.aplicarStock(productoId, delta);
    this.propia(this.inventarioApi.ajustar(productoId, delta, motivo)).subscribe({
      next: (inv) => {
        this.ponerStock(aStock(inv));
        this.recargarMovimientos(productoId);
        this.alertas.mostrar({
          estado: 'success',
          titulo: `Stock ${delta > 0 ? '+' : '−'}${Math.abs(delta)}`,
          texto: `${p?.nombre} · ${num(s.disponible)} → ${num(s.disponible + delta)}`,
          accion: deshacible ? { label: 'Deshacer', ejecutar: () => this.ajustarStock(productoId, -delta, `Deshace: ${motivo}`, false) } : undefined,
        });
      },
      error: (e) => {
        this.aplicarStock(productoId, -delta);
        this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo ajustar el stock', texto: mensaje(e, p?.nombre ?? '') });
      },
    });
  }

  /** Stepper del mínimo: se ve al instante y se guarda cuando se deja de tocar. */
  fijarMinimo(productoId: number, minimo: number): void {
    if (this.niega('inventario.editar')) return;
    const valor = Math.max(0, minimo);
    const antes = this.stockDe(productoId).minimo;
    this.stock.update((xs) =>
      xs.some((s) => s.productoId === productoId)
        ? xs.map((s) => (s.productoId === productoId ? { ...s, minimo: valor } : s))
        : [...xs, { ...this.stockDe(productoId), minimo: valor }],
    );
    clearTimeout(this.timersMinimo.get(productoId));
    this.timersMinimo.set(
      productoId,
      setTimeout(() => {
        this.timersMinimo.delete(productoId);
        this.propia(this.inventarioApi.stockMinimo(productoId, valor)).subscribe({
          next: (inv) => this.ponerStock(aStock(inv)),
          error: (e) => {
            this.stock.update((xs) => xs.map((s) => (s.productoId === productoId ? { ...s, minimo: antes } : s)));
            this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo guardar el mínimo', texto: mensaje(e, this.producto(productoId)?.nombre ?? '') });
          },
        });
      }, ESPERA_MINIMO_MS),
    );
  }

  /** Revertir un ajuste manual (Movimientos → detalle → Revertir). */
  revertirMovimiento(m: Movimiento): void {
    if (m.tipo !== 'ajuste') return;
    this.ajustarStock(m.productoId, -m.cantidad, `Revierte: ${m.motivo}`, false);
  }

  private aplicarStock(productoId: number, delta: number): void {
    this.stock.update((xs) =>
      xs.some((s) => s.productoId === productoId)
        ? xs.map((s) => (s.productoId === productoId ? { ...s, disponible: s.disponible + delta, actualizadoEn: new Date().toISOString() } : s))
        : [...xs, { ...this.stockDe(productoId), disponible: delta }],
    );
  }

  private ponerStock(s: Stock): void {
    this.stock.update((xs) => (xs.some((x) => x.productoId === s.productoId) ? xs.map((x) => (x.productoId === s.productoId ? s : x)) : [...xs, s]));
  }

  private recargarMovimientos(productoId: number): void {
    if (!this.movsCargados.has(productoId)) return;
    this.movsCargados.delete(productoId);
    this.cargarMovimientos(productoId);
  }

  // Proveedores

  /**
   * Crea o guarda. Devuelve el proveedor como quedó en el servidor (con su id real).
   * `atributos` solo cuando hay campos propios activos: sin ellos el backend no exige obligatorios.
   */
  async guardarProveedor(
    p: ProveedorV5,
    nuevo: boolean,
    exito: { texto?: string; accion?: (r: ProveedorV5) => AccionAlerta } = {},
    atributos?: ProveedorPayload['atributos'],
  ): Promise<ProveedorV5 | null> {
    if (this.niega(nuevo ? 'proveedores.crear' : 'proveedores.editar')) return null;
    const payload: CrearProveedorPayload = {
      nombre: p.nombre.trim(),
      nit: nulo(p.nit),
      correo: nulo(p.correo),
      telefono: nulo(p.telefono),
      direccion: nulo(p.direccion),
      contactoNombre: nulo(p.contactoNombre),
      notas: nulo(p.notas),
      activo: p.activo,
      diasEntrega: [...p.diasEntrega].sort((a, b) => a - b),
      ...(atributos ? { atributos } : {}),
    };
    const id = this.alertas.mostrar({ titulo: nuevo ? 'Creando proveedor' : 'Guardando cambios', texto: payload.nombre });
    try {
      const r = aProveedor(
        await firstValueFrom(this.propia(nuevo ? this.proveedoresApi.crear(payload) : this.proveedoresApi.actualizar(p.id, payload))),
      );
      this.proveedores.update((xs) => (nuevo ? [...xs, r] : xs.map((x) => (x.id === r.id ? r : x))));
      this.alertas.resolver(id, { estado: 'success', titulo: nuevo ? 'Proveedor creado' : 'Cambios guardados', texto: exito.texto ?? r.nombre, accion: exito.accion?.(r) });
      return r;
    } catch (e) {
      this.alertas.resolver(id, {
        estado: 'error',
        titulo: nuevo ? 'No se pudo crear' : 'No se pudo guardar',
        texto: mensaje(e, 'Revisa el correo: tiene que ser una dirección válida.'),
      });
      return null;
    }
  }

  alternarProveedor(id: number): void {
    const p = this.proveedor(id);
    if (!p) return;
    this.cambiarActivo(id, !p.activo, false);
  }

  /** Desactivar desde el modal de baja (con Deshacer). */
  desactivarProveedor(id: number): void {
    this.cambiarActivo(id, false, true);
  }

  private cambiarActivo(id: number, activo: boolean, conDeshacer: boolean): void {
    const p = this.proveedor(id);
    if (!p || this.niega('proveedores.editar')) return;
    const poner = (v: boolean) => this.proveedores.update((xs) => xs.map((x) => (x.id === id ? { ...x, activo: v } : x)));
    poner(activo);
    this.propia(this.proveedoresApi.actualizar(id, { activo })).subscribe({
      next: () =>
        this.alertas.mostrar({
          estado: 'success',
          titulo: activo ? 'Proveedor activado' : 'Proveedor desactivado',
          texto: activo ? p.nombre : `${p.nombre} ya no aparece al crear compras`,
          accion: conDeshacer ? { label: 'Deshacer', ejecutar: () => this.cambiarActivo(id, !activo, false) } : undefined,
        }),
      error: (e) => {
        poner(!activo);
        this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo cambiar el estado', texto: mensaje(e, p.nombre) });
      },
    });
  }

  /** Solo si no tiene compras (el modal de baja lo garantiza; el backend responde 409 si no). */
  eliminarProveedor(id: number): void {
    const p = this.proveedor(id);
    if (!p || this.niega('proveedores.eliminar')) return;
    const aviso = this.alertas.mostrar({ titulo: 'Eliminando proveedor', texto: p.nombre });
    this.propia(this.proveedoresApi.eliminar(id)).subscribe({
      next: () => {
        this.proveedores.update((xs) => xs.filter((x) => x.id !== id));
        this.alertas.resolver(aviso, { estado: 'success', titulo: 'Proveedor eliminado', texto: p.nombre });
      },
      error: (e) => this.alertas.resolver(aviso, { estado: 'error', titulo: 'No se pudo eliminar', texto: mensaje(e, p.nombre) }),
    });
  }

  // Compras

  /** Crea una compra pendiente. Devuelve la compra con su id real, o null si falló. */
  async crearCompra(
    proveedorId: number,
    items: LineaCompra[],
    notas = '',
    extra: { fecha?: string; numeroFactura?: string | null } = {},
    exito: { accion?: (r: CompraV5) => AccionAlerta } = {},
  ): Promise<CompraV5 | null> {
    if (this.niega('compras.crear')) return null;
    const aviso = this.alertas.mostrar({ titulo: 'Creando compra', texto: this.proveedor(proveedorId)?.nombre });
    try {
      const r = aCompra(
        await firstValueFrom(
          this.propia(
            this.comprasApi.crear({
              proveedorId,
              items,
              ...(notas.trim() ? { notas: notas.trim() } : {}),
              ...(extra.fecha ? { fecha: extra.fecha } : {}),
              ...(extra.numeroFactura?.trim() ? { numeroFactura: extra.numeroFactura.trim() } : {}),
            }),
          ),
        ),
      );
      this.compras.update((xs) => [r, ...xs]);
      this.alertas.resolver(aviso, {
        estado: 'success',
        titulo: `Compra ${codigoCompra(r.id)} creada`,
        texto: `${this.proveedor(proveedorId)?.nombre} · ${cop(this.totalCompra(r))}`,
        accion: exito.accion?.(r),
      });
      return r;
    } catch (e) {
      this.alertas.resolver(aviso, { estado: 'error', titulo: 'No se pudo crear la compra', texto: mensaje(e, 'El servidor rechazó la compra.') });
      return null;
    }
  }

  /** Pendiente: proveedor, fecha, factura, notas y líneas. Recibida/cancelada: solo notas. */
  async guardarCompra(c: CompraV5): Promise<CompraV5 | null> {
    if (this.niega('compras.editar')) return null;
    const pendiente = c.estado === 'pendiente';
    const aviso = this.alertas.mostrar({ titulo: 'Guardando cambios', texto: codigoCompra(c.id) });
    try {
      const r = aCompra(
        await firstValueFrom(
          this.propia(
            this.comprasApi.actualizar(
              c.id,
              pendiente
                ? { proveedorId: c.proveedorId, fecha: c.fecha, numeroFactura: nulo(c.numeroFactura), notas: c.notas, items: c.items }
                : { notas: c.notas },
            ),
          ),
        ),
      );
      this.compras.update((xs) => xs.map((x) => (x.id === r.id ? r : x)));
      this.alertas.resolver(aviso, { estado: 'success', titulo: 'Cambios guardados', texto: codigoCompra(c.id) });
      return r;
    } catch (e) {
      this.alertas.resolver(aviso, { estado: 'error', titulo: 'No se pudo guardar', texto: mensaje(e, codigoCompra(c.id)) });
      return null;
    }
  }

  /** Recibir: entra el stock de todas las líneas y la compra pasa a "Recibida". */
  recibirCompra(id: number): void {
    const c = this.compras().find((x) => x.id === id);
    if (!c || c.estado !== 'pendiente' || this.niega('compras.editar')) return;
    const aviso = this.alertas.mostrar({ titulo: `Recibiendo ${codigoCompra(id)}`, texto: this.proveedor(c.proveedorId)?.nombre });
    this.propia(this.comprasApi.recibir(id)).subscribe({
      next: (r) => {
        this.compras.update((xs) => xs.map((x) => (x.id === id ? aCompra(r) : x)));
        c.items.forEach((it) => {
          this.aplicarStock(it.productoId, it.cantidad);
          this.recargarMovimientos(it.productoId);
        });
        this.alertas.resolver(aviso, {
          estado: 'success',
          titulo: `${codigoCompra(id)} recibida`,
          texto: `Entraron ${pl(this.unidadesCompra(c), 'unidad', 'unidades')} al inventario`,
        });
        // El saldo real (por si alguien más movió stock mientras tanto).
        this.inventarioApi.todo().subscribe((inv) => this.stock.set(inv.map(aStock)));
      },
      error: (e) => this.alertas.resolver(aviso, { estado: 'error', titulo: 'No se pudo recibir', texto: mensaje(e, codigoCompra(id)) }),
    });
  }

  /** Cancelar no se puede deshacer: el motivo queda en las notas. */
  cancelarCompra(id: number, motivo: string): void {
    const c = this.compras().find((x) => x.id === id);
    if (!c || this.niega('compras.editar')) return;
    const aviso = this.alertas.mostrar({ titulo: `Cancelando ${codigoCompra(id)}` });
    this.propia(this.comprasApi.cancelar(id, motivo)).subscribe({
      next: (r) => {
        this.compras.update((xs) => xs.map((x) => (x.id === id ? aCompra(r) : x)));
        this.alertas.resolver(aviso, { estado: 'success', titulo: `${codigoCompra(id)} cancelada`, texto: 'No sumó stock' });
      },
      error: (e) => this.alertas.resolver(aviso, { estado: 'error', titulo: 'No se pudo cancelar', texto: mensaje(e, codigoCompra(id)) }),
    });
  }

  // Interno

  /** Marca la escritura como propia (al salir y al volver) para no tomar su eco como cambio de otro. */
  private propia<T>(obs: Observable<T>): Observable<T> {
    return defer(() => {
      this.ultimaEscritura = Date.now();
      return obs;
    }).pipe(finalize(() => (this.ultimaEscritura = Date.now())));
  }

  private ultimaEscrituraPropia(): number {
    return Math.max(this.ultimaEscritura, this.productosApi.ultimaEscritura, this.inventarioApi.ultimaEscritura);
  }
}

// Del backend al modelo de las pantallas

function aProducto(p: ProductoCatalogo): ProductoV5 {
  return {
    id: p.id,
    sku: p.sku,
    nombre: p.nombre,
    descripcion: texto(p.descripcion),
    categoriaId: p.categoriaId,
    marca: texto(p.marca),
    precio: p.precio,
    precioComparacion: p.precioComparacion,
    costo: p.costo,
    pesoGramos: p.pesoGramos,
    altoCm: p.altoCm,
    anchoCm: p.anchoCm,
    largoCm: p.largoCm,
    slug: texto(p.slug),
    destacado: p.destacado,
    estado: p.estado,
    imagenes: p.imagenes.map((i) => ({ id: i.id, url: i.url, orden: i.orden })),
    creadoEn: p.creadoEn,
    actualizadoEn: p.actualizadoEn,
  };
}

function aStock(i: Inventario): Stock {
  return { productoId: i.productoId, disponible: i.cantidadDisponible, reservado: i.cantidadReservada, minimo: i.stockMinimo, actualizadoEn: i.actualizadoEn };
}

function aCategoria(c: CategoriaApi): Categoria {
  return { id: c.id, nombre: c.nombre, categoriaPadreId: c.categoriaPadreId, descripcion: texto(c.descripcion), imagen: c.imagen ?? null, activo: c.activo };
}

function aProveedor(p: Proveedor): ProveedorV5 {
  return {
    id: p.id,
    nombre: p.nombre,
    nit: texto(p.nit),
    correo: texto(p.correo),
    telefono: texto(p.telefono),
    direccion: texto(p.direccion),
    contactoNombre: texto(p.contactoNombre),
    notas: texto(p.notas),
    activo: p.activo,
    diasEntrega: [...(p.diasEntrega ?? [])].sort((a, b) => a - b),
    atributos: p.atributos ?? {},
  };
}

function aCompra(c: Compra): CompraV5 {
  const archivo = c.archivoUrl ? decodeURIComponent(c.archivoUrl.split(/[?#]/)[0].split('/').pop() ?? '') : null;
  return {
    id: c.id,
    proveedorId: c.proveedorId,
    fecha: String(c.fecha).slice(0, 10),
    numeroFactura: c.numeroFactura,
    archivoUrl: c.archivoUrl,
    archivoNombre: archivo || null,
    notas: texto(c.notas),
    estado: (c.estado as EstadoCompra) ?? 'pendiente',
    items: c.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, precioUnitario: Number(i.precioUnitario) })),
    recibidaEn: c.recibidaEn ?? null,
  };
}

/** Del backend: `cantidad` es positiva en entrada/salida (el tipo da el sentido) y con signo en ajustes. */
function aMovimiento(m: MovimientoInventario): Movimiento {
  const cantidad = m.tipo === 'salida' ? -Math.abs(m.cantidad) : m.tipo === 'entrada' ? Math.abs(m.cantidad) : m.cantidad;
  return {
    id: m.id,
    productoId: m.productoId,
    tipo: m.tipo,
    cantidad,
    motivo: texto(m.motivo),
    referenciaTipo: m.referenciaTipo === 'compra' || m.referenciaTipo === 'pedido' ? m.referenciaTipo : null,
    referenciaId: m.referenciaId,
    creadoEn: m.creadoEn,
  };
}

/** Mensaje del backend (`message`) si lo hay; si no, el de respaldo. */
function mensaje(e: unknown, respaldo: string): string {
  if (e instanceof HttpErrorResponse) {
    const m = e.error?.message;
    if (e.status === 0) return 'Sin conexión con el servidor.';
    if (typeof m === 'string' && m) return m;
    if (Array.isArray(m) && m.length) return String(m[0]);
  }
  return respaldo;
}

