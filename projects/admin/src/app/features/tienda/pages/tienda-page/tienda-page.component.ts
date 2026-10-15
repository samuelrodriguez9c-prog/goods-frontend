import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ResumenPedidos } from '../../../../core/pedido/models/pedido.model';
import { PedidoService } from '../../../../core/pedido/pedido.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { CambiosTienda, MiTienda, MonedaTienda, TiendaService } from '../../../../core/tienda/tienda.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { CabeceraModuloComponent, MetricaCabecera } from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { CatalogoStore } from '../../../products/shared/catalogo.store';
import { pl } from '../../../products/shared/formato';
import { EstadoPaginaComponent } from '../../../products/shared/ui/estado-pagina/estado-pagina.component';
import { IcComponent } from '../../../products/shared/ui/ic/ic.component';
import { icono } from '../../../products/shared/ui/iconos';
import { CartelTiendaComponent } from './components/cartel-tienda/cartel-tienda.component';
import { PasoTiendaComponent } from './components/paso-tienda/paso-tienda.component';
import { SeccionCatalogoComponent } from './components/seccion-catalogo/seccion-catalogo.component';
import { SeccionDireccionComponent } from './components/seccion-direccion/seccion-direccion.component';
import { SeccionIdentidadComponent } from './components/seccion-identidad/seccion-identidad.component';
import { PaisTienda, SeccionWhatsappComponent } from './components/seccion-whatsapp/seccion-whatsapp.component';
import { SeccionTienda, VitrinaMovilComponent } from './components/vitrina-movil/vitrina-movil.component';

const INDICATIVO: Record<Exclude<PaisTienda, 'otro'>, string> = { CO: '57', US: '1' };

/**
 * Tienda en línea (rediseño 2026-10-15). El dueño la arma en 4 pasos
 * (dirección, WhatsApp, cómo se ve y catálogo) y a la derecha la ve en vivo
 * dentro de un celular, con el cartel «Abierto / Cerrado» para publicarla o
 * pausarla. Tocar una parte de la vitrina lleva a su paso.
 *
 * Los cambios se guardan desde la pila «Cambios sin guardar» (como en el
 * resto de módulos) o con Ctrl+S; publicar guarda lo pendiente a la vez.
 */
