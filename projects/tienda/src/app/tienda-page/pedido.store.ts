import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { TiendaService } from '../core/tienda.service';
import { Entrega } from '../core/tienda.model';
import { ICONOS } from './iconos';
import { TiendaStore, guardar, leer } from './tienda.store';

/** 0 Tu pedido · 1 Entrega · 2 Tus datos · 3 Mensaje · 4 ¿Ya lo enviaste? · 5 Enviado. */
export type Paso = 0 | 1 | 2 | 3 | 4 | 5;

const PASOS_TITULO = ['Tu pedido', '¿Cómo lo recibes?', '¿A nombre de quién?', 'Así le llegará', 'Confirmar envío', ''];
/** Mismo tope que `PedidoWhatsappDto.nota` del backend. */
const MAX_NOTA = 300;

/**
 * Flujo de la isla «Tu pedido» (se provee junto a `TiendaStore` en la
 * página): 4 pasos hasta WhatsApp, más «¿Ya lo enviaste?» y «Enviado».
 * El mensaje lo arma el backend (`armarPedido`) con precios y stock del
 * momento; si el plan del negocio incluye Pedidos, además lo guarda.
 */
@Injectable()
export class PedidoStore {
  private readonly tiendaService = inject(TiendaService);
  private readonly st = inject(TiendaStore);

  readonly abierto = signal(false);
  readonly paso = signal<Paso>(0);
  readonly entrega = signal<Entrega>('recoger');
  readonly entregaElegida = signal(false);
  readonly direccion = signal('');
  readonly nombre = signal('');
  readonly telefono = signal('');
  readonly nota = signal('');
  readonly aceptaPromociones = signal(false);
  readonly faltaDir = signal(false);
  readonly faltaNombre = signal(false);
  readonly faltaTelefono = signal(false);
  readonly enviando = signal(false);
  private urlPedido: string | null = null;
  /**
   * Número del pedido que el backend ya guardó (null si el plan del negocio
   * no incluye Pedidos: ahí solo se arma el mensaje). Con pedido guardado el
   * carrito se vacía al instante y no hay «Volver»: reenviarlo lo duplicaría.
   */
  readonly pedidoGuardado = signal<number | null>(null);

  readonly nombreValido = computed(() => this.nombre().trim().length > 0);
  readonly telefonoValido = computed(() => /^[0-9]{7,15}$/.test(this.telefono().replace(/\D/g, '')));
  readonly esDomicilio = computed(() => this.entrega() === 'domicilio');

  /** Misma plantilla que `TiendaService.armarPedido` del backend (el número del pedido lo pone el backend). */
  readonly mensaje = computed(() => {
    const t = this.st.tienda();
    if (!t) return [];
    const m: { texto: string; negrita?: boolean }[] = [
      { texto: `Hola ${t.nombre}, quiero hacer este pedido:` }, { texto: '' },
      ...this.st.lineas().map((l) => ({ texto: `• ${l.cantidad} × ${l.producto.nombre} — ${this.st.monto(l.producto.precio * l.cantidad)}` })),
      { texto: '' }, { texto: `Total: ${this.st.monto(this.st.total())}`, negrita: true }, { texto: '' },
      { texto: `Mi nombre: ${this.nombre().trim() || '…'}` },
      { texto: this.esDomicilio() ? `Entrega a domicilio: ${this.direccion().trim()}` : 'Recojo en la tienda' },
    ];
    if (this.nota().trim()) m.push({ texto: `Nota: ${this.nota().trim()}` });
    if (this.aceptaPromociones()) m.push({ texto: '' }, { texto: `✅ Acepto recibir novedades y promociones de ${t.nombre} por WhatsApp.` });
    return m;
  });

