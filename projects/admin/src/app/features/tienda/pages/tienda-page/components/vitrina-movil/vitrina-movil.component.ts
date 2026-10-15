import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CatalogoStore } from '../../../../../products/shared/catalogo.store';
import { iniciales, norm } from '../../../../../products/shared/formato';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { MonedaTienda } from '../../../../../../core/tienda/tienda.service';

export type SeccionTienda = 'direccion' | 'whatsapp' | 'identidad' | 'catalogo';

/**
 * Vista previa en vivo de la tienda dentro de un celular. Lo que se escribe
 * en el editor aparece al instante (la dirección destella al cambiar).
 *
 * Es interactiva:
 * - tocar la dirección, el logo, el nombre o la frase lleva a su paso del
 *   editor (con el borde punteado turquesa al pasar el cursor);
 * - las categorías filtran y el «+» arma un carrito de prueba;
 * - «Pedir por WhatsApp» muestra el chat con el mensaje tal como le llega
 *   al negocio. No se envía nada.
 */
@Component({
  selector: 'app-vitrina-movil',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col items-center' },
  template: `
    <div class="relative w-[330px] rounded-[46px] bg-[#141414] p-[10px] shadow-[inset_0_0_0_1.5px_#2c2c2c,0_30px_60px_-30px_rgba(0,0,0,.55),0_10px_22px_-14px_rgba(0,0,0,.35)]">
      <span class="absolute top-[110px] -left-[3px] h-9 w-[3px] rounded-l bg-[#2a2a2a]"></span>
      <span class="absolute top-[160px] -left-[3px] h-14 w-[3px] rounded-l bg-[#2a2a2a]"></span>
      <span class="absolute top-[140px] -right-[3px] h-16 w-[3px] rounded-r bg-[#2a2a2a]"></span>
      <div class="relative flex h-[640px] flex-col overflow-hidden rounded-[36px] bg-white">
        <!-- Barra de estado -->
        <div class="relative flex h-11 shrink-0 items-center justify-between px-7 text-[12px] font-semibold"
          [class]="vista() === 'chat' ? 'bg-[#008069] text-white' : 'text-[#111827]'">
          <span>9:41</span>
          <span class="absolute top-2.5 left-1/2 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black"></span>
          <span class="flex items-center gap-1"><app-ic nombre="world" [size]="12" /><span class="h-[10px] w-5 rounded-[3px] border border-current p-px"><span class="block h-full w-3/4 rounded-[1px] bg-current"></span></span></span>
        </div>

        @if (vista() === 'tienda') {
          <!-- Barra de dirección -->
          <button type="button" (click)="tocar.emit('direccion')" title="Editar la dirección"
            class="mx-3 mb-2 flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] bg-[#f1f1f1] px-3 text-[11.5px] text-[#6b7280] outline-1 outline-offset-2 outline-transparent outline-dashed transition-[outline-color] hover:outline-[#2be0d5]">
            <app-ic nombre="lock" [size]="11" />
            <span class="min-w-0 truncate">{{ prefijo() }}@for (k of [slug()]; track k) {<span class="rounded-[3px] font-semibold text-[#111827] animate-[destello_1.1s_ease-out]">{{ slug() || 'tu-tienda' }}</span>}</span>
          </button>

          <div class="relative min-h-0 flex-1 overflow-y-auto [scrollbar-width:none]">
            @if (!activa()) {
              <div class="mx-3 mb-2 flex items-center gap-2 rounded-[10px] bg-[#fff6d1] px-3 py-2 text-[11px] text-[#8a5a00]">
                <app-ic nombre="eye" [size]="13" />Vista previa · tus clientes aún no la ven
              </div>
            }
            <!-- Portada -->
            <div class="relative mx-3 h-[86px] overflow-hidden rounded-[18px] bg-[radial-gradient(120%_140%_at_0%_0%,#2be0d5_0%,#00857e_45%,#0b3b38_100%)]">
              <span class="absolute -top-6 -right-6 size-24 rounded-full bg-white/10"></span>
              <span class="absolute right-10 -bottom-8 size-20 rounded-full bg-white/10"></span>
            </div>
            <div class="relative z-[1] -mt-8 flex flex-col items-center px-5 text-center">
              <button type="button" (click)="tocar.emit('identidad')" title="Cambiar el logo"
                class="flex size-16 cursor-pointer items-center justify-center overflow-hidden rounded-[20px] bg-white font-[Archivo] text-[22px] font-semibold text-[#00605b] shadow-[0_0_0_4px_#fff,0_8px_18px_-8px_rgba(0,0,0,.35)] outline-1 outline-offset-4 outline-transparent outline-dashed transition-[outline-color] hover:outline-[#2be0d5]">
                @if (logoUrl()) {
                  <img [src]="logoUrl()" alt="" class="size-full object-cover" />
                } @else {
                  {{ inicial() }}
                }
              </button>
              <button type="button" (click)="tocar.emit('identidad')" class="mt-2.5 cursor-pointer rounded-md px-1 outline-1 outline-offset-2 outline-transparent outline-dashed transition-[outline-color] hover:outline-[#2be0d5]">
                <span class="block font-[Archivo] text-[18px] leading-6 font-semibold tracking-[-.01em] text-[#111827]">{{ nombre() }}</span>
              </button>
              <button type="button" (click)="tocar.emit('identidad')" class="mt-1 cursor-pointer rounded-md px-1 outline-1 outline-offset-2 outline-transparent outline-dashed transition-[outline-color] hover:outline-[#2be0d5]">
                <span class="block text-[12px] leading-[17px] text-pretty" [class]="descripcion() ? 'text-[#6b7280]' : 'text-[#c4c4c4] italic'">{{ descripcion() || 'Toca para escribir una frase sobre tu negocio' }}</span>
              </button>
              <span class="mt-2 inline-flex items-center gap-1 rounded-full bg-[#e6f6ec] px-2.5 py-0.5 text-[10.5px] font-medium text-[#087b5d]">
                <app-ic nombre="whatsapp" [size]="11" />Pedidos por WhatsApp
              </span>
            </div>

            <!-- Categorías -->
            @if (categorias().length > 1) {
              <div class="mt-4 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
                @for (c of categorias(); track c.id) {
                  <button type="button" (click)="categoria.set(c.id)"
                    class="h-7 shrink-0 cursor-pointer rounded-full px-3 text-[11.5px] font-medium whitespace-nowrap transition-colors duration-200"
                    [class]="categoria() === c.id ? 'bg-[#111827] text-white' : 'bg-[#f1f1f1] text-[#4b5563]'">{{ c.nombre }}</button>
                }
              </div>
            }

            <!-- Productos -->
            @if (productos().length) {
              <div class="grid grid-cols-2 gap-2.5 px-3 pt-3 pb-24">
                @for (p of productos(); track p.id; let i = $index) {
                  @let n = carrito()[p.id] ?? 0;
                  <div class="flex flex-col gap-1.5" [style.animation]="'mov-in 320ms cubic-bezier(.2,.8,.2,1) ' + Math.min(i, 8) * 35 + 'ms both'">
                    <div class="relative aspect-square overflow-hidden rounded-[14px]" [style.background-color]="p.fondo" [style.color]="p.tinta" [class.opacity-55]="p.agotado">
                      @if (p.url) {
                        <img [src]="p.url" alt="" class="size-full object-cover" />
                      } @else {
                        <span class="flex size-full items-center justify-center"><app-ic [nombre]="p.icono" [size]="26" [stroke]="1.6" /></span>
                      }
                      @if (p.agotado) {
                        <span class="absolute top-1.5 left-1.5 rounded-full bg-white/90 px-2 text-[10px] leading-[18px] font-semibold text-[#b42318]">Agotado</span>
                      } @else if (n) {
                        <span class="absolute right-1.5 bottom-1.5 flex items-center gap-0.5 rounded-full bg-[#111827] p-0.5 text-white shadow-[0_4px_10px_-4px_rgba(0,0,0,.5)]">
                          <button type="button" (click)="cambiar(p.id, -1)" class="flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-white/15"><app-ic nombre="minus" [size]="12" /></button>
                          <span class="min-w-3 text-center text-[11px] font-semibold tabular-nums">{{ n }}</span>
                          <button type="button" (click)="cambiar(p.id, 1)" class="flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-white/15"><app-ic nombre="plus" [size]="12" /></button>
                        </span>
                      } @else {
                        <button type="button" (click)="cambiar(p.id, 1)" title="Agregar"
                          class="absolute right-1.5 bottom-1.5 flex size-7 cursor-pointer items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_4px_10px_-4px_rgba(0,0,0,.4)] transition-transform duration-200 hover:scale-110 active:scale-95">
                          <app-ic nombre="plus" [size]="14" [stroke]="2.2" />
                        </button>
                      }
                    </div>
                    <span class="line-clamp-2 text-[11.5px] leading-[15px] font-medium text-[#111827]">{{ p.nombre }}</span>
                    <span class="text-[12px] font-semibold text-[#111827] tabular-nums">{{ precio(p.precio) }}</span>
                  </div>
                }
              </div>
            } @else {
              <button type="button" (click)="tocar.emit('catalogo')"
                class="mx-3 mt-4 mb-24 flex w-[calc(100%-24px)] cursor-pointer flex-col items-center gap-2 rounded-[16px] border border-dashed border-[#e0e0e0] px-4 py-8 text-center text-[12px] text-[#8a8a8a] hover:border-[#2be0d5]">
                <app-ic nombre="package" [size]="22" class="text-[#c4c4c4]" />
                {{ cargando() ? 'Cargando tu catálogo…' : 'Aquí aparecen tus productos activos' }}
              </button>
            }
          </div>

          <!-- Carrito -->
          <div class="pointer-events-none absolute inset-x-3 bottom-5 flex justify-center">
            @if (unidades()) {
              <button type="button" (click)="pedir()"
                class="pointer-events-auto flex h-12 w-full animate-[fade-in-up_.25s_ease-out] cursor-pointer items-center gap-2.5 rounded-[16px] bg-[#111827] pr-2 pl-3.5 text-left text-white shadow-[0_14px_28px_-12px_rgba(0,0,0,.6)] transition-transform duration-200 active:scale-[.98]">
                <span class="flex size-7 items-center justify-center rounded-full bg-[#25d366] text-white"><app-ic nombre="whatsapp" [size]="15" /></span>
                <span class="flex min-w-0 flex-1 flex-col leading-tight">
                  <span class="text-[12.5px] font-semibold">Pedir por WhatsApp</span>
                  <span class="text-[10.5px] text-white/60">{{ unidades() }} {{ unidades() === 1 ? 'producto' : 'productos' }}</span>
                </span>
                <span class="rounded-[10px] bg-white/10 px-2.5 py-1.5 text-[12.5px] font-semibold tabular-nums">{{ precio(total()) }}</span>
              </button>
            }
          </div>
        } @else {
          <!-- Chat de WhatsApp: así le llega el pedido al negocio -->
          <div class="flex shrink-0 items-center gap-2.5 bg-[#008069] px-3 pb-2.5 text-white">
            <button type="button" (click)="vista.set('tienda')" title="Volver a la tienda" class="flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-white/15">
              <app-ic nombre="arrow-left" [size]="17" />
            </button>
            <span class="flex size-8 items-center justify-center overflow-hidden rounded-full bg-white/90 font-[Archivo] text-[13px] font-semibold text-[#00605b]">
              @if (logoUrl()) {
                <img [src]="logoUrl()" alt="" class="size-full object-cover" />
              } @else {
                {{ inicial() }}
              }
            </span>
            <span class="flex min-w-0 flex-col leading-tight">
              <span class="truncate text-[13px] font-semibold">{{ nombre() }}</span>
              <span class="truncate text-[10.5px] text-white/75">{{ numeroVisible() || 'Sin número' }}</span>
            </span>
          </div>
          <div class="relative min-h-0 flex-1 overflow-y-auto bg-[#efeae2] px-3 py-4 [scrollbar-width:none] [background-image:radial-gradient(rgba(0,0,0,.035)_1px,transparent_1px)] [background-size:14px_14px]">
            <div class="mx-auto mb-3 w-fit rounded-lg bg-white/80 px-2.5 py-1 text-[10.5px] text-[#54656f] shadow-[0_1px_0_rgba(0,0,0,.05)]">HOY</div>
            <div class="ml-auto max-w-[88%] animate-[fade-in-up_.3s_ease-out] rounded-[10px] rounded-tr-[2px] bg-[#d9fdd3] px-2.5 pt-1.5 pb-1 text-[12px] leading-[17px] whitespace-pre-wrap text-[#111b21] shadow-[0_1px_0_rgba(0,0,0,.08)]">{{ mensaje() }}<span class="mt-0.5 flex items-center justify-end gap-0.5 text-[9.5px] text-[#667781]">9:41 <app-ic nombre="checks" [size]="12" class="text-[#53bdeb]" /></span></div>
            <p class="mx-auto mt-4 max-w-[240px] text-center text-[10.5px] leading-[15px] text-[#54656f]">
              Así te llega cada pedido de la tienda. En Goods lo ves en Pedidos como «Por confirmar».
            </p>
          </div>
          <div class="flex shrink-0 gap-2 border-t border-[#e9e5de] bg-[#f0f2f5] px-3 pt-2.5 pb-5">
            <button type="button" (click)="vaciar()" class="h-9 flex-1 cursor-pointer rounded-full bg-white text-[12px] font-medium text-[#303030] shadow-[inset_0_0_0_1px_#e3e3e3]">Vaciar carrito</button>
            <button type="button" (click)="vista.set('tienda')" class="h-9 flex-1 cursor-pointer rounded-full bg-[#008069] text-[12px] font-medium text-white">Seguir comprando</button>
          </div>
        }
        <span class="pointer-events-none absolute bottom-1.5 left-1/2 h-[4px] w-[110px] -translate-x-1/2 rounded-full" [class]="vista() === 'chat' ? 'bg-[#111827]/80' : 'bg-[#111827]'"></span>
      </div>
    </div>
    @if (!whatsapp() && unidades()) {
      <button type="button" (click)="tocar.emit('whatsapp')" class="mt-3 cursor-pointer text-[12px] font-medium text-[#b45309] underline-offset-2 hover:underline">
        Falta tu WhatsApp: ahí te llegan estos pedidos
      </button>
    } @else {
      <p class="m-0 mt-3 text-center text-[11.5px] text-[#8a8a8a]">Toca el logo, el nombre o la dirección para editarlos · el «+» arma un pedido de prueba</p>
    }
  `,
})
export class VitrinaMovilComponent {
  private readonly cat = inject(CatalogoStore);
  readonly nombre = input('Tu negocio');
  readonly logoUrl = input<string | null>(null);
  readonly descripcion = input('');
  readonly moneda = input<MonedaTienda>('COP');
  readonly mostrarAgotados = input(true);
  readonly prefijo = input('');
  readonly slug = input('');
  /** Solo dígitos con indicativo, o null. */
  readonly whatsapp = input<string | null>(null);
  readonly activa = input(false);
  readonly tocar = output<SeccionTienda>();

