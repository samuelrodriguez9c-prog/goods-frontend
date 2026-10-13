import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconPlus, IconRefresh, IconTrash, TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { EstadoPlantilla, NuevaPlantilla, Plantilla, armarPlantilla, piePromociones, variablesDe } from '../../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../../core/whatsapp/whatsapp.service';

const ESTADOS: Record<EstadoPlantilla, { texto: string; clase: string }> = {
  pendiente: { texto: 'En revisión', clase: 'bg-amber-50 text-amber-800' },
  aprobada: { texto: 'Aprobada', clase: 'bg-[#e7f6ec] text-[#166d3b]' },
  rechazada: { texto: 'Rechazada', clase: 'bg-red-50 text-red-700' },
  pausada: { texto: 'Pausada', clase: 'bg-gray-100 text-gray-700' },
  deshabilitada: { texto: 'Deshabilitada', clase: 'bg-gray-100 text-gray-500' },
};

/** Motivos de rechazo que manda Meta, en palabras del negocio. */
const MOTIVOS: Record<string, string> = {
  INVALID_FORMAT: 'el formato no es válido (revisa las variables y los ejemplos)',
  PROMOTIONAL: 'el texto parece de promoción; créala como tipo "Promoción"',
  INCORRECT_CATEGORY: 'el tipo elegido no corresponde al texto',
  TAG_CONTENT_MISMATCH: 'el tipo elegido no corresponde al texto',
  ABUSIVE_CONTENT: 'Meta considera que el contenido no cumple sus políticas',
  SCAM: 'Meta considera que el texto puede confundirse con un engaño',
};

const VACIA: NuevaPlantilla = { nombre: '', categoria: 'UTILITY', idioma: 'es', cuerpo: '', ejemplos: [] };

/**
 * Plantillas de WhatsApp (Fase 3 de PROPUESTA_WHATSAPP.md): los mensajes que
 * Meta revisa y aprueba, los únicos con los que se le puede escribir a un
 * cliente pasadas 24 horas de su último mensaje. Se crean aquí, Goods las
 * manda a revisión y el estado se actualiza solo (webhook) o con
 * "Sincronizar".
 */
