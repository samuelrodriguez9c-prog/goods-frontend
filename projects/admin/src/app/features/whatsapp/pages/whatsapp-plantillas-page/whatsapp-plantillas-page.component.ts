import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { Campana, NuevaPlantilla, Plantilla, TipoVariable } from '../../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../../core/whatsapp/whatsapp.service';
import { WhatsappModuloStore } from '../../shared/whatsapp-modulo.store';
import { DetallePlantillaComponent } from './components/detalle-plantilla/detalle-plantilla.component';
import { FormularioPlantillaComponent } from './components/formulario-plantilla/formulario-plantilla.component';
import { ListaPlantillasComponent } from './components/lista-plantillas/lista-plantillas.component';
import { PLANTILLA_VACIA, ordenar } from './plantillas.util';

/**
 * Plantillas de WhatsApp (rediseño 2026-10-13, LEEME §5): los mensajes que
 * Meta revisa y aprueba, los únicos con los que se le puede escribir a un
 * cliente pasadas 24 horas de su último mensaje. Se crean aquí, Goods las
 * manda a revisión y el estado se actualiza solo (webhook) o con
 * "Sincronizar".
 *
 * Izquierda, la lista (buscador, segmentado sincronizado con las métricas
 * de la cabecera, grupos Servicio / Promoción). Derecha, el panel de la
 * plantilla elegida o el formulario de "Nueva plantilla" (que abre el botón
 * de la cabecera por `store.nuevo`).
 */
@Component({
  selector: 'app-whatsapp-plantillas-page',
  imports: [ListaPlantillasComponent, DetallePlantillaComponent, FormularioPlantillaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-plantillas-page.component.html',
  host: { class: 'block' },
})
export class WhatsappPlantillasPageComponent {
  private readonly whatsapp = inject(WhatsappService);
  private readonly auth = inject(AuthService);
  private readonly alertas = inject(AlertaService);
  protected readonly store = inject(WhatsappModuloStore);

  protected readonly puedeConfigurar = computed(() => (this.auth.currentUser()?.permisos ?? []).includes('whatsapp.configurar'));

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly plantillas = signal<Plantilla[]>([]);
  protected readonly campanas = signal<Campana[]>([]);
  protected readonly sincronizando = signal(false);
  protected readonly borrando = signal(false);
  protected readonly q = signal('');
  private readonly selId = signal<number | null>(null);

  /** Formulario abierto (con lo que trae al abrirse) o null. */
  protected readonly form = signal<{ n: number; inicial: NuevaPlantilla } | null>(null);
  private nForm = 0;

  protected readonly sel = computed<Plantilla | null>(() => {
    const l = this.plantillas();
    return l.find((p) => p.id === this.selId()) ?? l[0] ?? null;
  });
  /** Cambia con cada plantilla / formulario: recrea el panel para reiniciar la animación. */
  protected readonly clave = computed(() => {
    const f = this.form();
    return f ? `f${f.n}` : `p${this.sel()?.id ?? 0}`;
  });

  constructor() {
    this.cargar();
    // "Nueva plantilla" de la cabecera.
    const inicial = this.store.nuevo();
    effect(() => {
      if (this.store.nuevo() > inicial) untracked(() => this.nueva());
    });
  }

  protected nueva(): void {
    if (!this.puedeConfigurar()) return;
    this.abrirForm({ ...PLANTILLA_VACIA, ejemplos: [] });
  }

  protected seleccionar(p: Plantilla): void {
    this.form.set(null);
    this.selId.set(p.id);
  }

  protected corregir(p: Plantilla): void {
    this.abrirForm({ nombre: p.nombre, categoria: p.categoria === 'MARKETING' ? 'MARKETING' : 'UTILITY', idioma: p.idioma, cuerpo: p.cuerpo, ejemplos: [...p.ejemplos], tipos: p.tiposVariables });
  }

  protected duplicar(p: Plantilla): void {
    this.abrirForm({
      nombre: `${p.nombre}_copia`,
      categoria: p.categoria === 'MARKETING' ? 'MARKETING' : 'UTILITY',
      idioma: p.idioma,
      cuerpo: p.cuerpo,
      ejemplos: [...p.ejemplos],
      tipos: p.tiposVariables,
    });
  }

  protected creada(p: Plantilla): void {
    this.form.set(null);
    this.plantillas.update((l) => ordenar([p, ...l.filter((x) => x.id !== p.id)]));
    this.selId.set(p.id);
    this.alertas.mostrar({ estado: 'success', titulo: 'Enviada a revisión', texto: 'Meta suele responder en minutos; a veces tarda hasta 24 horas.' });
    this.store.cargarResumen();
  }

  protected sincronizar(): void {
    if (this.sincronizando()) return;
    this.sincronizando.set(true);
    this.whatsapp.sincronizarPlantillas().subscribe({
      next: (l) => {
        this.sincronizando.set(false);
        this.plantillas.set(ordenar(l));
        this.alertas.mostrar({ estado: 'success', titulo: 'Listo: las plantillas quedaron como están en WhatsApp.' });
        this.store.cargarResumen();
      },
      error: (e) => {
        this.sincronizando.set(false);
        this.alertas.mostrar({ estado: 'error', titulo: mensajeDeError(e) });
      },
    });
  }

  /** "De dónde sale cada dato": se guarda al toque y se actualiza la fila. */
  protected cambiarTipos({ plantilla, tipos }: { plantilla: Plantilla; tipos: TipoVariable[] }): void {
    const antes = plantilla.tiposVariables;
    this.plantillas.update((l) => l.map((x) => (x.id === plantilla.id ? { ...x, tiposVariables: tipos } : x)));
    this.whatsapp.guardarTiposVariables(plantilla.id, tipos).subscribe({
      error: (e) => {
        this.plantillas.update((l) => l.map((x) => (x.id === plantilla.id ? { ...x, tiposVariables: antes } : x)));
        this.alertas.mostrar({ estado: 'error', titulo: mensajeDeError(e) });
      },
    });
  }

  protected borrar(p: Plantilla): void {
    this.borrando.set(true);
    this.whatsapp.borrarPlantilla(p.id).subscribe({
      next: () => {
        this.borrando.set(false);
        this.plantillas.update((l) => l.filter((x) => x.id !== p.id));
        this.selId.set(null);
        this.alertas.mostrar({ estado: 'success', titulo: 'Plantilla borrada', texto: 'También se borró de WhatsApp.' });
        this.store.cargarResumen();
      },
      error: (e) => {
        this.borrando.set(false);
        this.alertas.mostrar({ estado: 'error', titulo: mensajeDeError(e) });
      },
    });
  }

  private abrirForm(inicial: NuevaPlantilla): void {
    this.form.set({ n: ++this.nForm, inicial });
  }

  private cargar(): void {
    this.whatsapp.plantillas().subscribe({
      next: (l) => {
        this.plantillas.set(ordenar(l));
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e, 'No pudimos cargar las plantillas.'));
        this.cargando.set(false);
      },
    });
    this.whatsapp.campanas().subscribe({ next: (c) => this.campanas.set(c), error: () => undefined });
  }
}
