import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { AudienciaCampanas, Campana, Plantilla } from '../../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../../core/whatsapp/whatsapp.service';
import { WhatsappModuloStore } from '../../shared/whatsapp-modulo.store';
import { AlcanceHoyComponent } from './components/alcance-hoy/alcance-hoy.component';
import { FormularioCampanaComponent } from './components/formulario-campana/formulario-campana.component';
import { HistorialCampanasComponent } from './components/historial-campanas/historial-campanas.component';
import { esProxima, fechaCorta, hora } from './campanas.util';

/**
 * Campañas de WhatsApp (rediseño 2026-10-13, LEEME §7): una plantilla de
 * promoción a los clientes que aceptaron recibirlas.
 *
 * Izquierda: alcance de hoy e Historial (próximas y enviadas, con su embudo
 * o su tarjeta-calendario). Derecha: "Nueva campaña" (la abre el botón de
 * la cabecera por `store.nuevo`, o `?nueva=1&plantilla=ID` desde Plantillas)
 * o "Editar campaña" de una programada.
 */
@Component({
  selector: 'app-whatsapp-campanas-page',
  imports: [AlcanceHoyComponent, HistorialCampanasComponent, FormularioCampanaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-campanas-page.component.html',
  host: { class: 'block' },
})
export class WhatsappCampanasPageComponent {
  private readonly whatsapp = inject(WhatsappService);
  private readonly auth = inject(AuthService);
  private readonly alertas = inject(AlertaService);
  private readonly store = inject(WhatsappModuloStore);

  protected readonly puedeConfigurar = computed(() => (this.auth.currentUser()?.permisos ?? []).includes('whatsapp.configurar'));

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly campanas = signal<Campana[]>([]);
  protected readonly audiencia = signal<AudienciaCampanas | null>(null);
  protected readonly promos = signal<Plantilla[]>([]);
  protected readonly cancelandoId = signal<number | null>(null);

  /** Panel abierto: nueva (con plantilla de entrada) o edición de una programada. */
  protected readonly form = signal<{ n: number; campana: Campana | null; plantilla: number | null } | null>(null);
  private nForm = 0;
  protected readonly alcance = computed(() => this.audiencia()?.alcance ?? 0);

  constructor() {
    this.cargar();
    // Mientras haya campañas próximas, la lista se actualiza sola.
    const timer = setInterval(() => {
      if (this.campanas().some(esProxima)) this.cargar(false);
    }, 15000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    // Desde Plantillas: /whatsapp/campanas?nueva=1&plantilla=ID
    const qp = inject(ActivatedRoute).snapshot.queryParamMap;
    if (qp.get('nueva')) this.nueva(Number(qp.get('plantilla')) || null);

    // "Nueva campaña" de la cabecera.
    const inicial = this.store.nuevo();
    effect(() => {
      if (this.store.nuevo() > inicial) untracked(() => this.nueva());
    });
  }

  protected nueva(plantilla: number | null = null): void {
    if (!this.puedeConfigurar()) return;
    this.form.set({ n: ++this.nForm, campana: null, plantilla });
  }

  protected editar(c: Campana): void {
    this.form.set({ n: ++this.nForm, campana: c, plantilla: null });
  }

  protected guardada(e: { campana: Campana; editada: boolean }): void {
    const c = e.campana;
    this.form.set(null);
    this.campanas.update((l) => (e.editada ? l.map((x) => (x.id === c.id ? c : x)) : [c, ...l]));
    const titulo = e.editada
      ? 'Cambios guardados'
      : c.estado === 'programada'
        ? `Campaña programada para el ${fechaCorta(c.programadaPara)} a las ${hora(new Date(c.programadaPara))}`
        : 'La campaña se está enviando';
    this.alertas.mostrar({ estado: 'success', titulo });
    this.store.cargarResumen();
    setTimeout(() => this.cargar(false), 3000);
  }

  protected cancelar(c: Campana): void {
    this.cancelandoId.set(c.id);
    this.whatsapp.cancelarCampana(c.id).subscribe({
      next: (r) => {
        this.cancelandoId.set(null);
        this.campanas.update((l) => l.map((x) => (x.id === r.id ? r : x)));
        if (this.form()?.campana?.id === r.id) this.form.set(null);
        this.alertas.mostrar({ estado: 'success', titulo: c.estado === 'enviando' ? 'Envío detenido' : 'Campaña cancelada' });
        this.store.cargarResumen();
      },
      error: (e) => {
        this.cancelandoId.set(null);
        this.alertas.mostrar({ estado: 'error', titulo: mensajeDeError(e) });
      },
    });
  }

  protected cargar(conTodo = true): void {
    this.whatsapp.campanas().subscribe({
      next: (l) => {
        this.campanas.set(l);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e, 'No pudimos cargar las campañas.'));
        this.cargando.set(false);
      },
    });
    this.whatsapp.audiencia().subscribe({ next: (a) => this.audiencia.set(a), error: () => undefined });
    if (conTodo) {
      this.whatsapp.plantillas().subscribe({
        next: (l) => this.promos.set(l.filter((p) => p.estado === 'aprobada' && p.categoria === 'MARKETING')),
        error: () => undefined,
      });
    }
  }
}
