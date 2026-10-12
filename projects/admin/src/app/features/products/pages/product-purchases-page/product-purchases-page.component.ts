import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CompraService } from '../../../../core/compra/compra.service';
import { UploadService } from '../../../../core/upload/upload.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { CatalogoStore } from '../../shared/catalogo.store';
import { esGuardar, vigilarCambios } from '../../shared/cambios-sin-guardar';
import { codigoCompra, cop, dias, fecha, hace, norm, num, pl } from '../../shared/formato';
import { CEST, CompraV5, ProveedorV5 } from '../../shared/modelos';
import { ATRASO, MES_LARGO, inicialesDe, tonoProveedor } from '../../shared/proveedores.util';
import { EstadoPaginaComponent } from '../../shared/ui/estado-pagina.component';
import { FranjaMetricasComponent, MetricaFranja } from '../../shared/ui/franja-metricas.component';
import { icono } from '../../shared/ui/iconos';
import { ModuloCabeceraComponent } from '../../shared/ui/modulo-cabecera.component';
import { PestanaHojaV5, PestanasHojaComponent } from '../../shared/ui/pestanas-hoja.component';
import { GlifoAsistenteComponent } from './components/asistente.component';
import { BloqueoRecibir } from './components/boton-mantener.component';
import { FiltrosComprasComponent } from './components/filtros-compras.component';
import { FilaCompra, FilaCompraComponent } from './components/fila-compra.component';
import { GrupoCompras, GrupoComprasComponent } from './components/grupo-compras.component';
import { MarcoModalComponent } from './components/marco-modal.component';
import { MenuListaComponent } from './components/menu-lista.component';
import { ModalFacturaComponent } from './components/modal-factura.component';
import { ModalRecibirComponent } from './components/modal-recibir.component';
import { CambioCampo, PestanaDatosComponent } from './components/pestana-datos.component';
import { PestanaActividadComponent } from './components/pestana-actividad.component';
import { CambioLinea, PestanaLineasComponent } from './components/pestana-lineas.component';
import { SeguimientoCompraComponent } from './components/seguimiento-compra.component';
import {
  AGRUPACIONES, AVATAR_CANCELADA, Agrupacion, Borrador, CHIP_ESTADO, ETIQUETAS, FILTRO_METRICA, FichaCompra, FiltroDocumento,
  MenuCompras, Metrica, ModalCompras, ORDENES, Orden, PestanaCompra, Periodo, RangoFecha, clonar, iguales, inicioDia, lineaVacia, soloDigitos,
  ymd,
} from './compras.modelo';

/** Duración de cada período de la franja (ms). */
const VENTANA: Record<Periodo, number> = { hoy: 864e5, '7': 7 * 864e5, '30': 30 * 864e5 };

/**
 * Compras (Productos v5): cabecera, franja de métricas, lista agrupada y la hoja
 * de la compra (Líneas · Datos · Actividad). Una compra pendiente se edita como
 * borrador ("Cambios sin guardar") y el stock entra solo al marcarla recibida.
 */