  protected readonly Math = Math;
  protected readonly vista = signal<'tienda' | 'chat'>('tienda');
  protected readonly categoria = signal<number | 'todo'>('todo');
  protected readonly carrito = signal<Partial<Record<number, number>>>({});
  protected readonly cargando = computed(() => this.cat.cargando() && !this.cat.cargado());
  protected readonly inicial = computed(() => iniciales(this.nombre()).slice(0, 1) || 'T');

  /** Los activos del catálogo (y los agotados si se muestran). */
  private readonly todos = computed(() =>
    this.cat
      .productos()
      .filter((p) => p.estado !== 'descontinuado')
      .map((p) => {
        const s = this.cat.stockDe(p.id), raiz = this.cat.raiz(this.cat.categoria(p.categoriaId));
        const [fondo, tinta, icono] = this.cat.tono(raiz?.id);
        return {
          id: p.id, nombre: p.nombre, precio: p.precio, raizId: raiz?.id ?? null, raizNombre: raiz?.nombre ?? 'Otros',
          agotado: p.estado === 'agotado' || s.disponible - s.reservado <= 0,
          url: [...p.imagenes].sort((a, b) => a.orden - b.orden)[0]?.url ?? null, fondo, tinta, icono,
        };
      })
      .filter((p) => this.mostrarAgotados() || !p.agotado)
      .sort((a, b) => Number(a.agotado) - Number(b.agotado) || a.nombre.localeCompare(b.nombre, 'es')),
  );
  protected readonly categorias = computed(() => {
    const m = new Map<number, string>();
    this.todos().forEach((p) => p.raizId != null && m.set(p.raizId, p.raizNombre));
    return [{ id: 'todo' as const, nombre: 'Todo' }, ...[...m].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)))];
  });
  protected readonly productos = computed(() => {
    const c = this.categoria();
    return this.todos().filter((p) => c === 'todo' || p.raizId === c);
  });

  private readonly lineas = computed(() =>
    this.todos().flatMap((p) => { const n = this.carrito()[p.id] ?? 0; return n ? [{ n, p }] : []; }),
  );
  protected readonly unidades = computed(() => this.lineas().reduce((a, l) => a + l.n, 0));
  protected readonly total = computed(() => this.lineas().reduce((a, l) => a + l.n * l.p.precio, 0));
  protected readonly numeroVisible = computed(() => {
    const w = this.whatsapp();
    if (!w) return '';
    const m = /^(57|1)(\d{3})(\d{3})(\d{4})$/.exec(w);
    return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : '+' + w;
  });
  protected readonly mensaje = computed(() =>
    [
      `¡Hola, ${this.nombre()}! Quiero hacer este pedido:`,
      '',
      ...this.lineas().map((l) => `• ${l.n} × ${l.p.nombre} — ${this.precio(l.n * l.p.precio)}`),
      '',
      `*Total: ${this.precio(this.total())}*`,
    ].join('\n'),
  );

  protected precio(n: number): string {
    return this.moneda() === 'USD'
      ? 'US$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '$' + Math.round(n).toLocaleString('es-CO');
  }

  protected cambiar(id: number, d: number): void {
    this.carrito.update((c) => {
      const n = Math.max(0, (c[id] ?? 0) + d), { [id]: _, ...resto } = c;
      return n ? { ...resto, [id]: n } : resto;
    });
  }

  protected pedir(): void {
    if (!this.whatsapp()) { this.tocar.emit('whatsapp'); return; }
    this.vista.set('chat');
  }

  protected vaciar(): void {
    this.carrito.set({});
    this.vista.set('tienda');
  }
}
