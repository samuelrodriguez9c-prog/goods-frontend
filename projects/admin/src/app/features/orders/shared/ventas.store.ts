import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, filter, finalize, firstValueFrom, forkJoin, tap } from 'rxjs';
import { Cliente as ClienteApi, GuardarClientePayload } from '../../../core/cliente/models/cliente.model';
import { ClienteService } from '../../../core/cliente/cliente.service';
import { CampoPersonalizado, ValoresCampos, atributosDe, erroresCampos, valoresDe } from '../../../core/campos/campo-personalizado.model';
import { CampoPersonalizadoService } from '../../../core/campos/campo-personalizado.service';
import { DetallePedido, Pedido as PedidoApi, PedidoEvento, ResumenPedidos } from '../../../core/pedido/models/pedido.model';
import { PedidoService } from '../../../core/pedido/pedido.service';
import { CambiosEnVivoService } from '../../../core/realtime/cambios-en-vivo.service';
import { mensajeDeError } from '../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../core/ui/alerta.service';
import { CatalogoStore } from '../../products/shared/catalogo.store';
import { cop } from '../../products/shared/formato';
import { pnum, soloDigitos } from './ventas.formato';
import {
  BorradorCliente, BorradorPedido, Cliente, EST, EstadoPedido, EventoPedido, PUEDE, PagoPedido, Pedido, StatsCliente,
} from './ventas.modelos';

/** El listado trae los últimos 100 (el máximo del backend); el resto se abre por `?pedido=ID`. */
const POR_PAGINA = 100;
/** Un `datos:cambio` que llega dentro de esta ventana es eco de una escritura propia. */
const ECO_PROPIO_MS = 2500;

const num = (v: string | number | null | undefined) => Number(v ?? 0) || 0;
const nombreDe = (u: { nombres: string; apellidos: string } | null | undefined) => (u ? `${u.nombres} ${u.apellidos}`.trim() : null);
const nulo = (v: string) => (v.trim() ? v.trim() : null);
/** 10 dígitos → con indicativo 57; otro largo se deja como está. */
const conIndicativo = (t: string) => { const d = soloDigitos(t); return d.length === 10 ? '57' + d : d; };

export type ResultadoGuardar = { id: number } | { error: string; pestana: 'productos' | 'cliente' };

/**
 * Estado de Pedidos y Clientes, conectado a `PedidoService` y `ClienteService`.
 *
 * @remarks
 * - `asegurar()` lo llama cada página al entrar: la primera vez carga con
 *   esqueletos; después refresca en silencio.
 * - El stock lo mueve el servidor al cambiar el estado: confirmar descuenta
 *   (o falla con 409 diciendo qué falta, y eso se muestra en la hoja);
 *   cancelar o devolver lo regresa. Después de cada cambio se refresca el
 *   catálogo para que las cifras de stock queden al día.
 * - Cambiar estado o pago no tiene reversa en el backend: no se ofrece
 *   «Deshacer» (sí al archivar un cliente).
 */
@Injectable({ providedIn: 'root' })
export class VentasStore {
  private readonly alertas = inject(AlertaService);
  private readonly catalogo = inject(CatalogoStore);
  private readonly pedidosApi = inject(PedidoService);
  private readonly clientesApi = inject(ClienteService);
  private readonly camposApi = inject(CampoPersonalizadoService);

  /** Campos propios activos de clientes y de pedidos. */
  readonly camposCliente = computed(() => this.camposApi.activos('cliente'));
  readonly camposPedido = computed(() => this.camposApi.activos('pedido'));

  readonly hoy = this.catalogo.hoy;
  readonly cargando = signal(false);
  readonly cargado = signal(false);
  readonly error = signal<string | null>(null);

  readonly clientes = signal<Cliente[]>([]);
  readonly pedidos = signal<Pedido[]>([]);
  /** Cuentas de todos los pedidos (no solo los 100 cargados). */
  readonly resumen = signal<ResumenPedidos | null>(null);
  /** Lo vendido en el período de la cabecera. */
  readonly vendido = signal<{ cantidad: number; vendido: number } | null>(null);
  /** Pedidos de un cliente (pestaña Pedidos de Clientes), por id de cliente. */
  private readonly porCliente = signal<Record<number, Pedido[]>>({});
  /** Error de stock al confirmar, por pedido (se muestra en la hoja). */
  readonly errores = signal<Record<number, string>>({});
  /** Alistamiento: productos empacados por pedido. Vive en memoria (no lo guarda el backend). */
  readonly alistados = signal<Record<number, number[]>>({});
  /** Pedidos con una escritura en curso (para no mandar dos veces). */
  readonly ocupados = signal<Set<number>>(new Set());

