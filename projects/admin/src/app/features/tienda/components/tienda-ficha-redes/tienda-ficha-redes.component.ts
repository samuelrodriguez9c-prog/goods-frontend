import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconAt, IconBrandFacebook, IconBrandInstagram, IconBrandTiktok, IconExternalLink, TablerIconComponent } from '@tabler/icons-angular';
import { REDES, Red, redValida, usuarioDeRed } from '../../shared/tienda-config.modelo';
import { TiendaConfigStore } from '../../shared/tienda-config.store';
import { TiendaCabezaComponent } from '../tienda-cabeza/tienda-cabeza.component';

/**
 * Tarjeta · Redes: el usuario de Instagram, Facebook y TikTok.
 * Se puede pegar el enlace del perfil o escribirlo con @; al salir del campo
 * queda solo el usuario. Los íconos salen en el pie de la tienda pública.
 */
@Component({
  selector: 'app-tienda-ficha-redes',
  imports: [FormsModule, TablerIconComponent, TiendaCabezaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-ficha-redes.component.html',
  host: { class: 'contents' },
})
export class TiendaFichaRedesComponent {
  protected readonly s = inject(TiendaConfigStore);
  protected readonly redes = REDES;
  protected readonly i = { arroba: IconAt, abrir: IconExternalLink };
  protected readonly icono = { instagram: IconBrandInstagram, facebook: IconBrandFacebook, tiktok: IconBrandTiktok };
  protected readonly valida = redValida;
  private readonly sec = viewChild.required<ElementRef<HTMLElement>>('sec');

  constructor() {
    afterNextRender(() => this.s.registrarTarjeta('redes', this.sec().nativeElement));
  }

  /** Al salir del campo: «https://instagram.com/x/» → «x». */
  protected limpiar(red: Red): void {
    const v = this.s.f()[red], u = usuarioDeRed(red, v);
    if (u !== v) this.s.set(red, u);
  }
  protected enlace(red: Red): string {
    const u = usuarioDeRed(red, this.s.f()[red]);
    return red === 'tiktok' ? `https://www.tiktok.com/@${u}` : `https://www.${red}.com/${u}`;
  }
}