@Component({
  selector: 'app-tienda-page',
  standalone: true,
  imports: [
    CabeceraModuloComponent, EstadoPaginaComponent, IcComponent, PasoTiendaComponent, SeccionDireccionComponent, SeccionWhatsappComponent,
    SeccionIdentidadComponent, SeccionCatalogoComponent, CartelTiendaComponent, VitrinaMovilComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-page.component.html',
  host: { class: 'flex flex-col gap-4 px-6 pt-5 pb-10 leading-[normal]', '(document:keydown)': 'teclas($event)' },
})
export class TiendaPageComponent {
  private readonly tiendaService = inject(TiendaService);
  private readonly pedidos = inject(PedidoService);
  private readonly alertas = inject(AlertaService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly el = inject(ElementRef<HTMLElement>);
  protected readonly cat = inject(CatalogoStore);
  protected readonly icono = icono;

  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly tienda = signal<MiTienda | null>(null);
  private readonly resumen = signal<ResumenPedidos | null>(null);

  // Formulario
  protected readonly slug = signal('');
  protected readonly pais = signal<PaisTienda>('CO');
  protected readonly numero = signal('');
  protected readonly descripcion = signal('');
  protected readonly logoUrl = signal<string | null>(null);
  protected readonly moneda = signal<MonedaTienda>('COP');
  protected readonly mostrarAgotados = signal(true);

  protected readonly guardando = signal(false);
  protected readonly copiado = signal(false);
  /** El paso que se está editando (se resalta). */
  protected readonly seccion = signal<SeccionTienda | null>(null);

  protected readonly nombreNegocio = computed(() => this.auth.currentUser()?.empresa?.nombre || 'Tu negocio');
  /** `tienda.goods…/` — la parte fija de la dirección. */
  protected readonly prefijo = computed(() => {
    const t = this.tienda();
    return t ? t.url.slice(0, t.url.length - t.slug.length).replace(/^https?:\/\//, '') : '';
  });
  /** El WhatsApp como lo guarda el backend: solo dígitos, con indicativo. */
  protected readonly whatsapp = computed(() => {
    const d = this.numero().replace(/\D/g, '');
    if (!d) return null;
    const p = this.pais();
    return p === 'otro' ? d : INDICATIVO[p] + d;
  });
  protected readonly whatsappValido = computed(() => {
    const w = this.whatsapp();
    if (w === null) return true;
    if (this.pais() === 'CO') return /^573\d{9}$/.test(w);
    if (this.pais() === 'US') return /^1\d{10}$/.test(w);
    return /^\d{8,15}$/.test(w);
  });
  protected readonly slugValido = computed(() => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(this.slug()) && this.slug().length <= 60);

  protected readonly cambios = computed<CambiosTienda>(() => ({
    slug: this.slug(),
    whatsapp: this.whatsapp(),
    descripcion: this.descripcion().trim() || null,
    logoUrl: this.logoUrl(),
    moneda: this.moneda(),
    mostrarAgotados: this.mostrarAgotados(),
  }));
  protected readonly hayCambios = computed(() => {
    const t = this.tienda();
    if (!t) return false;
    const c = this.cambios();
    return (
      c.slug !== t.slug || c.whatsapp !== t.whatsapp || c.descripcion !== t.descripcion || c.logoUrl !== t.logoUrl ||
      c.moneda !== t.moneda || c.mostrarAgotados !== t.mostrarAgotados
    );
  });
  protected readonly formValido = computed(() => this.slugValido() && this.whatsappValido());
  protected readonly puedePublicar = computed(() => this.formValido() && this.whatsapp() !== null);
  protected readonly falta = computed(() =>
    !this.slugValido() ? 'una dirección válida' : this.whatsapp() === null ? 'tu WhatsApp' : !this.whatsappValido() ? 'corregir tu WhatsApp' : '',
  );

  // ── Pasos ───────────────────────────────────────────────────────────
  private readonly productosActivos = computed(() => this.cat.productos().filter((p) => p.estado !== 'descontinuado').length);
  protected readonly pasos = computed(() => ({
    direccion: this.slugValido() && !!this.slug(),
    whatsapp: this.whatsapp() !== null && this.whatsappValido(),
    identidad: !!this.logoUrl() || !!this.descripcion().trim(),
    catalogo: this.productosActivos() > 0,
  }));
  protected readonly listos = computed(() => Object.values(this.pasos()).filter(Boolean).length);

  // ── Cabecera ────────────────────────────────────────────────────────
  protected readonly badge = computed(() => { const t = this.tienda(); return !t ? '' : t.activa ? 'Abierta' : t.guardada ? 'Pausada' : 'Sin publicar'; });
  protected readonly metricas = computed<MetricaCabecera[]>(() => {
    const r = this.resumen(), activos = this.productosActivos();
    const agotados = this.cat.productos().filter((p) => p.estado !== 'descontinuado' && (p.estado === 'agotado' || this.cat.stockDe(p.id).disponible - this.cat.stockDe(p.id).reservado <= 0)).length;
    const porConfirmar = r?.tiendaPorConfirmar ?? 0;
    return [
      { id: 'productos', etiqueta: 'En la vitrina', valor: this.mostrarAgotados() ? activos : activos - agotados, delta: pl(activos, 'producto activo', 'productos activos'), trazo: '#2be0d5' },
      { id: 'agotados', etiqueta: 'Agotados', valor: agotados, delta: this.mostrarAgotados() ? 'se ven como agotados' : 'escondidos', tono: agotados ? 'aviso' : 'neutro' },
      { id: 'pedidos', etiqueta: 'Pedidos por la tienda', valor: r ? (r.porCanal.tienda ?? 0) : '—', delta: r ? 'en total' : 'sin permiso para ver pedidos' },
      { id: 'confirmar', etiqueta: 'Por confirmar', valor: r ? porConfirmar : '—', delta: porConfirmar ? 'llegaron y esperan' : 'al día', tono: porConfirmar ? 'aviso' : 'exito' },
    ];
  });

  constructor() {
    this.cat.asegurar();
    this.tiendaService.mia().subscribe({
      next: (t) => { this.cargarFormulario(t); this.cargando.set(false); },
      error: (e) => { this.errorCarga.set(mensajeDeError(e, 'No pudimos cargar tu tienda.')); this.cargando.set(false); },
    });
    // Sin `pedidos.ver` el backend responde 403: las métricas de pedidos quedan en «—».
    this.pedidos.resumen().subscribe({ next: (r) => this.resumen.set(r), error: () => this.resumen.set(null) });
    // Pila «Cambios sin guardar», como en los demás módulos.
    effect(() => {
      const t = this.tienda();
      this.alertas.fijarCambios(
        t && this.hayCambios()
          ? {
              titulo: 'Cambios sin guardar',
              texto: this.formValido() ? 'Tu tienda' + (t.activa ? ' (ya publicada)' : '') : 'Revisa la dirección o el WhatsApp',
              estado: this.formValido() ? 'warning' : 'error',
              guardar: () => this.guardar(),
              descartar: () => this.cargarFormulario(t),
            }
          : null,
      );
    });
  }

  // ── Acciones ────────────────────────────────────────────────────────
  /** Desde la vitrina: lleva al paso y lo resalta. */
  protected irA(s: SeccionTienda): void {
    this.seccion.set(s);
    const paso = this.el.nativeElement.querySelector(`#paso-${s}`) as HTMLElement | null;
    paso?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => (paso?.querySelector('input:not([type=file]), textarea') as HTMLElement | null)?.focus({ preventScroll: true }), 350);
  }

  protected elegirMetrica(id: string): void {
    if (id === 'productos') void this.router.navigate(['/products']);
    else if (id === 'agotados') void this.router.navigate(['/products/inventario']);
    else if (this.resumen()) void this.router.navigate(['/orders'], { queryParams: { canal: 'tienda' } });
  }

  protected guardar(): void {
    if (!this.formValido()) {
      this.irA(!this.slugValido() ? 'direccion' : 'whatsapp');
      this.alertas.sacudir();
      return;
    }
    this.enviar(this.cambios(), 'Cambios guardados', 'Tu vitrina ya muestra lo nuevo');
  }

  protected publicar(activa: boolean): void {
    this.enviar(
      { ...this.cambios(), activa },
      activa ? '¡Tienda abierta!' : 'Tienda pausada',
      activa ? 'Comparte el enlace con tus clientes' : 'Nadie la ve hasta que la vuelvas a abrir',
    );
  }

  protected async copiar(): Promise<void> {
    const url = this.tienda()?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch {
      this.alertas.mostrar({ estado: 'info', titulo: 'Copia este enlace', texto: url });
    }
  }

  protected teclas(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && this.hayCambios()) {
      e.preventDefault();
      this.guardar();
    }
  }

  private enviar(cambios: CambiosTienda, titulo: string, texto: string): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    const id = this.alertas.mostrar({ titulo: 'Guardando tu tienda' });
    this.tiendaService.guardar(cambios).subscribe({
      next: (t) => {
        this.cargarFormulario(t);
        this.guardando.set(false);
        this.alertas.resolver(id, { estado: 'success', titulo, texto });
      },
      error: (e) => {
        this.guardando.set(false);
        this.alertas.resolver(id, { estado: 'error', titulo: 'No se pudo guardar', texto: mensajeDeError(e) });
      },
    });
  }

  private cargarFormulario(t: MiTienda): void {
    this.tienda.set(t);
    this.slug.set(t.slug);
    const w = t.whatsapp ?? '';
    if (w.startsWith('57') && w.length === 12) { this.pais.set('CO'); this.numero.set(w.slice(2)); }
    else if (w.startsWith('1') && w.length === 11) { this.pais.set('US'); this.numero.set(w.slice(1)); }
    else if (w) { this.pais.set('otro'); this.numero.set(w); }
    else this.numero.set('');
    this.descripcion.set(t.descripcion ?? '');
    this.logoUrl.set(t.logoUrl);
    this.moneda.set(t.moneda);
    this.mostrarAgotados.set(t.mostrarAgotados);
  }
}
