import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono } from '../../../shared/ui/iconos';
import { Tono } from '../categorias.util';
import { TarjetaHojaComponent } from './tarjeta-hoja.component';

/** Pestaña Imagen de la hoja: zona para soltar / elegir la portada, o la portada con Reemplazar y Quitar. */
@Component({
  selector: 'app-pestana-imagen',
  standalone: true,
  imports: [TablerIconComponent, TarjetaHojaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 pt-4' },
  template: `
    <app-tarjeta-hoja icono="photo" titulo="Imagen" descripcion="Se muestra como portada de la categoría en la tienda. Una sola imagen.">
      @if (imagen(); as url) {
        <div class="relative aspect-[16/9] animate-[ficha_320ms_cubic-bezier(.2,.8,.2,1)_both] overflow-hidden rounded-[14px] bg-[#f1f1f1]">
          <span class="absolute inset-0 bg-cover bg-center" [style.background-image]="'url(' + url + ')'"></span>
          <span class="absolute bottom-2.5 left-2.5 rounded-full bg-[rgba(26,26,26,.82)] px-2.5 py-[3px] text-[11px] font-semibold text-white">Portada</span>
        </div>
        <div class="flex gap-2">
          <label class="flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#303030] shadow-[0_0_0_1px_#e5e5e5] hover:shadow-[0_0_0_1px_#b5b5b5]!">
            <tabler-icon [icon]="i.reemplazar" [size]="14" [stroke]="2" />Reemplazar
            <input type="file" accept="image/*" (change)="elegido($event)" [disabled]="soloLectura()" class="hidden" />
          </label>
          <button
            type="button"
            (click)="quitar.emit()"
            [disabled]="soloLectura()"
            class="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-[#b42318] hover:bg-[#fff1f0]!"
          >
            <tabler-icon [icon]="i.quitar" [size]="14" [stroke]="2" />Quitar
          </button>
        </div>
      } @else {
        <label
          (drop)="soltado($event)"
          (dragover)="$event.preventDefault()"
          class="flex min-h-85 cursor-pointer flex-col items-center justify-center gap-5 rounded-[14px] bg-[#fafafa] [background-image:radial-gradient(#e2e2e2_1px,transparent_1px)] [background-size:16px_16px] px-5 py-8 text-center shadow-[inset_0_0_0_1.5px_#e5e5e5] transition-[box-shadow] duration-200 ease-[ease] hover:shadow-[inset_0_0_0_1.5px_#2be0d5]!"
        >
          <!-- Ilustración: tarjeta con el tono de la categoría, cámara y nube -->
          <div class="relative h-29.5 w-42 shrink-0">
            <span
              class="absolute top-4 left-2 flex size-23 rotate-[-9deg] items-center justify-center rounded-2xl shadow-[0_0_0_1px_#ececec,0_10px_24px_-16px_rgba(0,0,0,.35)]"
              [style.background]="tono().fondo"
              [style.color]="tono().tinta"
            >
              <tabler-icon [icon]="icono(tono().icono)" [size]="24" [stroke]="2" />
            </span>
            <span class="absolute top-4 right-2 flex size-23 rotate-[8deg] items-center justify-center rounded-2xl bg-white text-[#c4c4c4] shadow-[0_0_0_1px_#ececec,0_10px_24px_-16px_rgba(0,0,0,.35)]">
              <tabler-icon [icon]="i.camara" [size]="24" [stroke]="2" />
            </span>
            <span class="absolute top-1 left-8.5 flex size-25 items-center justify-center rounded-[18px] bg-white text-[#00807a] shadow-[0_0_0_1px_#e5e5e5,0_18px_34px_-18px_rgba(0,0,0,.4)]">
              <tabler-icon [icon]="i.nube" [size]="30" [stroke]="2" />
            </span>
          </div>
          <span class="flex max-w-90 flex-col gap-1.5">
            <span class="font-[Archivo] text-[19px] font-semibold tracking-[-0.01em] text-[#111827]">Suelta aquí la imagen</span>
            <span class="text-[13px] leading-[19px] text-pretty text-[#6b7280]">
              Mejor horizontal, de al menos 1200 px. JPG, PNG o WebP · hasta 8 MB. Sin imagen, la tienda usa el ícono de la categoría.
            </span>
          </span>
          <span class="flex h-8 items-center gap-1.5 rounded-full bg-[#303030] px-3.5 text-[12.5px] font-medium text-white">
            <tabler-icon [icon]="i.subir" [size]="14" [stroke]="2" />Elegir archivo
          </span>
          <input type="file" accept="image/*" (change)="elegido($event)" [disabled]="soloLectura()" class="hidden" />
        </label>
      }
    </app-tarjeta-hoja>
  `,
})
export class PestanaImagenComponent {
  readonly imagen = input<string | null>(null);
  /** Tono de la categoría para la ilustración sin imagen. */
  readonly tono = input.required<Tono>();
  readonly soloLectura = input(false);
  readonly archivo = output<File | undefined>();
  readonly quitar = output<void>();

  protected readonly icono = icono;
  protected readonly i = {
    reemplazar: icono('replace'),
    quitar: icono('trash'),
    camara: icono('camera'),
    nube: icono('cloud-upload'),
    subir: icono('upload'),
  };

  protected elegido(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    this.archivo.emit(f);
  }
  protected soltado(ev: DragEvent): void {
    ev.preventDefault();
    if (!this.soloLectura()) this.archivo.emit(ev.dataTransfer?.files?.[0]);
  }
}
