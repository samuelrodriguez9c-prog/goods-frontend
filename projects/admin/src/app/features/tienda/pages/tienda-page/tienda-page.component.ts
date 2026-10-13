import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IconBrandWhatsapp,
  IconBuildingStore,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconPhoto,
  IconTrash,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { CambiosTienda, MiTienda, MonedaTienda, TiendaService } from '../../../../core/tienda/tienda.service';
import { UploadService } from '../../../../core/upload/upload.service';

type Pais = 'CO' | 'US' | 'otro';
const INDICATIVO: Record<Exclude<Pais, 'otro'>, string> = { CO: '57', US: '1' };

/**
 * Tienda en línea (Fase 0 de PROPUESTA_WHATSAPP.md): el dueño elige la
 * dirección, el WhatsApp donde le llegan los pedidos y cómo se ve, y la
 * publica o la pausa. El catálogo es el mismo de Products.
 */
@Component({
  selector: 'app-tienda-page',
  imports: [FormsModule, RouterLink, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-page.component.html',
})
export class TiendaPageComponent {
  private readonly tiendaService = inject(TiendaService);
  private readonly uploadService = inject(UploadService);

  protected readonly i = {
    tienda: IconBuildingStore,
    wa: IconBrandWhatsapp,
    copiar: IconCopy,
    copiado: IconCheck,
    abrir: IconExternalLink,
    foto: IconPhoto,
    quitar: IconTrash,
  };

  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly tienda = signal<MiTienda | null>(null);

  // Formulario
  protected readonly slug = signal('');
  protected readonly pais = signal<Pais>('CO');
  protected readonly numero = signal('');
  protected readonly descripcion = signal('');
  protected readonly logoUrl = signal<string | null>(null);
  protected readonly moneda = signal<MonedaTienda>('COP');
  protected readonly mostrarAgotados = signal(true);

  protected readonly guardando = signal(false);
  protected readonly subiendoLogo = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly copiado = signal(false);

  /** `https://tienda.goods…/` — la parte fija de la dirección. */
  protected readonly prefijo = computed(() => {
    const t = this.tienda();
    return t ? t.url.slice(0, t.url.length - t.slug.length).replace(/^https?:\/\//, '') : '';
  });

  /** El WhatsApp como lo guarda el backend: solo dígitos, con indicativo. */
  protected readonly whatsapp = computed(() => {
    const digitos = this.numero().replace(/\D/g, '');
    if (!digitos) return null;
    const p = this.pais();
    return p === 'otro' ? digitos : INDICATIVO[p] + digitos;
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
    if (!t.guardada) return true;
    const c = this.cambios();
    return (
      c.slug !== t.slug ||
      c.whatsapp !== t.whatsapp ||
      c.descripcion !== t.descripcion ||
      c.logoUrl !== t.logoUrl ||
      c.moneda !== t.moneda ||
      c.mostrarAgotados !== t.mostrarAgotados
    );
  });
  protected readonly formValido = computed(() => this.slugValido() && this.whatsappValido());
  protected readonly puedePublicar = computed(() => this.formValido() && this.whatsapp() !== null);

  protected readonly enlaceCompartir = computed(() => {
    const t = this.tienda();
    return t ? `https://wa.me/?text=${encodeURIComponent(`Mira nuestro catálogo y haz tu pedido aquí: ${t.url}`)}` : '';
  });

  constructor() {
    this.tiendaService.mia().subscribe({
      next: (t) => {
        this.cargarFormulario(t);
        this.cargando.set(false);
      },
      error: (e) => {
        this.errorCarga.set(mensajeDeError(e, 'No pudimos cargar tu tienda.'));
        this.cargando.set(false);
      },
    });
  }

  protected normalizarSlug(valor: string): void {
    this.slug.set(
      valor
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .slice(0, 60),
    );
  }

  protected guardar(): void {
    this.enviar(this.cambios(), 'Cambios guardados.');
  }

  protected publicar(activa: boolean): void {
    this.enviar(
      { ...this.cambios(), activa },
      activa ? 'Tu tienda está publicada. Comparte el enlace con tus clientes.' : 'Tu tienda quedó pausada: nadie la puede ver hasta que la vuelvas a publicar.',
    );
  }

  protected subirLogo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    this.subiendoLogo.set(true);
    this.error.set(null);
    this.uploadService.subir(archivo).subscribe({
      next: (r) => {
        this.logoUrl.set(r.url);
        this.subiendoLogo.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e, 'No pudimos subir el logo.'));
        this.subiendoLogo.set(false);
      },
    });
  }

  protected async copiar(): Promise<void> {
    const url = this.tienda()?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch {
      this.aviso.set(`Copia este enlace: ${url}`);
    }
  }

  private enviar(cambios: CambiosTienda, exito: string): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    this.tiendaService.guardar(cambios).subscribe({
      next: (t) => {
        this.cargarFormulario(t);
        this.guardando.set(false);
        this.aviso.set(exito);
      },
      error: (e) => {
        this.guardando.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }

  private cargarFormulario(t: MiTienda): void {
    this.tienda.set(t);
    this.slug.set(t.slug);
    const w = t.whatsapp ?? '';
    if (w.startsWith('57') && w.length === 12) {
      this.pais.set('CO');
      this.numero.set(w.slice(2));
    } else if (w.startsWith('1') && w.length === 11) {
      this.pais.set('US');
      this.numero.set(w.slice(1));
    } else if (w) {
      this.pais.set('otro');
      this.numero.set(w);
    } else {
      this.numero.set('');
    }
    this.descripcion.set(t.descripcion ?? '');
    this.logoUrl.set(t.logoUrl);
    this.moneda.set(t.moneda);
    this.mostrarAgotados.set(t.mostrarAgotados);
  }
}
