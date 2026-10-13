import { ChangeDetectionStrategy, Component } from '@angular/core';
import { environment } from '../../environments/environment';

/** Raíz o dirección vacía: no hay una tienda que mostrar. */
@Component({
  selector: 'app-sin-tienda',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <h1 class="font-display text-3xl font-bold leading-tight">Falta la dirección de la tienda</h1>
      <p class="mt-3 text-gris">
        Abre el enlace completo que te compartió el negocio. Se ve así: <span class="font-medium text-tinta">{{ ejemplo }}</span>
      </p>
      <p class="mt-8 text-sm text-gris">
        ¿Tienes un negocio y quieres tu propia tienda?
        <a [href]="goodsUrl" class="font-medium text-tinta underline underline-offset-2">Conoce Goods</a>
      </p>
    </main>
  `,
})
export class SinTiendaComponent {
  protected readonly goodsUrl = environment.goodsUrl;
  protected readonly ejemplo = `${location.host}/nombre-del-negocio`;
}