  private readonly mapaPedidos = computed(() => new Map(this.pedidos().map((p) => [p.id, p])));
  private readonly mapaClientes = computed(() => new Map(this.clientes().map((c) => [c.id, c])));
  private readonly alCargar: (() => void)[] = [];
  private cargaEnCurso = false;
  private ultimaEscrituraPropia = 0;
  private desdeVendido: string | null = null;

  constructor() {
    inject(CambiosEnVivoService)
      .huboCambio(['pedido', 'cliente'])
      .pipe(filter(() => this.cargado() && Date.now() - this.ultimaEscrituraPropia > ECO_PROPIO_MS))
      .subscribe(() => this.traer(false));
  }

  // Carga
  /** Cada página la llama al entrar. */
  asegurar(): void {
    this.camposApi.asegurar('cliente');
    this.camposApi.asegurar('pedido');
    this.traer(!this.cargado());
  }

  /** Corre `fn` cuando haya datos (ya, si ya cargó). Para abrir `?pedido=ID` y similares. */
  alListo(fn: () => void): void {
    if (this.cargado()) queueMicrotask(fn);
    else this.alCargar.push(fn);
  }

  reintentar(): void {
    this.traer(true);
  }

  private traer(conEsqueleto: boolean): void {
    if (this.cargaEnCurso) return;
    this.cargaEnCurso = true;
    if (conEsqueleto) {
      this.cargando.set(true);
      this.error.set(null);
    }
    forkJoin({
      pedidos: this.pedidosApi.listar({ pageSize: POR_PAGINA }),
      activos: this.clientesApi.listar({ pageSize: POR_PAGINA, orden: 'recientes' }),
      archivados: this.clientesApi.listar({ pageSize: POR_PAGINA, archivados: true }),
      resumen: this.pedidosApi.resumen(),
    })
      .pipe(finalize(() => (this.cargaEnCurso = false)))
      .subscribe({
        next: (r) => {
          this.hoy.set(new Date());
          // Conserva lo que ya se trajo del detalle (eventos, pagos…) y los pedidos abiertos por enlace.
          const antes = this.mapaPedidos();
          const nuevos = r.pedidos.data.map((p) => aPedido(p, antes.get(p.id)));
          const ids = new Set(nuevos.map((p) => p.id));
          this.pedidos.set([...nuevos, ...this.pedidos().filter((p) => !ids.has(p.id))]);
          const clientes = [...r.activos.data, ...r.archivados.data].map(aCliente), cids = new Set(clientes.map((c) => c.id));
          this.clientes.set([...clientes, ...this.clientes().filter((c) => !cids.has(c.id))]);
          this.resumen.set(r.resumen);
          this.porCliente.set({});
          this.cargado.set(true);
          this.cargando.set(false);
          if (this.desdeVendido) this.cargarVendido(this.desdeVendido);
          this.alCargar.splice(0).forEach((fn) => fn());
        },
        error: (e) => {
          this.cargando.set(false);
          if (conEsqueleto || !this.cargado()) {
            this.error.set(
              e instanceof HttpErrorResponse && e.status === 403
                ? 'No tienes permiso para ver los pedidos. Pídele al dueño que te lo habilite en Roles y permisos.'
                : 'No se pudieron cargar los pedidos. Revisa tu conexión e inténtalo de nuevo.',
            );
          }
        },
      });
  }

  /** Lo vendido desde `desde` (YYYY-MM-DD) hasta hoy: la métrica «Vendido» de la cabecera. */
  cargarVendido(desde: string): void {
    this.desdeVendido = desde;
    this.pedidosApi.resumen({ desde }).subscribe({
      next: (r) => this.desdeVendido === desde && this.vendido.set({ cantidad: r.cantidad - (r.porEstado.cancelado ?? 0) - (r.porEstado.devuelto ?? 0), vendido: r.vendido }),
      error: () => this.vendido.set(null),
    });
  }

