import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconArrowUpRight, IconBrandWhatsapp, IconBuildingStore, IconLink, TablerIconComponent } from '@tabler/icons-angular';
import { environment } from '../../environments/environment';
import { BurbujaDirective } from '../core/movimiento';
import { TiendaNoDisponible } from '../core/tienda.model';

/**
 * «Tienda no disponible» (referencia/Tienda no disponible.dc.html + estado pausada de la tienda v2).
 * - `no-existe`  → «Aquí no hay tienda» (también la ruta `**` / dirección vacía).
 * - `sin-publicar` → «Abre muy pronto».
 * - `pausada`    → «Volvemos pronto» con el nombre del negocio y su WhatsApp.
 */
@Component({
  selector: 'app-no-disponible',
  imports: [TablerIconComponent, BurbujaDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main data-screen-label="Tienda no disponible" class="flex min-h-dvh p-3">
      <section class="relative flex min-h-[calc(100dvh-24px)] flex-1 flex-col gap-7 overflow-hidden rounded-[36px] bg-bosque px-[clamp(24px,5vw,72px)] pb-[clamp(36px,6vw,72px)] pt-[clamp(20px,3vw,32px)] text-hoja">
        <div aria-hidden="true" burbuja="0.03,40,0.04" class="absolute right-[-12%] top-[-14%] size-[60vw] max-h-[820px] max-w-[820px]"><div class="animate-morph size-full bg-bosque-2"></div></div>
        <div aria-hidden="true" burbuja="0.08,60,0.14" class="absolute right-[20%] top-[22%] size-[15vw] min-h-[90px] min-w-[90px] max-h-[220px] max-w-[220px]"><div class="animate-morph-r size-full bg-teal"></div></div>
        <div aria-hidden="true" burbuja="0.1,50,0.18" class="absolute right-[9%] top-[36%] size-[5vw] min-h-[34px] min-w-[34px] max-h-[72px] max-w-[72px] opacity-90"><div class="size-full bg-wa [animation:morph_12s_ease-in-out_infinite]"></div></div>

        @if (motivo() !== 'pausada') {
          <header class="relative flex items-center justify-between gap-4">
            <a [href]="goodsInicio" class="flex items-center no-underline"><img src="logo-goods.png" alt="Goods" class="h-6 w-auto" /></a>
            <a [href]="goodsLogin" class="flex h-11 items-center gap-2 rounded-full bg-white/[.08] px-[18px] text-sm font-medium text-hoja no-underline hover:bg-white/[.14] hover:text-hoja">Iniciar sesión</a>
          </header>
        }

        <div class="relative mt-auto flex flex-col gap-[clamp(24px,3.5vw,40px)]">
          <p class="m-0 flex flex-wrap items-center gap-x-5 gap-y-2">
            @switch (motivo()) {
              @case ('no-existe') {
                <span class="flex items-center gap-2.5 text-[15px] font-medium text-coral"><span class="size-2 rounded-full bg-coral"></span>Tienda no encontrada</span>
              }
              @case ('sin-publicar') {
                <span class="flex items-center gap-2.5 text-[15px] font-medium text-[#ffd98a]">
                  <span class="relative flex size-2"><span class="animate-anillo absolute inset-0 rounded-full bg-[#ffd98a]"></span><span class="relative size-2 rounded-full bg-[#ffd98a]"></span></span>En preparación
                </span>
              }
              @case ('pausada') {
                <span class="flex items-center gap-2.5 text-[15px] font-medium text-coral"><span class="size-2 rounded-full bg-coral"></span>Tienda pausada</span>
              }
            }
            @if (motivo() !== 'pausada') {
              <span class="flex min-w-0 items-center gap-1.5 break-all text-[15px] text-salvia"><tabler-icon [icon]="i.link" [size]="17" [stroke]="2" />{{ url() }}</span>
            }
          </p>

          <h1 class="titular m-0 text-balance text-[clamp(64px,12vw,200px)] font-bold">
            @switch (motivo()) {
              @case ('no-existe') { Aquí no<br />hay tienda }
              @case ('sin-publicar') { Abre<br />muy pronto }
              @case ('pausada') { Volvemos<br />pronto }
            }
          </h1>

          <div class="flex flex-wrap items-center gap-x-8 gap-y-5">
            <p class="m-0 max-w-[44ch] text-pretty text-[17px] leading-[1.55] text-salvia">
              @switch (motivo()) {
                @case ('no-existe') { Revisa que el enlace esté bien escrito. Puede que la tienda haya cambiado de dirección o ya no esté disponible. }
                @case ('sin-publicar') { Esta tienda existe, pero todavía no está publicada. Vuelve en unos días o pídele el enlace actualizado al negocio. }
                @case ('pausada') { {{ nombre() ?? 'Este negocio' }} no está recibiendo pedidos en la tienda por ahora. Si necesitas algo, escríbeles directamente. }
              }
            </p>
            <div class="flex flex-wrap gap-2.5">
              @if (motivo() === 'pausada') {
                @if (whatsapp()) {
                  <a [href]="'https://wa.me/' + whatsapp()" target="_blank" rel="noopener" class="flex h-[52px] items-center gap-2 rounded-full bg-wa px-6 text-[15px] font-semibold text-noche no-underline hover:bg-wa-hover hover:text-noche"><tabler-icon [icon]="i.wa" [size]="20" [stroke]="2" />Escribir por WhatsApp</a>
                }
              } @else {
                <a [href]="goodsRegistro" class="flex h-[52px] items-center gap-2 rounded-full bg-wa px-6 text-[15px] font-semibold text-noche no-underline hover:bg-wa-hover hover:text-noche"><tabler-icon [icon]="i.tienda" [size]="20" [stroke]="2" />Crear mi tienda gratis</a>
                <a [href]="goodsInicio" class="flex h-[52px] items-center gap-2 rounded-full border border-[rgba(234,255,245,.22)] px-[22px] text-[15px] font-medium text-hoja no-underline hover:bg-white/[.08] hover:text-hoja">Ir a Goods<tabler-icon [icon]="i.diagonal" [size]="18" [stroke]="2" /></a>
              }
            </div>
          </div>
        </div>
      </section>
    </main>
  `,
})
export class NoDisponibleComponent {
  readonly motivo = input<TiendaNoDisponible['motivo']>('no-existe');
  readonly slug = input('');
  readonly nombre = input<string | null>(null);
  readonly whatsapp = input<string | null>(null);

  protected readonly i = { link: IconLink, wa: IconBrandWhatsapp, tienda: IconBuildingStore, diagonal: IconArrowUpRight };
  /** `goodsUrl` hoy apunta a /registro. TODO: separar `goodsInicio` y `goodsLogin` en environment. */
  protected readonly goodsRegistro = environment.goodsUrl;
  protected readonly goodsInicio = environment.goodsUrl.replace(/\/registro$/, '/');
  protected readonly goodsLogin = environment.goodsUrl.replace(/\/registro$/, '/login');
  protected readonly url = computed(() => `${location.host}/${this.slug() || ''}`);
}
