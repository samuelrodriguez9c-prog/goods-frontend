import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconBuildingStore, IconCloudUpload, IconIdBadge2, IconPlus, IconReplace, IconTrash, IconUpload, TablerIconComponent } from '@tabler/icons-angular';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { UploadService } from '../../../../core/upload/upload.service';
import { MAX_LOGO, SUGERENCIAS_FRASE } from '../../shared/tienda-config.modelo';
import { TiendaConfigStore } from '../../shared/tienda-config.store';
import { TiendaCabezaComponent } from '../tienda-cabeza/tienda-cabeza.component';
import { TiendaEtiquetaComponent } from '../tienda-etiqueta/tienda-etiqueta.component';

/** Tarjeta · Presentación: logo (arrastrar o elegir, con «Deshacer») y la frase bajo el nombre con sugerencias. */
@Component({
  selector: 'app-tienda-ficha-marca',
  imports: [FormsModule, TablerIconComponent, TiendaCabezaComponent, TiendaEtiquetaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-ficha-marca.component.html',
  host: { class: 'contents' },
})
export class TiendaFichaMarcaComponent {
  protected readonly s = inject(TiendaConfigStore);
  private readonly uploadService = inject(UploadService);
  private readonly alertas = inject(AlertaService);
  protected readonly i = { badge: IconIdBadge2, tienda: IconBuildingStore, subir: IconCloudUpload, upload: IconUpload, reemplazar: IconReplace, quitar: IconTrash, plus: IconPlus };
  protected readonly arrastrando = signal(false);
  protected readonly sugerencias = computed(() => SUGERENCIAS_FRASE.filter((t) => !this.s.f().frase.includes(t)));
  private readonly sec = viewChild.required<ElementRef<HTMLElement>>('sec');

  constructor() {
    afterNextRender(() => this.s.registrarTarjeta('marca', this.sec().nativeElement));
  }

  protected alElegirLogo(e: Event): void {
    const input = e.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    this.subirLogo(archivo);
  }
  protected alSoltar(e: DragEvent): void {
    e.preventDefault();
    this.arrastrando.set(false);
    this.subirLogo(e.dataTransfer?.files?.[0]);
  }
  private subirLogo(archivo: File | undefined): void {
    if (!archivo) return;
    if (!/^image\//.test(archivo.type)) { this.alertas.mostrar({ estado: 'warning', titulo: 'Solo se aceptan imágenes (JPG, PNG o WebP)' }); return; }
    if (archivo.size > MAX_LOGO) { this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo subir el logo', texto: `${archivo.name} pesa más de 4 MB. Redúcelo e inténtalo de nuevo.` }); return; }
    const previo = { logoUrl: this.s.f().logoUrl, logoNombre: this.s.f().logoNombre };
    const id = this.alertas.mostrar({ titulo: 'Subiendo logo', texto: archivo.name });
    this.uploadService.subir(archivo).subscribe({
      next: (r) => {
        this.s.set('logoUrl', r.url, { logoNombre: archivo.name });
        this.alertas.resolver(id, { estado: 'success', titulo: 'Logo listo', texto: 'Míralo en la vista previa', accion: { label: 'Deshacer', ejecutar: () => this.s.set('logoUrl', previo.logoUrl, { logoNombre: previo.logoNombre }) } });
      },
      error: (e) => this.alertas.resolver(id, { estado: 'error', titulo: 'No se pudo subir el logo', texto: mensajeDeError(e) }),
    });
  }
  protected quitarLogo(): void {
    const previo = { logoUrl: this.s.f().logoUrl, logoNombre: this.s.f().logoNombre };
    this.s.set('logoUrl', null, { logoNombre: '' });
    this.alertas.mostrar({ estado: 'success', titulo: 'Logo quitado', texto: 'Se mostrará la inicial', accion: { label: 'Deshacer', ejecutar: () => this.s.set('logoUrl', previo.logoUrl, { logoNombre: previo.logoNombre }) } });
  }
}