  /** Trae el detalle (eventos, pagos, código, quién lo cargó). También sirve para abrir un pedido que no está en la lista. */
  cargarDetalle(id: number): Promise<Pedido | null> {
    return firstValueFrom(this.pedidosApi.detalle(id))
      .then((r) => this.guardarPedidoLocal(r))
      .catch(() => null);
  }

  /** Un cliente que no vino en la lista (abierto por enlace). */
  cargarCliente(id: number): Promise<Cliente | null> {
    return firstValueFrom(this.clientesApi.ficha(id))
      .then((r) => this.guardarClienteLocal(r))
      .catch(() => null);
  }

  /** Los pedidos de un cliente para su ficha (todos, no solo los cargados en la lista). */
  cargarPedidosDe(cid: number): void {
    this.pedidosApi.listar({ clienteId: cid, pageSize: POR_PAGINA }).subscribe({
      next: (r) => {
        const antes = this.mapaPedidos();
        this.porCliente.update((m) => ({ ...m, [cid]: r.data.map((p) => aPedido(p, antes.get(p.id))) }));
      },
    });
  }

  /**
   * Después de cambiar el estado o el pago: el resumen de la cabecera, lo
   * vendido y las cifras del cliente (pedidos, total gastado, último pedido),
   * que calcula el servidor. El eco en vivo de la propia escritura se ignora,
   * así que hay que pedirlas acá.
   */
  private refrescarCifras(clienteId?: number): void {
    this.pedidosApi.resumen().subscribe({ next: (r) => this.resumen.set(r) });
    if (this.desdeVendido) this.cargarVendido(this.desdeVendido);
    if (clienteId != null) void this.cargarCliente(clienteId);
  }

  private guardarPedidoLocal(r: PedidoApi | DetallePedido): Pedido {
    const p = aPedido(r, this.pedido(r.id));
    this.pedidos.update((xs) => (xs.some((x) => x.id === p.id) ? xs.map((x) => (x.id === p.id ? p : x)) : [p, ...xs]));
    this.porCliente.update((m) => {
      const xs = m[p.clienteId];
      return xs ? { ...m, [p.clienteId]: xs.some((x) => x.id === p.id) ? xs.map((x) => (x.id === p.id ? p : x)) : [p, ...xs] } : m;
    });
    return p;
  }

  private guardarClienteLocal(r: ClienteApi): Cliente {
    const c = aCliente(r);
    this.clientes.update((xs) => (xs.some((x) => x.id === c.id) ? xs.map((x) => (x.id === c.id ? c : x)) : [...xs, c]));
    // El nombre y el celular del pedido salen del cliente.
    this.pedidos.update((xs) => xs.map((p) => (p.clienteId === c.id ? { ...p, cliente: { nombre: c.nombre, telefono: c.telefono, correo: c.correo } } : p)));
    return c;
  }

  // Lectura
  pedido = (id: number) => this.mapaPedidos().get(id);
  cliente = (id: number) => this.mapaClientes().get(id);
  pedidosDe = (cid: number) =>
    (this.porCliente()[cid] ?? this.pedidos().filter((p) => p.clienteId === cid)).slice().sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  stats = (cid: number): StatsCliente => {
    const c = this.cliente(cid);
    const n = c?.cantidadPedidos ?? 0, total = c?.totalGastado ?? 0;
    return { n, total, ticket: n ? total / n : 0, ultimo: c?.ultimoPedidoEn ?? null };
  };
  /** Lo que se puede apartar hoy: disponible menos lo que ya apartaron otros pedidos (igual que el backend). */
  disponible = (productoId: number) => { const s = this.catalogo.stockDe(productoId); return s.disponible - s.reservado; };
  ocupado = (id: number) => this.ocupados().has(id);
  /** Totales del borrador. El descuento de un código nuevo lo calcula el servidor al guardar. */
  calcular(d: BorradorPedido, original?: Pedido | null) {
    const subtotal = d.items.reduce((a, it) => a + it.cantidad * it.precioUnitario, 0), envio = +soloDigitos(d.costoEnvio) || 0;
    const code = d.codigo.trim().toUpperCase();
    // Al editar, el código no cambia: se mantiene lo que descontó (como mucho, el subtotal).
    const descuento = original?.codigoDescuento && original.codigoDescuento === code ? Math.min(subtotal, original.descuento) : 0;
    return { subtotal, envio, descuento, total: subtotal + envio - descuento, code, pendiente: !!code && !original?.codigoDescuento };
  }