  readonly tituloPaso = computed(() => PASOS_TITULO[this.paso()]);
  readonly subPaso = computed(() => {
    const u = cuenta(this.st.unidades()), tot = this.st.monto(this.st.total()), a = this.st.ahorro();
    return [
      a > 0 ? `${u} · ${tot} · ahorras ${this.st.monto(a)}` : `${u} · ${tot}`,
      'Recógelo en la tienda o te lo enviamos',
      'Solo se usa para tu pedido',
      'Revisa el mensaje antes de enviarlo',
      'Último paso',
      '',
    ][this.paso()];
  });
  readonly pasoNum = computed(() => String(Math.min(this.paso(), 3) + 1).padStart(2, '0'));
  readonly riel = computed(() => {
    const p = this.paso(), dom = this.esDomicilio();
    return [
      { icono: ICONOS.bolsa, texto: cuenta(this.st.unidades()) },
      { icono: dom ? ICONOS.camion : ICONOS.tienda, texto: this.entregaElegida() || p > 1 ? (dom ? 'Domicilio' : 'Recoger') : 'Entrega' },
      { icono: ICONOS.usuario, texto: 'Tus datos' },
      { icono: ICONOS.wa, texto: 'Mensaje' },
    ].map((r, k) => ({ ...r, k, actual: k === p, hecho: k < p }));
  });

  /** La isla: barra flotante cerrada ↔ hoja abierta. En móvil cerrada se corre 44 px a la izquierda para no tapar «Volver arriba». */
  readonly isla = computed(() => {
    const ab = this.abierto(), mv = this.st.movil();
    const visible = ab || (this.st.unidades() > 0 && this.st.trasHero());
    const dx = mv && !ab ? 'calc(-50% - 44px)' : '-50%';
    const mostrar = visible && !this.st.detalle();
    return {
      w: ab ? (mv ? '100vw' : 'min(580px, calc(100vw - 24px))') : mv ? 'min(300px, calc(100vw - 112px))' : '300px',
      h: ab ? (mv ? '92vh' : 'min(760px, calc(100vh - 100px))') : '62px',
      r: ab ? (mv ? '28px 28px 0 0' : '36px') : '999px',
      b: ab && mv ? '0px' : '20px',
      t: mostrar ? `translateX(${dx})` : `translate(${dx}, 160%)`,
      o: mostrar ? 1 : 0,
    };
  });

  constructor() {
    effect(() => guardar('goods.tienda.nombre', this.nombre()));
    effect(() => guardar('goods.tienda.telefono', this.telefono()));
    this.st.alCargar((t) => {
      this.nombre.set(leer('goods.tienda.nombre') ?? '');
      this.telefono.set(leer('goods.tienda.telefono') ?? '');
      if (!t.direccionTienda) this.entrega.set('domicilio');
    });
  }

  resumenLineas(): string {
    const u = this.st.unidades(), n = this.st.lineas().length;
    return `${u} ${u === 1 ? 'unidad' : 'unidades'} · ${n} ${n === 1 ? 'referencia' : 'referencias'}`;
  }
  cuentaTxt(): string { return cuenta(this.st.unidades()); }
  inicialNombre(): string { return (this.nombre().trim().charAt(0) || '?').toUpperCase(); }

  // ── Navegación de la isla ─────────────────────────────────────────────
  abrirPedido(): void {
    this.reiniciarSiTermino();
    this.abierto.set(true);
  }
  cerrarPedido(): void {
    this.abierto.set(false);
    this.reiniciarSiTermino();
  }
  /** Tras enviar (paso 5) o con el pedido ya guardado (paso 4), la isla vuelve a «Tu pedido». */
  private reiniciarSiTermino(): void {
    if (this.paso() === 5 || (this.paso() === 4 && this.pedidoGuardado() !== null)) {
      this.paso.set(0);
      this.pedidoGuardado.set(null);
    }
  }
  volver(): void { if (this.paso() <= 3) this.paso.update((p) => Math.max(0, p - 1) as Paso); }
  irPaso(k: number): void { if (k < this.paso() && this.paso() <= 3) this.paso.set(k as Paso); }

  elegirEntrega(e: Entrega): void {
    this.entrega.set(e); this.entregaElegida.set(true); this.faltaDir.set(false);
    if (e === 'domicilio') this.enfocarDir();
  }
  private enfocarDir(): void {
    setTimeout(() => {
      const el = this.st.refs.dir?.()?.nativeElement;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.closest<HTMLElement>('[data-scroll]')?.scrollTo({ top: 99999, behavior: 'smooth' });
    }, 80);
  }

