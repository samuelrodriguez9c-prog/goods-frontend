import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IconArrowUpRight,
  IconMinus,
  IconPackage,
  IconPlus,
  IconReceipt,
  IconSend,
  IconSparkles,
  IconSpeakerphone,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { FichaCliente } from '../../../../../../core/cliente/models/cliente.model';
import { Conversacion, ProductoMostrador } from '../../../../../../core/whatsapp/whatsapp.model';
import { cop } from '../../../../shared/secciones';
import { claseAvatar, copCorto, fechaCorta, hhmm, iniciales, mesAnio, nombreChat, stockTexto } from '../../bandeja.utils';
import { IaMarcaComponent } from '../../../../../../shared/ui/ia-marca/ia-marca.component';

const ESTADOS: Record<string, string> = {
  pendiente: 'Nuevo',
  confirmado: 'Confirmado',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  devuelto: 'Devuelto',
};

/**
 * Panel del cliente a la derecha de la conversación (se abre y se cierra con
 * el botón de la cabecera del chat): quién es y cuánto compra, si acepta
 * promociones, el pedido en curso (ticket en borrador → "Crear pedido y
 * enviar resumen"), lo que mencionó en el chat y su historial de pedidos.
 */
@Component({
  selector: 'app-panel-cliente',
  imports: [IaMarcaComponent, TablerIconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel-cliente.component.html',
  host: {
    class:
      'top-0 right-0 bottom-0 z-[15] flex shrink-0 overflow-hidden rounded-[14px] bg-white [transition:width_.42s_cubic-bezier(.32,.72,0,1),margin_.42s_cubic-bezier(.32,.72,0,1),opacity_.3s_ease,transform_.42s_cubic-bezier(.32,.72,0,1),box-shadow_.3s]',
    '[class]': 'clasesHost()',
    '[attr.aria-hidden]': '!visible()',
  },
})
export class PanelClienteComponent {
  readonly chat = input.required<Conversacion>();
  /** undefined = cargando; null = todavía no es cliente. */
  readonly ficha = input<FichaCliente | null | undefined>(undefined);
  readonly productos = input<ProductoMostrador[]>([]);
  readonly interes = input<number[]>([]);
  readonly borrador = input<Record<number, number>>({});
  readonly ahora = input(Date.now());
  readonly visible = input(true);
  /** Columna fija (pantalla ancha) o panel flotante sobre el chat. */
  readonly fijo = input(true);
  readonly creando = input(false);
  readonly puedeResponder = input(false);
  readonly puedeCrearPedido = input(true);
  readonly ventanaAbierta = input(true);

  readonly alternarPromociones = output<void>();
  readonly cambiarCantidad = output<{ productoId: number; delta: number }>();
  readonly crearPedido = output<void>();
  readonly mostrarProducto = output<number>();

  protected readonly i = {
    abrir: IconArrowUpRight,
    promo: IconSpeakerphone,
    menos: IconMinus,
    mas: IconPlus,
    pedido: IconReceipt,
    enviar: IconSend,
    ia: IconSparkles,
    producto: IconPackage,
  };

  /** Recrea el contenido al cambiar de chat para la entrada en cascada. */
  protected readonly clave = computed(() => this.chat().id);

  protected readonly clasesHost = computed(() => {
    const v = this.visible();
    const base = this.fijo()
      ? `relative shadow-[0_1px_0_rgba(0,0,0,.07),0_0_0_1px_rgba(0,0,0,.05)] ${v ? 'w-[300px] ml-0' : 'w-0 -ml-3'}`
      : `absolute w-[300px] shadow-[0_0_0_1px_rgba(0,0,0,.06),0_24px_48px_-16px_rgba(0,0,0,.35)] ${v ? '[transform:none]' : '[transform:translateX(24px)]'}`;
    return `${base} ${v ? 'opacity-100' : 'pointer-events-none opacity-0'}`;
  });

  protected readonly cabecera = computed(() => {
    const c = this.chat();
    const f = this.ficha();
    return {
      nombre: nombreChat(c),
      ini: iniciales(c),
      avatar: claseAvatar(c),
      desde: f === undefined ? ' ' : f ? `Cliente desde ${mesAnio(f.creadoEn)}` : 'Todavía no es cliente',
    };
  });

  protected readonly stats = computed(() => {
    const f = this.ficha();
    const n = f?.cantidadPedidos ?? 0;
    return [
      { k: 'Pedidos', v: f === undefined ? '…' : String(n), tip: 'Pedidos que hizo (todos los canales)' },
      { k: 'En compras', v: f && f.totalGastado ? copCorto(f.totalGastado) : f === undefined ? '…' : '—', tip: 'Sin contar cancelados ni devueltos' },
      { k: 'Ticket', v: f && n && f.totalGastado ? copCorto(f.totalGastado / n) : f === undefined ? '…' : '—', tip: 'Promedio por pedido' },
    ];
  });

  private readonly porId = computed(() => new Map(this.productos().map((p) => [p.id, p])));

  protected readonly lineas = computed(() => {
    const m = this.porId();
    return Object.entries(this.borrador())
      .map(([id, n]) => ({ p: m.get(Number(id)), n }))
      .filter((l): l is { p: ProductoMostrador; n: number } => !!l.p && l.n > 0)
      .map((l) => ({ ...l, unidad: cop(l.p.precio), sub: cop(l.p.precio * l.n) }));
  });

  protected readonly unidades = computed(() => this.lineas().reduce((a, l) => a + l.n, 0));
  protected readonly total = computed(() => cop(this.lineas().reduce((a, l) => a + l.p.precio * l.n, 0)));
  protected readonly horaBorrador = computed(() => hhmm(new Date(this.ahora())));

  protected readonly mencionados = computed(() => {
    const m = this.porId();
    return this.interes()
      .map((id) => m.get(id))
      .filter((p): p is ProductoMostrador => !!p)
      .map((p) => ({ p, precio: cop(p.precio), stock: stockTexto(p), agotado: p.stock === 0 }));
  });

  protected readonly pedidos = computed(() =>
    (this.ficha()?.ultimosPedidos ?? []).slice(0, 3).map((p) => ({
      id: p.id,
      numero: p.numero,
      fecha: fechaCorta(p.creadoEn),
      estado: ESTADOS[p.estado] ?? p.estado,
      total: cop(Number(p.total)),
      nuevo: p.estado === 'pendiente',
    })),
  );
}