@Component({
  selector: 'app-whatsapp-plantillas-page',
  imports: [FormsModule, RouterLink, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-plantillas-page.component.html',
})
export class WhatsappPlantillasPageComponent {
  private readonly whatsapp = inject(WhatsappService);
  private readonly auth = inject(AuthService);

  protected readonly i = { mas: IconPlus, sincronizar: IconRefresh, borrar: IconTrash };
  protected readonly estados = ESTADOS;
  /** `{{n}}` para mostrar en la plantilla (las llaves dobles chocan con la interpolación de Angular). */
  protected readonly v = (n: number) => `{{${n}}}`;
  protected readonly puedeConfigurar = computed(() => (this.auth.currentUser()?.permisos ?? []).includes('whatsapp.configurar'));

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly plantillas = signal<Plantilla[]>([]);
  protected readonly sincronizando = signal(false);
  protected readonly aviso = signal<{ texto: string; ok: boolean } | null>(null);
  protected readonly confirmandoBorrar = signal<number | null>(null);

  protected readonly form = signal<NuevaPlantilla | null>(null);
  protected readonly creando = signal(false);
  protected readonly errorForm = signal<string | null>(null);
  private readonly cuerpoEl = viewChild<ElementRef<HTMLTextAreaElement>>('cuerpo');

  protected readonly nVariables = computed(() => variablesDe(this.form()?.cuerpo ?? ''));
  protected readonly indices = computed(() => Array.from({ length: this.nVariables() }, (_, k) => k));
  protected readonly vistaPrevia = computed(() => {
    const f = this.form();
    if (!f) return '';
    const cuerpo = armarPlantilla(f.cuerpo, f.ejemplos);
    // Goods les pone el pie de baja a las de promoción (lo exige el consentimiento).
    return f.categoria === 'MARKETING' ? `${cuerpo}\n\n${piePromociones(f.idioma)}` : cuerpo;
  });
  protected readonly puedeCrear = computed(() => {
    const f = this.form();
    if (!f || this.creando()) return false;
    return !!f.nombre.trim() && !!f.cuerpo.trim() && this.indices().every((k) => !!f.ejemplos[k]?.trim());
  });

  constructor() {
    this.cargar();
  }

  protected nueva(): void {
    this.form.set({ ...VACIA, ejemplos: [] });
    this.errorForm.set(null);
  }

  protected parche(cambio: Partial<NuevaPlantilla>): void {
    this.form.update((f) => (f ? { ...f, ...cambio } : f));
  }

  protected cambiarEjemplo(k: number, valor: string): void {
    this.form.update((f) => {
      if (!f) return f;
      const ejemplos = [...f.ejemplos];
      ejemplos[k] = valor;
      return { ...f, ejemplos };
    });
  }

  /** Inserta la siguiente variable `{{n}}` donde está el cursor. */
  protected insertarVariable(): void {
    const f = this.form();
    if (!f) return;
    const marca = `{{${this.nVariables() + 1}}}`;
    const el = this.cuerpoEl()?.nativeElement;
    const ini = el?.selectionStart ?? f.cuerpo.length;
    const fin = el?.selectionEnd ?? f.cuerpo.length;
    this.parche({ cuerpo: f.cuerpo.slice(0, ini) + marca + f.cuerpo.slice(fin) });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  }

  protected crear(): void {
    const f = this.form();
    if (!f || !this.puedeCrear()) return;
    this.creando.set(true);
    this.errorForm.set(null);
    this.whatsapp.crearPlantilla({ ...f, ejemplos: f.ejemplos.slice(0, this.nVariables()).map((e) => e.trim()) }).subscribe({
      next: (p) => {
        this.creando.set(false);
        this.form.set(null);
        this.plantillas.update((l) => [p, ...l.filter((x) => x.id !== p.id)]);
        this.aviso.set({ texto: 'Enviada a revisión. Meta suele responder en minutos; a veces tarda hasta 24 horas.', ok: true });
      },
      error: (e) => {
        this.creando.set(false);
        this.errorForm.set(mensajeDeError(e));
      },
    });
  }

  protected sincronizar(): void {
    this.sincronizando.set(true);
    this.aviso.set(null);
    this.whatsapp.sincronizarPlantillas().subscribe({
      next: (l) => {
        this.sincronizando.set(false);
        this.plantillas.set(l);
        this.aviso.set({ texto: 'Listo: las plantillas quedaron como están en WhatsApp.', ok: true });
      },
      error: (e) => {
        this.sincronizando.set(false);
        this.aviso.set({ texto: mensajeDeError(e), ok: false });
      },
    });
  }

  protected borrar(p: Plantilla): void {
    this.whatsapp.borrarPlantilla(p.id).subscribe({
      next: () => {
        this.confirmandoBorrar.set(null);
        this.plantillas.update((l) => l.filter((x) => x.id !== p.id));
      },
      error: (e) => {
        this.confirmandoBorrar.set(null);
        this.aviso.set({ texto: mensajeDeError(e), ok: false });
      },
    });
  }

  protected motivo(m: string | null): string {
    if (!m || m === 'NONE') return '';
    return ': ' + (MOTIVOS[m.toUpperCase()] ?? m);
  }

  protected idioma(codigo: string): string {
    return codigo.startsWith('en') ? 'Inglés' : 'Español';
  }

  protected categoria(c: string): string {
    return c === 'MARKETING' ? 'Promoción' : c === 'AUTHENTICATION' ? 'Código de acceso' : 'Servicio';
  }

  private cargar(): void {
    this.whatsapp.plantillas().subscribe({
      next: (l) => {
        this.plantillas.set(l);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e, 'No pudimos cargar las plantillas.'));
        this.cargando.set(false);
      },
    });
  }
}