  continuar(): void {
    const p = this.paso();
    if (p === 0) return this.paso.set(1);
    if (p === 1) {
      if (this.esDomicilio() && !this.direccion().trim()) { this.faltaDir.set(true); this.enfocarDir(); return; }
      this.entregaElegida.set(true);
      this.paso.set(2);
      setTimeout(() => this.st.refs.nombre?.()?.nativeElement.focus({ preventScroll: true }), 650);
      return;
    }
    if (p === 2) {
      this.faltaNombre.set(!this.nombreValido());
      this.faltaTelefono.set(!this.telefonoValido());
      if (this.nombreValido() && this.telefonoValido()) this.paso.set(3);
    }
  }
  agregarNota(t: string): void {
    this.nota.update((n) => (n.trim() ? `${n.trim()}, ${t.toLowerCase()}` : t).slice(0, MAX_NOTA));
  }

  /**
   * Paso 3 → el backend arma el mensaje (y guarda el pedido) → abre WhatsApp en otra pestaña → paso 4.
   *
   * @remarks
   * La pestaña se abre antes de la petición para que el navegador no la bloquee.
   * Errores: 409 recarga la tienda y vuelve al paso 0 con el aviso; 404 muestra
   * «no disponible»; 400/429 vuelven a «Tus datos» con el mensaje del servidor.
   */
  enviar(): void {
    const t = this.st.tienda();
    if (!t || !this.st.lineas().length || this.enviando()) return;
    const ventana = window.open('', '_blank');
    this.enviando.set(true);
    this.st.errorPedido.set(null);
    this.tiendaService
      .armarPedido(t.slug, {
        items: this.st.lineas().map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })),
        nombre: this.nombre().trim(),
        telefono: this.telefono().replace(/\D/g, ''),
        nota: this.nota().trim() || undefined,
        entrega: this.entrega(),
        direccion: this.esDomicilio() ? this.direccion().trim() : undefined,
        aceptaPromociones: this.aceptaPromociones() || undefined,
      })
      .subscribe({
        next: (pedido) => {
          this.enviando.set(false);
          this.urlPedido = pedido.url;
          if (pedido.numero !== null) {
            // Ya quedó en el panel del negocio: el carrito se vacía ya, no al confirmar.
            this.pedidoGuardado.set(pedido.numero);
            this.st.carrito.set(new Map());
            this.nota.set('');
          }
          if (ventana) ventana.location.href = pedido.url;
          else window.location.href = pedido.url;
          setTimeout(() => this.paso.set(4), 300);
        },
        error: (e: HttpErrorResponse) => {
          ventana?.close();
          this.enviando.set(false);
          if (e.status === 409) {
            this.st.errorPedido.set(e.error?.message ?? 'Algo de tu pedido cambió. Revísalo y vuelve a enviarlo.');
            this.st.cargar(t.slug, true);
            this.paso.set(0);
          } else if (e.status === 404) {
            this.st.estado.set('no-disponible');
          } else if (e.status === 400 || e.status === 429) {
            const m = e.error?.message;
            this.st.errorPedido.set((Array.isArray(m) ? m[0] : m) ?? 'Revisa tu nombre y tu celular.');
            this.paso.set(2);
          } else {
            this.st.errorPedido.set('No pudimos preparar el mensaje. Revisa tu conexión y vuelve a intentarlo.');
          }
        },
      });
  }
  abrirOtraVez(): void { if (this.urlPedido) window.open(this.urlPedido, '_blank'); }
  /** «Sí, ya lo envié»: vacía el carrito y la nota y pasa a «Enviado». */
  confirmarEnvio(): void {
    this.st.carrito.set(new Map());
    this.nota.set('');
    this.pedidoGuardado.set(null);
    this.paso.set(5);
  }
  seguirComprando(): void { this.abierto.set(false); this.paso.set(0); this.pedidoGuardado.set(null); }
}

export function cuenta(n: number): string { return `${n} ${n === 1 ? 'producto' : 'productos'}`; }