@Component({
  selector: 'app-product-purchases-page',
  standalone: true,
  imports: [
    TablerIconComponent, ModuloCabeceraComponent, FranjaMetricasComponent, EstadoPaginaComponent, PestanasHojaComponent,
    MenuListaComponent, FiltrosComprasComponent, GrupoComprasComponent, FilaCompraComponent, SeguimientoCompraComponent,
    PestanaLineasComponent, PestanaDatosComponent, PestanaActividadComponent, MarcoModalComponent, ModalRecibirComponent,
    ModalFacturaComponent, GlifoAsistenteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-purchases-page.component.html',
  host: {
    class: 'flex h-full min-h-0 flex-col font-[Inter,system-ui,sans-serif] leading-[normal] [&_tabler-icon]:inline-flex [&_tabler-icon]:shrink-0 [&_tabler-icon]:leading-none [&_:where(input,textarea)]:text-[#111827] [&_:is(input,textarea)::placeholder]:text-[#9ca3af] [&_input[type=date]::-webkit-calendar-picker-indicator]:cursor-pointer',
    '(click)': 'menu.set(null)',
    '(document:keydown)': 'atajos($event)',
  },
})
export class ProductPurchasesPageComponent {
  protected readonly catalogo = inject(CatalogoStore);
  private readonly alertas = inject(AlertaService);
  private readonly router = inject(Router);
  private readonly comprasApi = inject(CompraService);
  private readonly upload = inject(UploadService);

  protected readonly icono = icono;
  protected readonly num = num;
  protected readonly pl = pl;
  protected readonly codigo = codigoCompra;
  protected readonly ordenes = ORDENES;
  protected readonly agrupaciones = AGRUPACIONES;
  protected readonly chipEstado = CHIP_ESTADO;
  protected readonly avatarCancelada = AVATAR_CANCELADA;

  private readonly franja = viewChild(FranjaMetricasComponent);
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');

  // ── Estado de la lista ──
  protected readonly menu = signal<MenuCompras>(null);
  protected readonly periodo = signal<Periodo>('hoy');
  protected readonly busqueda = signal('');
  protected readonly metrica = signal<Metrica | null>(null);
  protected readonly agrupacion = signal<Agrupacion>('estado');
  protected readonly orden = signal<Orden>('fecha');
  protected readonly filtroProveedor = signal<number | null>(null);
  protected readonly filtroRango = signal<RangoFecha>('todo');
  protected readonly filtroDocumento = signal<FiltroDocumento>('todos');
  /** Grupos plegados, por clave. */
  protected readonly plegados = signal<Record<string, boolean>>({});

  // ── Estado de la hoja ──
  protected readonly seleccion = signal<number | 'nueva' | null>(null);
  protected readonly pestana = signal<PestanaCompra>('lineas');
  protected readonly borrador = signal<Borrador | null>(null);
  protected readonly guardado = signal<Borrador | null>(null);
  /** Ya se intentó guardar: se marcan los errores. */
  protected readonly intento = signal(false);
  /** La hoja ocupa toda la pantalla (sin cabecera ni lista). */
  protected readonly expandida = signal(false);
  /** Líneas marcadas como "llegó completa" en la recepción. */
  protected readonly revisadas = signal<Record<number, boolean>>({});
  /** Evento desplegado en la historia (Actividad). */
  protected readonly eventoAbierto = signal<string | null>(null);
  protected readonly modal = signal<ModalCompras>(null);
  private readonly guardando = signal(false);
  /** Archivo elegido en "Adjuntar factura" (se sube al guardar). */
  private archivoNuevo: File | null = null;

  // ── Datos ──
  protected readonly puedeEditar = computed(() => this.catalogo.puede('compras.editar'));
  protected readonly puedeCrear = computed(() => this.catalogo.puede('compras.crear'));
  private readonly hoy = computed(() => this.catalogo.hoy());
  private readonly edad = (c: CompraV5) => dias(c.fecha, this.hoy());
  private readonly proveedor = (id: number | null | undefined) => (id ? this.catalogo.proveedor(id) : undefined);
  private readonly nombreProducto = (id: number) => this.catalogo.producto(id)?.nombre ?? '?';
  private readonly total = (cs: CompraV5[]) => cs.reduce((a, c) => a + this.catalogo.totalCompra(c), 0);

  protected readonly carga = computed<'cargando' | 'error' | 'vacio' | 'lista' | null>(() => {
    const c = this.catalogo;
    if (!c.cargado()) return c.cargando() ? 'cargando' : c.error() ? 'error' : null;
    return c.compras().length === 0 && this.seleccion() !== 'nueva' ? 'vacio' : 'lista';
  });
  /** Error o vacío: solo la tarjeta de estado, sin lista ni hoja. */
  protected readonly soloEstado = computed(() => this.carga() === 'error' || this.carga() === 'vacio');

  // ── Cabecera y métricas ──
  protected readonly lectura = computed(() => {
    if (!this.catalogo.cargado()) return '';
    const cs = this.catalogo.compras(), pendientes = cs.filter((c) => c.estado === 'pendiente');
    const recibidasMes = cs.filter((c) => c.estado === 'recibida' && c.recibidaEn && this.hoy().getTime() - new Date(c.recibidaEn).getTime() < 30 * 864e5);
    const masVieja = pendientes.slice().sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    return pl(pendientes.length, 'compra pendiente', 'compras pendientes') + ' por ' + cop(this.total(pendientes))
      + (masVieja ? '; la de «' + (this.proveedor(masVieja.proveedorId)?.nombre ?? '—') + '» lleva ' + pl(this.edad(masVieja), 'día', 'días') + ' sin recibir' : '')
      + '. En el último mes recibiste ' + pl(recibidasMes.length, 'compra', 'compras') + '. El stock solo entra al marcarlas como recibidas.';
  });

  /** 12 puntos a lo largo del período: cómo estaba la métrica en cada instante (viewBox 64×22). */
  private serie(valorEn: (t: number) => number): string {
    const ventana = VENTANA[this.periodo()], fin = this.hoy().getTime();
    const vs = Array.from({ length: 12 }, (_, i) => valorEn(fin - ventana + (ventana * i) / 11));
    const max = Math.max(...vs), min = Math.min(...vs);
    return vs.map((v, i) => {
      const n = max > min ? 0.1 + ((v - min) / (max - min)) * 0.8 : max > 0 ? 0.5 : 0.05;
      return (i * (62 / 11) + 1).toFixed(1) + ',' + (20 - n * 18).toFixed(1);
    }).join(' ');
  }
  protected readonly metricas = computed<MetricaFranja[]>(() => {
    const cs = this.catalogo.compras(), activa = this.metrica();
    const pendientes = cs.filter((c) => c.estado === 'pendiente'), atrasadas = pendientes.filter((c) => this.edad(c) >= ATRASO);
    const recibidas30 = cs.filter((c) => c.estado === 'recibida' && this.edad(c) < 30), canceladas = cs.filter((c) => c.estado === 'cancelada');
    const recibidaEn = (c: CompraV5) => (c.recibidaEn ? new Date(c.recibidaEn).getTime() : Infinity);
    const pendientesEn = (t: number) => cs.filter((c) => c.estado !== 'cancelada' && inicioDia(c.fecha) <= t && recibidaEn(c) > t);
    const metrica = (k: Metrica, label: string, value: string, delta: string, sparkColor: string, tinta: string, spark: string): MetricaFranja =>
      ({ k, label, value, delta, sparkColor, tinta, spark, activa: activa === k });
    return [
      metrica('pendiente', 'Pendientes', String(pendientes.length), 'el stock entra al recibir', '#ffb904', pendientes.length ? '#8a5a00' : '#303030',
        this.serie((t) => pendientesEn(t).length)),
      metrica('valor', 'Por recibir', cop(this.total(pendientes)), 'valor de las pendientes', '#303030', '#303030',
        this.serie((t) => this.total(pendientesEn(t)))),
      metrica('tarde', 'Atrasadas', String(atrasadas.length), ATRASO + ' días o más', '#d82c0d', atrasadas.length ? '#b42318' : '#303030',
        this.serie((t) => pendientesEn(t).filter((c) => t - inicioDia(c.fecha) >= ATRASO * 864e5).length)),
      metrica('recibida', 'Recibidas en 30 días', String(recibidas30.length), cop(this.total(recibidas30)), '#087b5d', '#303030',
        this.serie((t) => cs.filter((c) => recibidaEn(c) <= t && t - recibidaEn(c) < 30 * 864e5).length)),
      metrica('cancelada', 'Canceladas', String(canceladas.length), 'no suman stock', '#9ca3af', '#303030',
        this.serie((t) => canceladas.filter((c) => inicioDia(c.fecha) <= t).length)),
    ];
  });

  // ── Lista ──
  private coincide(c: CompraV5): boolean {
    const m = this.metrica(), q = norm(this.busqueda().trim()), edad = this.edad(c);
    if (q && ![codigoCompra(c.id), c.numeroFactura, this.proveedor(c.proveedorId)?.nombre, ...c.items.map((it) => this.nombreProducto(it.productoId))].some((v) => norm(v).includes(q))) return false;
    if (this.filtroProveedor() != null && c.proveedorId !== this.filtroProveedor()) return false;
    if (this.filtroRango() !== 'todo' && edad >= +this.filtroRango()) return false;
    if (this.filtroDocumento() === 'con' && !c.archivoNombre) return false;
    if (this.filtroDocumento() === 'sin' && c.archivoNombre) return false;
    if (m === 'pendiente' || m === 'valor') return c.estado === 'pendiente';
    if (m === 'tarde') return c.estado === 'pendiente' && edad >= ATRASO;
    if (m === 'recibida') return c.estado === 'recibida' && edad < 30;
    if (m === 'cancelada') return c.estado === 'cancelada';
    return true;
  }
  private fila(c: CompraV5): FilaCompra {
    const p = this.proveedor(c.proveedorId), edad = this.edad(c);
    return {
      id: c.id,
      proveedor: p?.nombre ?? '—',
      iniciales: inicialesDe(p?.nombre ?? ''),
      tono: tonoProveedor(p?.id ?? 0),
      estado: c.estado,
      detalle: codigoCompra(c.id) + ' · ' + (c.numeroFactura || 'sin factura') + ' · ' + pl(c.items.length, 'línea', 'líneas') + ', ' + num(this.catalogo.unidadesCompra(c)) + ' u',
      conFactura: !!c.archivoNombre,
      total: cop(this.catalogo.totalCompra(c)),
      edad: c.estado === 'pendiente'
        ? (edad === 0 ? 'hoy' : 'hace ' + edad + ' d')
        : c.estado === 'recibida' ? 'recibida ' + hace(c.recibidaEn ?? c.fecha, this.hoy()) : 'cancelada',
      atrasada: c.estado === 'pendiente' && edad >= ATRASO,
    };
  }
  protected readonly grupos = computed<GrupoCompras[]>(() => {
    const por = this.agrupacion(), plegados = this.plegados(), nombre = (c: CompraV5) => this.proveedor(c.proveedorId)?.nombre ?? '';
    const comparar: Record<Orden, (a: CompraV5, b: CompraV5) => number> = {
      fecha: (a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id,
      total: (a, b) => this.catalogo.totalCompra(b) - this.catalogo.totalCompra(a),
      proveedor: (a, b) => nombre(a).localeCompare(nombre(b), 'es'),
      edad: (a, b) => a.fecha.localeCompare(b.fecha),
    };
    const lista = this.catalogo.compras().filter((c) => this.coincide(c)).sort(comparar[this.orden()]);
    const suma = (cs: CompraV5[]) => cop(this.total(cs));
    const grupo = (clave: string, titulo: string, icono: string, [fondo, tinta]: string[], cs: CompraV5[], detalle?: string): GrupoCompras => ({
      clave, titulo, icono, fondo, tinta, detalle: detalle ?? suma(cs), filas: cs.map((c) => this.fila(c)), abierto: !plegados[clave],
    });

    if (por === 'proveedor') {
      const porProveedor = new Map<number, CompraV5[]>();
      lista.forEach((c) => porProveedor.set(c.proveedorId, [...(porProveedor.get(c.proveedorId) ?? []), c]));
      return [...porProveedor.entries()]
        .map(([id, cs]) => {
          const pendientes = cs.filter((c) => c.estado === 'pendiente').length;
          return grupo('p-' + id, this.proveedor(id)?.nombre ?? '—', 'truck', tonoProveedor(id), cs,
            suma(cs.filter((c) => c.estado === 'recibida')) + ' recibido' + (pendientes ? ' · ' + pl(pendientes, 'pendiente', 'pendientes') : ''));
        })
        .sort((a, b) => b.filas.length - a.filas.length);
    }
    if (por === 'mes') {
      const porMes = new Map<string, CompraV5[]>();
      lista.forEach((c) => porMes.set(c.fecha.slice(0, 7), [...(porMes.get(c.fecha.slice(0, 7)) ?? []), c]));
      return [...porMes.keys()].sort().reverse().map((mes) => {
        const cs = porMes.get(mes)!;
        return grupo('m-' + mes, MES_LARGO[+mes.slice(5, 7) - 1] + ' ' + mes.slice(0, 4), 'calendar', ['#f1f1f1', '#4b5563'], cs,
          suma(cs.filter((c) => c.estado !== 'cancelada')) + ' · ' + pl(cs.length, 'compra', 'compras'));
      });
    }
    const pendientes = lista.filter((c) => c.estado === 'pendiente');
    const atrasadas = pendientes.filter((c) => this.edad(c) >= ATRASO), aTiempo = pendientes.filter((c) => this.edad(c) < ATRASO);
    return [
      grupo('e-tarde', 'Atrasadas', 'alarm', ['#fff1f0', '#b42318'], atrasadas, suma(atrasadas) + ' · ' + ATRASO + ' días o más sin recibir'),
      grupo('e-pend', 'Pendientes', 'clock', ['#fff6d1', '#8a5a00'], aTiempo, suma(aTiempo) + ' por recibir'),
      grupo('e-rec', 'Recibidas', 'circle-check', ['#e6f6ec', '#087b5d'], lista.filter((c) => c.estado === 'recibida')),
      grupo('e-can', 'Canceladas', 'circle-x', ['#f1f1f1', '#6b7280'], lista.filter((c) => c.estado === 'cancelada'), 'No sumaron stock'),
    ].filter((g) => g.filas.length);
  });
  /** Ids en el orden de la lista (solo grupos abiertos): para ↑ ↓. */
  private readonly idsVisibles = computed(() => this.grupos().flatMap((g) => (g.abierto ? g.filas.map((f) => f.id) : [])));
  protected readonly cuentaVisibles = computed(() => pl(this.grupos().reduce((a, g) => a + g.filas.length, 0), 'compra', 'compras'));

  /** Chips de los filtros activos (con su botón para quitarlos). */
  protected readonly chips = computed(() => {
    const chips: { clave: 'metrica' | 'busqueda' | 'proveedor' | 'rango' | 'documento'; label: string }[] = [], m = this.metrica();
    if (m) chips.push({ clave: 'metrica', label: FILTRO_METRICA[m] });
    if (this.busqueda()) chips.push({ clave: 'busqueda', label: '«' + this.busqueda() + '»' });
    if (this.filtroProveedor() != null) chips.push({ clave: 'proveedor', label: this.proveedor(this.filtroProveedor())?.nombre ?? '—' });
    if (this.filtroRango() !== 'todo') chips.push({ clave: 'rango', label: 'Últimos ' + this.filtroRango() + ' días' });
    if (this.filtroDocumento() !== 'todos') chips.push({ clave: 'documento', label: this.filtroDocumento() === 'con' ? 'Con factura' : 'Sin factura' });
    return chips;
  });
  /** Hay filtros del popover activos (punto turquesa). */
  protected readonly conFiltros = computed(() => this.filtroProveedor() != null || this.filtroRango() !== 'todo' || this.filtroDocumento() !== 'todos');
  protected readonly opcionesProveedor = computed(() => [
    { id: null, nombre: 'Todos los proveedores' },
    ...[...new Set(this.catalogo.compras().map((c) => c.proveedorId))].map((id) => ({ id: id as number | null, nombre: this.proveedor(id)?.nombre ?? '—' })),
  ]);
  protected readonly tituloOrden = computed(() => 'Ordenar: ' + ORDENES.find((o) => o.k === this.orden())!.titulo);

  // ── Hoja ──
  protected readonly esNueva = computed(() => this.seleccion() === 'nueva');
  protected readonly compra = computed(() => {
    const id = this.seleccion();
    return typeof id === 'number' ? this.catalogo.compras().find((c) => c.id === id) ?? null : null;
  });
  /** Se edita como formulario: nueva, o pendiente con permiso (el efecto crea el borrador). */
  protected readonly formulario = computed(() => !!this.borrador() && (this.esNueva() || this.compra()?.estado === 'pendiente'));
  protected readonly sucio = computed(() => this.formulario() && !iguales(this.borrador(), this.guardado()));
  protected readonly soloLectura = computed(() => (this.esNueva() ? !this.puedeCrear() : !this.puedeEditar()));

  private validar(d: Borrador): Record<string, string | number> {
    const e: Record<string, string | number> = {};
    if (!d.proveedorId) e['prov'] = 'Elige o crea el proveedor.';
    if (!d.items.length) e['items'] = 'Agrega al menos una línea.';
    d.items.forEach((it, k) => {
      if (!it.productoId) e['p' + k] = 1;
      if (!(+it.cantidad > 0)) e['q' + k] = 1;
    });
    return e;
  }
  protected readonly errores = computed(() => (this.borrador() ? this.validar(this.borrador()!) : {}));

  protected readonly ficha = computed<FichaCompra | null>(() => {
    const esNueva = this.esNueva(), c = this.compra(), d = this.borrador(), formulario = this.formulario();
    if (this.soloEstado() || (!esNueva && !c)) return null;
    const estado = esNueva ? 'pendiente' : c!.estado;
    const items = formulario
      ? d!.items.filter((it) => it.productoId).map((it) => ({ productoId: it.productoId!, cantidad: +it.cantidad || 0, precioUnitario: +soloDigitos(it.precioUnitario) || 0 }))
      : c!.items;
    const diasCompra = esNueva ? 0 : this.edad(c!);
    return {
      esNueva, compra: c, borrador: d, formulario, estado, items,
      proveedor: this.proveedor(formulario ? d!.proveedorId : c!.proveedorId) ?? null,
      dias: diasCompra,
      atrasada: estado === 'pendiente' && diasCompra >= ATRASO,
      total: items.reduce((a, it) => a + it.cantidad * it.precioUnitario, 0),
      unidades: items.reduce((a, it) => a + it.cantidad, 0),
      fecha: formulario ? d!.fecha : c!.fecha,
      numero: (formulario ? d!.numeroFactura : c!.numeroFactura) || '',
      notas: (formulario ? d!.notas : c!.notas) || '',
    };
  });
  protected readonly completa = computed(() => !!this.ficha() && this.expandida());

  /** Textos de la cabecera de la hoja. */
  protected readonly cabecera = computed(() => {
    const f = this.ficha()!, c = f.compra, p = f.proveedor;
    return {
      etiqueta: f.esNueva ? 'Nueva compra' : 'Compra · ' + codigoCompra(c!.id),
      iniciales: p ? inicialesDe(p.nombre) : '?',
      /** Tono del proveedor (sin proveedor o cancelada: gris). */
      tono: p && f.estado !== 'cancelada' ? tonoProveedor(p.id) : null,
      titulo: p ? p.nombre : 'Sin proveedor',
      detalle: (f.esNueva ? 'Sin guardar' : codigoCompra(c!.id)) + ' · ' + (f.numero || 'sin N° de factura') + ' · ' + fecha(f.fecha),
      total: cop(f.total),
      cantidades: pl(f.unidades, 'unidad', 'unidades') + ' · ' + pl(f.items.length, 'línea', 'líneas'),
      estado: CEST[f.estado].t,
      archivo: !f.esNueva ? c!.archivoNombre : null,
      candado: f.formulario || !c
        ? ''
        : c.estado === 'recibida' ? 'Recibida el ' + fecha(c.recibidaEn ?? c.fecha) + ' · el stock ya entró. Queda en solo lectura.'
          : c.estado === 'cancelada' ? 'Cancelada · no sumó stock. Queda en solo lectura.'
            : 'Solo lectura · necesitas el permiso compras.editar para recibirla o cancelarla.',
    };
  });
  /** Posición en la lista para ↑ ↓ (solo si hay más de una visible). */
  protected readonly navegacion = computed(() => {
    const ids = this.idsVisibles(), posicion = this.esNueva() ? -1 : ids.indexOf(this.seleccion() as number);
    return posicion >= 0 && ids.length > 1 ? { posicion, total: ids.length } : null;
  });
  protected readonly pestanas = computed<PestanaHojaV5[]>(() => {
    const d = this.borrador(), conErrores = this.formulario() && this.intento();
    return [
      {
        k: 'lineas', label: 'Líneas', n: String(this.formulario() ? d!.items.length : this.compra()?.items.length ?? 0),
        err: conErrores && d!.items.some((it) => !it.productoId || !(+it.cantidad > 0)),
      },
      { k: 'datos', label: 'Datos', err: conErrores && !d!.proveedorId },
      { k: 'actividad', label: 'Actividad' },
    ];
  });
  protected readonly bloqueoRecibir = computed<BloqueoRecibir>(() => (this.sucio() ? 'sucio' : !this.puedeEditar() ? 'permiso' : null));

  // ── Modales ──
  /** Compra del modal Recibir / Cancelar. */
  protected readonly compraModal = computed(() => {
    const m = this.modal();
    return m?.tipo === 'recibir' || m?.tipo === 'cancelar' ? this.catalogo.compras().find((c) => c.id === m.id) ?? null : null;
  });

  constructor() {
    // La alerta "Cambios sin guardar" solo cuando de verdad hay cambios.
    vigilarCambios({
      borrador: computed(() => (this.sucio() ? this.borrador() : null)),
      guardado: this.guardado,
      etiquetas: ETIQUETAS,
      nuevo: () => this.esNueva(),
      tituloNuevo: 'Compra sin guardar',
      textoNuevo: 'Todavía no se ha creado. Guárdala como pendiente; el stock entra cuando la recibas. Atajo: Ctrl + S.',
      guardar: () => this.guardar(),
      descartar: () => this.descartar(),
      invalido: () => {
        const e = this.errores();
        if (!this.intento()) return null;
        if (e['prov']) return { titulo: 'Faltan datos', texto: String(e['prov']) };
        return Object.keys(e).length ? { titulo: 'Faltan datos', texto: 'Hay líneas sin producto o sin cantidad.' } : null;
      },
    });
    // Una pendiente editable se abre como formulario; si cambia de estado (recibida, cancelada,
    // o la cambió alguien más) el borrador sigue a la compra mientras no haya cambios propios.
    effect(() => {
      const c = this.compra();
      const editable = !!c && c.estado === 'pendiente' && this.puedeEditar();
      untracked(() => {
        if (this.esNueva()) return;
        if (!editable) {
          if (this.borrador()) {
            this.borrador.set(null);
            this.guardado.set(null);
            this.intento.set(false);
          }
          return;
        }
        const d = this.aBorrador(c!);
        if (!this.borrador() || (!this.sucio() && !iguales(d, this.guardado()))) {
          this.borrador.set(d);
          this.guardado.set(clonar(d));
        }
      });
    });
    // Un popover a la vez: al abrir el del período se cierran los de la página.
    effect(() => {
      if (this.franja()?.abierto()) untracked(() => this.menu.set(null));
    });
    this.catalogo.asegurar();
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    const id = Number(params.get('compra')), proveedorId = Number(params.get('proveedor'));
    this.catalogo.alListo(() => {
      if (id) this.abrir(id);
      else if (params.get('nueva')) this.nueva(proveedorId || null);
    });
    inject(DestroyRef).onDestroy(() => this.alertas.soltarCambios());
  }

  // ── Borrador ──
  private vacio(proveedorId: number | null = null): Borrador {
    return {
      proveedorId, busquedaProveedor: this.proveedor(proveedorId)?.nombre ?? '', fecha: ymd(this.hoy()), numeroFactura: '', archivo: null, notas: '',
      items: [lineaVacia()], ia: {},
    };
  }
  private aBorrador(c: CompraV5): Borrador {
    return {
      proveedorId: c.proveedorId,
      busquedaProveedor: this.proveedor(c.proveedorId)?.nombre ?? '',
      fecha: c.fecha,
      numeroFactura: c.numeroFactura ?? '',
      archivo: c.archivoUrl ? { name: c.archivoNombre ?? 'Factura', url: c.archivoUrl } : null,
      notas: c.notas || '',
      items: c.items.map((it) => ({ ...lineaVacia(), productoId: it.productoId, busqueda: this.nombreProducto(it.productoId), cantidad: String(it.cantidad), precioUnitario: String(it.precioUnitario) })),
      ia: {},
    };
  }
  private cambiarBorrador(cambio: (d: Borrador) => Borrador): void {
    this.borrador.update((d) => (d ? cambio(d) : d));
  }
  protected cambiarCampo({ campo, valor }: CambioCampo): void {
    this.cambiarBorrador((d) => ({ ...d, [campo]: valor, ia: { ...d.ia, [campo]: false } }));
  }
  protected cambiarLinea({ k, cambio }: CambioLinea): void {
    this.cambiarBorrador((d) => ({ ...d, items: d.items.map((it, i) => (i === k ? { ...it, ...cambio } : it)) }));
  }
  protected agregarLinea(): void {
    this.cambiarBorrador((d) => ({ ...d, items: [...d.items, lineaVacia()] }));
  }
  protected quitarLinea(k: number): void {
    this.cambiarBorrador((d) => ({ ...d, items: d.items.filter((_, i) => i !== k) }));
  }
  protected buscarProveedor(texto: string): void {
    this.cambiarBorrador((d) => ({ ...d, busquedaProveedor: texto, proveedorId: null, ia: { ...d.ia, proveedor: false } }));
  }
  protected elegirProveedor(p: ProveedorV5): void {
    this.cambiarBorrador((d) => ({ ...d, proveedorId: p.id, busquedaProveedor: p.nombre, ia: { ...d.ia, proveedor: false } }));
  }
  protected async crearProveedor(nombre: string): Promise<void> {
    const p = await this.catalogo.guardarProveedor(
      { id: 0, nombre, nit: '', correo: '', telefono: '', direccion: '', contactoNombre: '', notas: '', activo: true, diasEntrega: [] },
      true,
      { texto: 'Proveedor «' + nombre + '» creado · completa sus datos en Proveedores' },
    );
    if (p) this.elegirProveedor(p);
  }
  protected adjuntar(archivo: File): void {
    this.archivoNuevo = archivo;
    this.cambiarBorrador((d) => ({ ...d, archivo: { name: archivo.name, url: URL.createObjectURL(archivo) }, ia: { ...d.ia, archivo: false } }));
  }
  protected quitarArchivo(): void {
    this.archivoNuevo = null;
    this.cambiarBorrador((d) => ({ ...d, archivo: null, ia: { ...d.ia, archivo: false } }));
  }

  // ── Selección y navegación ──
  protected abrir(id: number): void {
    if (this.seleccion() === id) return;
    if (this.sucio()) return this.alertas.sacudir();
    this.archivoNuevo = null;
    this.borrador.set(null);
    this.guardado.set(null);
    this.intento.set(false);
    this.revisadas.set({});
    this.eventoAbierto.set(null);
    this.menu.set(null);
    this.seleccion.set(id);
  }
  protected nueva(proveedorId: number | null = null): boolean {
    if (this.catalogo.niega('compras.crear')) return false;
    if (this.sucio()) {
      this.alertas.sacudir();
      return false;
    }
    const d = this.vacio(proveedorId);
    this.archivoNuevo = null;
    this.seleccion.set('nueva');
    this.borrador.set(d);
    this.guardado.set(clonar(d));
    this.intento.set(false);
    this.revisadas.set({});
    return true;
  }
  protected cerrar(): void {
    if (this.sucio()) return this.alertas.sacudir();
    this.expandida.set(false);
    this.seleccion.set(null);
    this.borrador.set(null);
    this.guardado.set(null);
    this.menu.set(null);
  }
  private descartar(): void {
    this.archivoNuevo = null;
    if (this.esNueva()) {
      this.seleccion.set(null);
      this.borrador.set(null);
      this.guardado.set(null);
      this.expandida.set(false);
    } else this.borrador.set(clonar(this.guardado()));
    this.intento.set(false);
  }
  protected mover(d: number): void {
    const ids = this.idsVisibles();
    if (!ids.length) return;
    const i = ids.indexOf(this.seleccion() as number);
    const siguiente = i < 0 ? ids[d > 0 ? 0 : ids.length - 1] : ids[Math.min(ids.length - 1, Math.max(0, i + d))];
    if (siguiente != null && siguiente !== this.seleccion()) this.abrir(siguiente);
  }
  protected verProveedor(): void {
    const p = this.ficha()?.proveedor;
    this.menu.set(null);
    if (!p) return;
    if (this.sucio()) return this.alertas.sacudir();
    this.router.navigate(['/products/proveedores'], { queryParams: { proveedor: p.id } });
  }
  protected verProducto(id: number): void {
    if (this.sucio()) return this.alertas.sacudir();
    this.router.navigate(['/products/inventario'], { queryParams: { producto: id } });
  }

  // ── Guardar ──
  protected async guardar(): Promise<void> {
    const d = this.borrador(), esNueva = this.esNueva();
    if (!d || this.guardando()) return;
    if (this.catalogo.niega(esNueva ? 'compras.crear' : 'compras.editar')) return;
    const e = this.validar(d);
    if (Object.keys(e).length) {
      this.intento.set(true);
      this.alertas.mostrar({ estado: 'warning', titulo: e['prov'] ? String(e['prov']) : 'Hay líneas sin producto o sin cantidad' });
      return this.alertas.sacudir();
    }
    const items = d.items.map((it) => ({ productoId: it.productoId!, cantidad: +it.cantidad, precioUnitario: +soloDigitos(it.precioUnitario) || 0 }));
    this.guardando.set(true);
    try {
      let c = esNueva
        ? await this.catalogo.crearCompra(d.proveedorId!, items, d.notas, { fecha: d.fecha, numeroFactura: d.numeroFactura })
        : await this.catalogo.guardarCompra({ ...this.compra()!, proveedorId: d.proveedorId!, fecha: d.fecha, numeroFactura: d.numeroFactura.trim() || null, notas: d.notas, items });
      if (!c) return; // el error ya está en la pila; el borrador queda para corregir
      c = await this.guardarArchivo(c, d);
      const nuevo = this.aBorrador(c);
      this.archivoNuevo = null;
      this.intento.set(false);
      this.borrador.set(nuevo);
      this.guardado.set(clonar(nuevo));
      this.seleccion.set(c.id);
      // Que recargar no vuelva a abrir "nueva compra" (?nueva=1).
      if (esNueva) this.router.navigate([], { queryParams: { compra: c.id }, replaceUrl: true });
    } finally {
      this.guardando.set(false);
    }
  }
  /** La factura adjunta: se sube a `/upload` y se guarda con `PATCH /compras/:id { archivoUrl }`. */
  private async guardarArchivo(c: CompraV5, d: Borrador): Promise<CompraV5> {
    const quiere = d.archivo ? (this.archivoNuevo ? 'nuevo' : d.archivo.url) : null;
    if (quiere === c.archivoUrl || (!quiere && !c.archivoUrl)) return c;
    const aviso = this.alertas.mostrar({ titulo: quiere ? 'Adjuntando la factura' : 'Quitando la factura', texto: d.archivo?.name ?? codigoCompra(c.id) });
    try {
      const url = quiere === 'nuevo' ? (await firstValueFrom(this.upload.subir(this.archivoNuevo!))).url : quiere;
      const r = await firstValueFrom(this.comprasApi.actualizar(c.id, { archivoUrl: url }));
      const archivoUrl = r.archivoUrl ?? null;
      const archivoNombre = archivoUrl ? decodeURIComponent(archivoUrl.split(/[?#]/)[0].split('/').pop() ?? '') || null : null;
      const actualizada: CompraV5 = { ...c, archivoUrl, archivoNombre };
      this.catalogo.compras.update((cs) => cs.map((x) => (x.id === c.id ? actualizada : x)));
      this.alertas.resolver(aviso, { estado: 'success', titulo: archivoUrl ? 'Factura adjunta' : 'Factura quitada', texto: codigoCompra(c.id) });
      return actualizada;
    } catch {
      this.alertas.resolver(aviso, { estado: 'error', titulo: 'No se pudo guardar la factura', texto: 'La compra sí se guardó. Vuelve a adjuntarla.' });
      return c;
    }
  }

  // ── Recibir y cancelar ──
  protected pedirRecibir(id: number): void {
    if (this.catalogo.niega('compras.editar')) return;
    if (this.sucio()) return this.alertas.sacudir();
    this.modal.set({ tipo: 'recibir', id });
  }
  private recibir(id: number): void {
    this.modal.set(null);
    this.revisadas.set({});
    this.catalogo.recibirCompra(id);
  }
  /** El botón "mantener" se sostuvo hasta el final (si sigue abierta la misma compra). */
  protected recibirMantenido(id: number): void {
    if (id === this.seleccion()) this.recibir(id);
  }
  /** Botón "mantener" bloqueado: sacude la alerta de cambios o avisa que falta el permiso. */
  protected recibirBloqueado(motivo: BloqueoRecibir): void {
    if (motivo === 'sucio') this.alertas.sacudir();
    else this.catalogo.niega('compras.editar');
  }
  protected pedirCancelar(): void {
    const c = this.compra();
    this.menu.set(null);
    if (!c || this.catalogo.niega('compras.editar')) return;
    this.modal.set({ tipo: 'cancelar', id: c.id });
  }
  protected confirmarModal(): void {
    const m = this.modal();
    if (m?.tipo === 'recibir') this.recibir(m.id);
    if (m?.tipo === 'cancelar') {
      this.modal.set(null);
      this.catalogo.cancelarCompra(m.id, '');
    }
  }
  protected verFactura(): void {
    this.menu.set(null);
    this.modal.set({ tipo: 'factura', id: this.esNueva() ? null : (this.seleccion() as number) });
  }

  // ── Leer factura con IA ──
  /** "Leer factura": abre una compra nueva y el modal del Asistente. */
  protected abrirIa(): void {
    if (this.catalogo.niega('compras.crear')) return;
    if (!(this.esNueva() && this.borrador()) && !this.nueva()) return;
    this.modal.set({ tipo: 'ia' });
  }
  /** La lectura con IA todavía no está conectada: se avisa en vez de simular una lectura. */
  protected leerFacturaIa(e: Event): void {
    e.preventDefault();
    const campo = e.target as HTMLInputElement;
    const archivo = (e as DragEvent).dataTransfer?.files?.[0] ?? campo.files?.[0];
    if (campo.value) campo.value = '';
    if (!archivo) return;
    this.modal.set(null);
    this.alertas.mostrar({
      estado: 'info',
      titulo: 'Leer factura con IA todavía no está disponible',
      texto: 'Por ahora llena la compra a mano; puedes adjuntar «' + archivo.name + '» en Datos.',
    });
  }

  // ── Lista: filtros, grupos y exportar ──
  protected alternarMenu(k: Exclude<MenuCompras, null>, e: Event): void {
    e.stopPropagation();
    this.menu.update((m) => (m === k ? null : k));
    this.franja()?.abierto.set(false);
  }
  protected alternarMetrica(k: string): void {
    this.metrica.update((m) => (m === k ? null : (k as Metrica)));
    this.plegados.set({});
  }
  protected ordenar(k: Orden): void {
    this.orden.set(k);
    this.menu.set(null);
  }
  protected agrupar(k: Agrupacion): void {
    this.agrupacion.set(k);
    this.menu.set(null);
    this.plegados.set({});
  }
  protected plegarTodos(plegar: boolean): void {
    this.plegados.set(plegar ? Object.fromEntries(this.grupos().map((g) => [g.clave, true])) : {});
    this.menu.set(null);
  }
  protected alternarGrupo(clave: string): void {
    this.plegados.update((p) => ({ ...p, [clave]: !p[clave] }));
  }
  protected limpiarFiltrosPanel(): void {
    this.filtroProveedor.set(null);
    this.filtroRango.set('todo');
    this.filtroDocumento.set('todos');
    this.menu.set(null);
  }
  protected limpiarTodo(): void {
    this.metrica.set(null);
    this.busqueda.set('');
    this.filtroProveedor.set(null);
    this.filtroRango.set('todo');
    this.filtroDocumento.set('todos');
  }
  protected quitarChip(clave: 'metrica' | 'busqueda' | 'proveedor' | 'rango' | 'documento'): void {
    if (clave === 'metrica') this.metrica.set(null);
    if (clave === 'busqueda') this.busqueda.set('');
    if (clave === 'proveedor') this.filtroProveedor.set(null);
    if (clave === 'rango') this.filtroRango.set('todo');
    if (clave === 'documento') this.filtroDocumento.set('todos');
  }
  protected exportar(): void {
    const celda = (x: unknown) => '"' + String(x ?? '').replace(/"/g, '""') + '"';
    const filas = this.catalogo.compras().map((c) =>
      [codigoCompra(c.id), this.proveedor(c.proveedorId)?.nombre, c.fecha, c.numeroFactura, CEST[c.estado].t, c.items.length, this.catalogo.totalCompra(c)].map(celda).join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿codigo,proveedor,fecha,factura,estado,lineas,total\n' + filas.join('\n')], { type: 'text/csv' }));
    a.download = 'compras.csv';
    a.click();
    this.alertas.mostrar({ estado: 'success', titulo: pl(filas.length, 'compra exportada', 'compras exportadas') + ' a CSV' });
  }

  // ── Atajos ──
  protected atajos(e: KeyboardEvent): void {
    if (esGuardar(e)) {
      if (this.sucio()) {
        e.preventDefault();
        this.guardar();
      }
      return;
    }
    if (this.modal()) {
      if (e.key === 'Escape') this.modal.set(null);
      return;
    }
    const tag = (document.activeElement as HTMLElement | null)?.tagName ?? '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') {
      const campo = this.buscador()?.nativeElement;
      if (campo) {
        e.preventDefault();
        campo.focus();
      }
      return;
    }
    if (e.key === 'n' && this.puedeCrear()) {
      e.preventDefault();
      this.nueva();
      return;
    }
    if (e.key === 'Escape') {
      // Con un popover abierto solo se cierra (el del período se cierra solo).
      if (this.menu() || this.franja()?.abierto()) return this.menu.set(null);
      if (this.seleccion() != null) this.cerrar();
      return;
    }
    const d = e.key === 'ArrowDown' || e.key === 'j' ? 1 : e.key === 'ArrowUp' || e.key === 'k' ? -1 : 0;
    if (d) {
      e.preventDefault();
      this.mover(d);
    }
  }
}