  limpiarError(id: number) { this.errores.update((e) => { const { [id]: _, ...r } = e; return r; }); }

  private marcar(id: number, on: boolean) {
    this.ocupados.update((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  }

  private propia<T>(obs: Observable<T>): Observable<T> {
    this.ultimaEscrituraPropia = Date.now();
    return obs.pipe(tap({ finalize: () => (this.ultimaEscrituraPropia = Date.now()) }));
  }

  // Estado y pago
  /** Avanza, cancela o devuelve. Se ve al instante; si el servidor lo rechaza vuelve atrás. */
  async cambiarEstado(id: number, dest: EstadoPedido, motivo = ''): Promise<boolean> {
    const p = this.pedido(id);
    if (!p || this.ocupado(id)) return false;
    if (this.catalogo.niega('pedidos.editar')) return false;
    if (!PUEDE[p.estado].includes(dest)) {
      this.alertas.mostrar({ estado: 'warning', titulo: pnum(p.numero), texto: `No puede pasar de ${EST[p.estado].t.toLowerCase()} a ${EST[dest].t.toLowerCase()}` });
      return false;
    }
    const m = motivo.trim();
    const TXT: Record<EstadoPedido, [string, string]> = {
      confirmado: ['Confirmando', 'confirmado, se descontó el stock'],
      enviado: ['Marcando como enviado', 'marcado como enviado'],
      entregado: ['Marcando como entregado', 'entregado'],
      cancelado: ['Cancelando', 'cancelado' + (p.estado === 'pendiente' ? '' : ' · el stock volvió al inventario')],
      devuelto: ['Registrando la devolución', 'devuelto · el stock volvió al inventario'],
      pendiente: ['', ''],
    };
    const alerta = this.alertas.mostrar({ titulo: pnum(p.numero), texto: TXT[dest][0] });
    this.marcar(id, true);
    this.limpiarError(id);
    this.parchar(id, (x) => ({ ...x, estado: dest }));
    const peticion = dest === 'cancelado' ? this.pedidosApi.cancelar(id, m || undefined) : this.pedidosApi.cambiarEstado(id, dest, m || undefined);
    try {
      const r = await firstValueFrom(this.propia(peticion));
      this.guardarPedidoLocal(r);
      this.alertas.resolver(alerta, { estado: 'success', titulo: pnum(p.numero), texto: TXT[dest][1] });
      this.refrescarCifras(p.clienteId);
      this.catalogo.asegurar();
      return true;
    } catch (e) {
      this.parchar(id, (x) => ({ ...x, estado: p.estado }));
      const msg = mensajeDeError(e, 'El servidor rechazó el cambio.');
      if (dest === 'confirmado' && e instanceof HttpErrorResponse && e.status === 409) this.errores.update((x) => ({ ...x, [id]: msg }));
      this.alertas.resolver(alerta, { estado: 'error', titulo: `No se pudo ${dest === 'confirmado' ? 'confirmar' : 'cambiar'} ${pnum(p.numero)}`, texto: msg });
      return false;
    } finally {
      this.marcar(id, false);
    }
  }

  async marcarPagado(id: number, metodo: string): Promise<boolean> {
    return this.pago(id, 'pagado', metodo);
  }

  async reembolsar(id: number): Promise<boolean> {
    return this.pago(id, 'reembolsado');
  }

  private async pago(id: number, estado: 'pagado' | 'reembolsado', metodo?: string): Promise<boolean> {
    const p = this.pedido(id);
    if (!p || this.ocupado(id) || this.catalogo.niega('pedidos.editar')) return false;
    const alerta = this.alertas.mostrar({ titulo: pnum(p.numero), texto: estado === 'pagado' ? 'Registrando el pago' : 'Registrando el reembolso' });
    this.marcar(id, true);
    this.parchar(id, (x) => ({ ...x, estadoPago: estado, metodoPago: metodo ?? x.metodoPago }));
    try {
      const r = await firstValueFrom(this.propia(this.pedidosApi.marcarPago(id, estado, metodo)));
      this.guardarPedidoLocal(r);
      this.alertas.resolver(alerta, { estado: 'success', titulo: pnum(p.numero), texto: estado === 'pagado' ? 'marcado como pagado con ' + metodo : 'marcado como reembolsado · ' + cop(p.total) });
      this.refrescarCifras(p.clienteId);
      return true;
    } catch (e) {
      this.parchar(id, () => p);
      this.alertas.resolver(alerta, { estado: 'error', titulo: 'No se pudo registrar el ' + (estado === 'pagado' ? 'pago' : 'reembolso'), texto: mensajeDeError(e, pnum(p.numero)) });
      return false;
    } finally {
      this.marcar(id, false);
    }
  }

  async dejarNota(id: number, texto: string): Promise<boolean> {
    const t = texto.trim();
    if (!t) return false;
    try {
      const r = await firstValueFrom(this.propia(this.pedidosApi.agregarNota(id, t)));
      this.guardarPedidoLocal(r);
      this.alertas.mostrar({ estado: 'success', titulo: 'Nota guardada', texto: 'Solo la ve tu equipo' });
      return true;
    } catch (e) {
      this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo guardar la nota', texto: mensajeDeError(e) });
      return false;
    }
  }

  alternarAlistado(pedidoId: number, productoId: number) {
    this.alistados.update((a) => {
      const xs = a[pedidoId] ?? [];
      return { ...a, [pedidoId]: xs.includes(productoId) ? xs.filter((x) => x !== productoId) : [...xs, productoId] };
    });
  }

  private parchar(id: number, fn: (p: Pedido) => Pedido) {
    this.pedidos.update((xs) => xs.map((p) => (p.id === id ? fn(p) : p)));
  }

  // Crear / editar pedido
  borradorVacio(cid: number | null = null): BorradorPedido {
    const c = cid ? this.cliente(cid) : undefined;
    return {
      items: [], cliMode: 'existente', clienteId: c && !c.archivadoEn ? c.id : null, nuevo: { nombre: '', telefono: '', correo: '' },
      direccion: c?.direccion.direccion ?? '', referencia: c?.direccion.referencia ?? '', ciudad: c?.direccion.ciudad ?? '',
      costoEnvio: '', codigo: '', metodoPago: 'Efectivo', notas: '', canal: 'panel', atributos: valoresDe({}, this.camposPedido()),
    };
  }
  borradorDe(p: Pedido): BorradorPedido {
    return {
      items: p.items.map((it) => ({ productoId: it.productoId, cantidad: it.cantidad, precioUnitario: it.precioUnitario })),
      cliMode: 'existente', clienteId: p.clienteId, nuevo: { nombre: '', telefono: '', correo: '' },
      direccion: p.direccionEnvio?.direccion ?? '', referencia: p.direccionEnvio?.referencia ?? '', ciudad: p.direccionEnvio?.ciudad ?? '',
      costoEnvio: p.costoEnvio ? String(p.costoEnvio) : '', codigo: p.codigoDescuento ?? '', metodoPago: p.metodoPago || 'Efectivo', notas: p.notas, canal: p.canal,
      atributos: valoresDe(p.atributos, this.camposPedido()),
    };
  }
  /** «Repetir»: mismo cliente y productos, a precio actual (los descontinuados se quitan). */
  borradorRepetir(p: Pedido): BorradorPedido {
    const d = this.borradorVacio(p.clienteId);
    d.items = p.items
      .map((it) => ({ it, pr: this.catalogo.producto(it.productoId) }))
      .filter(({ pr }) => pr && pr.estado !== 'descontinuado')
      .map(({ it, pr }) => ({ productoId: it.productoId, cantidad: it.cantidad, precioUnitario: pr!.precio }));
    return d;
  }
  erroresBorrador(d: BorradorPedido): { items?: string; cliente?: string; campos?: string } {
    const e: { items?: string; cliente?: string; campos?: string } = {};
    if (!d.items.length) e.items = 'Agrega al menos un producto';
    if (d.cliMode === 'nuevo' ? !d.nuevo.nombre.trim() : !d.clienteId) e.cliente = d.cliMode === 'nuevo' ? 'El nombre del cliente es obligatorio' : 'Elige un cliente o créalo';
    else if (d.cliMode === 'nuevo' && d.nuevo.telefono.trim() && soloDigitos(d.nuevo.telefono).length !== 10) e.cliente = 'El celular debe tener 10 dígitos';
    const campos = primerError(d.atributos, this.camposPedido());
    if (campos) e.campos = campos;
    return e;
  }

  /** Crea o guarda. El servidor valida el stock, el código y el celular duplicado; su mensaje vuelve a la hoja. */
  async guardarPedido(d: BorradorPedido, id: number | null): Promise<ResultadoGuardar> {
    const e = this.erroresBorrador(d);
    if (e.items || e.cliente || e.campos) return { error: Object.values(e).join(' · '), pestana: e.items ? 'productos' : 'cliente' };
    if (this.catalogo.niega('pedidos.editar')) return { error: 'Necesitas el permiso pedidos.editar', pestana: 'productos' };
    const comun = {
      items: d.items.map((it) => ({ productoId: it.productoId, cantidad: it.cantidad })),
      direccionEnvio: d.direccion.trim() ? { direccion: d.direccion.trim(), referencia: nulo(d.referencia), ciudad: nulo(d.ciudad) } : null,
      costoEnvio: +soloDigitos(d.costoEnvio) || 0,
      metodoPago: d.metodoPago || null,
      notas: nulo(d.notas),
      ...(this.camposPedido().length ? { atributos: atributosDe(d.atributos, this.camposPedido()) } : {}),
    };
    const nuevoCliente = d.cliMode === 'nuevo';
    const alerta = this.alertas.mostrar({ titulo: id == null ? 'Creando el pedido' : 'Guardando el pedido' });
    try {
      const r = await firstValueFrom(
        this.propia(
          id == null
            ? this.pedidosApi.crear({
                ...comun,
                ...(nuevoCliente
                  ? { clienteNuevo: { nombre: d.nuevo.nombre.trim(), telefono: conIndicativo(d.nuevo.telefono) || null, correo: nulo(d.nuevo.correo) } }
                  : { clienteId: d.clienteId! }),
                codigoDescuento: nulo(d.codigo.toUpperCase()),
                canal: d.canal === 'whatsapp' ? 'whatsapp' : 'panel',
              })
            : this.pedidosApi.actualizar(id, { ...comun, clienteId: d.clienteId! }),
        ),
      );
      const p = this.guardarPedidoLocal(r);
      if (id == null) {
        this.alertas.resolver(alerta, {
          estado: 'success', titulo: `Pedido ${pnum(p.numero)} creado`, texto: 'Queda pendiente hasta que lo confirmes',
          accion: { label: 'Confirmar ahora', ejecutar: () => void this.cambiarEstado(p.id, 'confirmado') },
        });
      } else {
        this.alertas.resolver(alerta, { estado: 'success', titulo: pnum(p.numero), texto: 'Cambios guardados' });
      }
      // Cliente nuevo, cifras del cliente y stock apartado.
      this.traer(false);
      this.catalogo.asegurar();
      return { id: p.id };
    } catch (err) {
      const msg = mensajeDeError(err, 'El servidor rechazó el pedido.');
      this.alertas.resolver(alerta, { estado: 'error', titulo: 'No se pudo guardar', texto: msg });
      return { error: msg, pestana: /c[oó]digo|descuento|cliente|celular|correo|direcci/i.test(msg) ? 'cliente' : 'productos' };
    }
  }

  // Clientes
  borradorCliente(c?: Cliente): BorradorCliente {
    return c
      ? { nombre: c.nombre, telefono: c.telefono.startsWith('57') && c.telefono.length === 12 ? c.telefono.slice(2) : c.telefono, correo: c.correo, documento: c.documento, direccion: c.direccion.direccion, referencia: c.direccion.referencia, ciudad: c.direccion.ciudad, notas: c.notas, atributos: valoresDe(c.atributos, this.camposCliente()) }
      : { nombre: '', telefono: '', correo: '', documento: '', direccion: '', referencia: '', ciudad: '', notas: '', atributos: valoresDe({}, this.camposCliente()) };
  }

  async guardarCliente(d: BorradorCliente, id: number | null): Promise<{ id: number } | { error: string }> {
    if (!d.nombre.trim()) return { error: 'El nombre es obligatorio' };
    const t = soloDigitos(d.telefono);
    if (t && t.length !== 10 && !(t.length === 12 && t.startsWith('57'))) return { error: 'El celular debe tener 10 dígitos' };
    if (this.catalogo.niega('clientes.editar')) return { error: 'Necesitas el permiso clientes.editar' };
    // El backend exige la dirección (calle y número) si se manda el bloque de dirección:
    // ciudad o referencia solas daban 400 con el mensaje del servidor en inglés.
    if (!d.direccion.trim() && (d.ciudad.trim() || d.referencia.trim())) {
      return { error: 'Escribe la dirección para guardar la ciudad o la referencia, o déjalas vacías.' };
    }
    const errorCampo = primerError(d.atributos, this.camposCliente());
    if (errorCampo) return { error: errorCampo };
    const payload: GuardarClientePayload = {
      nombre: d.nombre.trim(),
      telefono: t ? conIndicativo(t) : null,
      correo: nulo(d.correo),
      documento: nulo(d.documento),
      direccion: d.direccion.trim() ? { direccion: d.direccion.trim(), referencia: nulo(d.referencia), ciudad: nulo(d.ciudad) } : null,
      notas: nulo(d.notas),
      ...(this.camposCliente().length ? { atributos: atributosDe(d.atributos, this.camposCliente()) } : {}),
    };
    const alerta = this.alertas.mostrar({ titulo: id == null ? 'Creando cliente' : 'Guardando cambios', texto: payload.nombre });
    try {
      const r = await firstValueFrom(this.propia(id == null ? this.clientesApi.crear(payload) : this.clientesApi.actualizar(id, payload)));
      const c = this.guardarClienteLocal(r);
      this.alertas.resolver(alerta, { estado: 'success', titulo: id == null ? 'Cliente creado' : 'Cambios guardados', texto: c.nombre });
      return { id: c.id };
    } catch (e) {
      const msg = mensajeDeError(e, 'El servidor rechazó el cambio.');
      this.alertas.resolver(alerta, { estado: 'error', titulo: 'No se pudo guardar', texto: msg });
      return { error: msg };
    }
  }

  async guardarNotas(id: number, notas: string): Promise<boolean> {
    if (this.catalogo.niega('clientes.editar')) return false;
    try {
      const r = await firstValueFrom(this.propia(this.clientesApi.actualizar(id, { notas: nulo(notas) })));
      this.guardarClienteLocal(r);
      this.alertas.mostrar({ estado: 'success', titulo: 'Notas guardadas', texto: r.nombre });
      return true;
    } catch (e) {
      this.alertas.mostrar({ estado: 'error', titulo: 'No se pudieron guardar las notas', texto: mensajeDeError(e) });
      return false;
    }
  }

  /** Archiva o desarchiva, con «Deshacer». */
  archivar(id: number, deshaciendo = false): void {
    const c = this.cliente(id);
    if (!c || this.catalogo.niega('clientes.editar')) return;
    const on = !c.archivadoEn;
    const poner = (x: Cliente) => this.clientes.update((xs) => xs.map((y) => (y.id === id ? x : y)));
    poner({ ...c, archivadoEn: on ? new Date().toISOString() : null });
    this.propia(this.clientesApi.archivar(id, on)).subscribe({
      next: (r) => {
        this.guardarClienteLocal(r);
        if (deshaciendo) return;
        this.alertas.mostrar({
          estado: 'success', titulo: c.nombre.split(' ')[0],
          texto: on ? 'Archivado, ya no aparece en la lista ni al crear pedidos' : 'Desarchivado',
          accion: { label: 'Deshacer', ejecutar: () => this.archivar(id, true) },
        });
      },
      error: (e) => {
        poner(c);
        this.alertas.mostrar({ estado: 'error', titulo: on ? 'No se pudo archivar' : 'No se pudo desarchivar', texto: mensajeDeError(e, c.nombre) });
      },
    });
  }
}

// Del backend a la pantalla

/** El primer error de los campos propios, como «Etiqueta: qué falta», o `''`. */
function primerError(valores: ValoresCampos, campos: CampoPersonalizado[]): string {
  const e = erroresCampos(valores, campos);
  const c = campos.find((x) => e[x.clave]);
  return c ? `${c.etiqueta}: ${e[c.clave].charAt(0).toLowerCase()}${e[c.clave].slice(1)}` : '';
}

function aCliente(c: ClienteApi): Cliente {
  return {
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono ?? '',
    correo: c.correo ?? '',
    documento: c.documento ?? '',
    direccion: { direccion: c.direccion?.direccion ?? '', referencia: c.direccion?.referencia ?? '', ciudad: c.direccion?.ciudad ?? '' },
    notas: c.notas ?? '',
    atributos: c.atributos ?? {},
    aceptaPromociones: c.aceptaPromociones,
    whatsappContactoId: c.whatsappContactoId,
    archivadoEn: c.archivadoEn,
    creadoEn: c.creadoEn,
    cantidadPedidos: c.cantidadPedidos ?? 0,
    totalGastado: num(c.totalGastado),
    ultimoPedidoEn: c.ultimoPedidoEn,
  };
}

function aEvento(e: PedidoEvento, canal: string): EventoPedido {
  const { a, motivo } = (e.datos ?? {}) as { a?: EstadoPedido; motivo?: string };
  return {
    tipo: e.tipo,
    detalle: e.detalle,
    por: nombreDe(e.usuario) ?? (e.tipo === 'creado' && canal === 'tienda' ? 'Tienda en línea' : 'Goods'),
    en: e.creadoEn,
    ...(e.tipo === 'estado' && a ? { estado: a } : {}),
    ...(motivo ? { motivo } : {}),
  };
}

/** Pagos para la pestaña Cliente y entrega: un reembolso suma una línea negativa. */
function aPagos(d: DetallePedido, eventos: EventoPedido[]): PagoPedido[] {
  const reembolso = [...eventos].reverse().find((e) => e.tipo === 'pago' && /reembols/i.test(e.detalle));
  return d.pagos
    .filter((x) => x.estado === 'aprobado' || x.estado === 'reembolsado')
    .slice()
    .reverse()
    .flatMap((x) => {
      const pago: PagoPedido = { monto: num(x.monto), metodo: x.metodoPago, estado: 'pagado', en: x.fechaPago ?? x.creadoEn };
      return x.estado === 'reembolsado' ? [pago, { monto: -num(x.monto), metodo: x.metodoPago, estado: 'reembolsado', en: reembolso?.en ?? x.creadoEn } as PagoPedido] : [pago];
    });
}

function aPedido(p: PedidoApi | DetallePedido, antes?: Pedido): Pedido {
  const det = 'eventos' in p && Array.isArray(p.eventos);
  const eventos = det ? (p as DetallePedido).eventos.map((e) => aEvento(e, p.canal)).sort((a, b) => a.en.localeCompare(b.en)) : (antes?.eventos ?? []);
  const de = p.direccionEnvio;
  return {
    id: p.id,
    numero: p.numero,
    clienteId: p.clienteId,
    cliente: { nombre: p.cliente?.nombre ?? antes?.cliente.nombre ?? 'Cliente', telefono: p.cliente?.telefono ?? '', correo: p.cliente?.correo ?? '' },
    atributos: p.atributos ?? antes?.atributos ?? {},
    estado: p.estado,
    estadoPago: p.estadoPago,
    canal: p.canal,
    items: p.items.map((it) => ({
      id: it.id,
      productoId: it.productoId,
      productoNombre: it.productoNombre,
      cantidad: it.cantidad,
      precioUnitario: num(it.precioUnitario),
      subtotal: num(it.subtotal),
      sku: it.producto?.sku ?? antes?.items.find((x) => x.id === it.id)?.sku ?? null,
      imagenUrl: it.producto?.imagenUrl ?? antes?.items.find((x) => x.id === it.id)?.imagenUrl ?? null,
    })),
    subtotal: num(p.subtotal),
    costoEnvio: num(p.costoEnvio),
    descuento: num(p.descuento),
    codigoDescuento: det ? (p as DetallePedido).codigoDescuento : (antes?.codigoDescuento ?? null),
    total: num(p.total),
    metodoPago: p.metodoPago ?? '',
    direccionEnvio: de ? { direccion: de.direccion ?? '', referencia: de.referencia ?? '', ciudad: de.ciudad ?? '', telefono: de.telefono ?? undefined } : null,
    notas: p.notas ?? '',
    stockReservado: p.stockReservado,
    creadoPor: det ? nombreDe((p as DetallePedido).creadoPor) : (antes?.creadoPor ?? null),
    motivoCancelacion: p.motivoCancelacion,
    canceladoEn: p.canceladoEn,
    pagos: det ? aPagos(p as DetallePedido, eventos) : (antes?.pagos ?? []),
    eventos,
    creadoEn: p.creadoEn,
    detalle: det || !!antes?.detalle,
  };
}
