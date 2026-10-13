import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconPlus, IconRefresh, TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import {
  AudienciaCampanas,
  Campana,
  EstadoCampana,
  Plantilla,
  VariableCampana,
  armarPlantilla,
  piePromociones,
  variablesDe,
} from '../../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../../core/whatsapp/whatsapp.service';

const ESTADOS: Record<EstadoCampana, { texto: string; clase: string }> = {
  programada: { texto: 'Programada', clase: 'bg-blue-50 text-blue-700' },
  enviando: { texto: 'Enviando', clase: 'bg-amber-50 text-amber-800' },
  enviada: { texto: 'Enviada', clase: 'bg-[#e7f6ec] text-[#166d3b]' },
  cancelada: { texto: 'Cancelada', clase: 'bg-gray-100 text-gray-600' },
  fallida: { texto: 'No se envió', clase: 'bg-red-50 text-red-700' },
};

interface Formulario {
  nombre: string;
  plantillaId: number | null;
  variables: VariableCampana[];
  cuando: 'ahora' | 'programar';
  fecha: string;
}

/**
 * Campañas de WhatsApp (decisión 4 de PROPUESTA_WHATSAPP.md §10): una
 * plantilla de promoción a los clientes que aceptaron recibirlas. Muestra a
 * cuántos les llegaría, el formulario (con vista previa y confirmación) y
 * cómo va cada campaña.
 */
@Component({
  selector: 'app-whatsapp-campanas-page',
  imports: [FormsModule, RouterLink, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-campanas-page.component.html',
})
export class WhatsappCampanasPageComponent {
  private readonly whatsapp = inject(WhatsappService);
  private readonly auth = inject(AuthService);

  protected readonly i = { mas: IconPlus, actualizar: IconRefresh };
  protected readonly estados = ESTADOS;
  protected readonly puedeConfigurar = computed(() => (this.auth.currentUser()?.permisos ?? []).includes('whatsapp.configurar'));

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly campanas = signal<Campana[]>([]);
  protected readonly audiencia = signal<AudienciaCampanas | null>(null);
  protected readonly promos = signal<Plantilla[]>([]);
  protected readonly aviso = signal<{ texto: string; ok: boolean } | null>(null);
  protected readonly confirmandoCancelar = signal<number | null>(null);

  protected readonly form = signal<Formulario | null>(null);
  protected readonly confirmando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorForm = signal<string | null>(null);

  protected readonly plantilla = computed(() => this.promos().find((p) => p.id === this.form()?.plantillaId) ?? null);
  protected readonly vistaPrevia = computed(() => {
    const p = this.plantilla();
    const f = this.form();
    if (!p || !f) return '';
    const valores = f.variables.map((v) => (v.tipo === 'nombre' ? 'Ana' : v.valor));
    return `${armarPlantilla(p.cuerpo, valores)}\n\n${piePromociones(p.idioma)}`;
  });
  protected readonly listo = computed(() => {
    const f = this.form();
    if (!f || !this.plantilla() || !f.nombre.trim()) return false;
    if (f.variables.some((v) => !v.valor.trim())) return false;
    return f.cuando === 'ahora' || (!!f.fecha && new Date(f.fecha).getTime() > Date.now());
  });

  constructor() {
    this.cargar();
    // Mientras haya una campaña en curso, se actualiza sola.
    const timer = setInterval(() => {
      if (this.campanas().some((c) => c.estado === 'enviando' || c.estado === 'programada')) this.cargar(false);
    }, 15000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected nueva(): void {
    this.form.set({ nombre: '', plantillaId: null, variables: [], cuando: 'ahora', fecha: '' });
    this.confirmando.set(false);
    this.errorForm.set(null);
  }

  protected parche(cambio: Partial<Formulario>): void {
    this.form.update((f) => (f ? { ...f, ...cambio } : f));
    this.confirmando.set(false);
  }

  protected elegirPlantilla(id: string): void {
    const p = this.promos().find((x) => String(x.id) === id) ?? null;
    // La primera variable suele ser el nombre del cliente.
    const variables: VariableCampana[] = Array.from({ length: p ? variablesDe(p.cuerpo) : 0 }, (_, k) =>
      k === 0 ? { tipo: 'nombre', valor: 'cliente' } : { tipo: 'texto', valor: '' },
    );
    this.parche({ plantillaId: p?.id ?? null, variables });
  }

  protected cambiarVariable(k: number, cambio: Partial<VariableCampana>): void {
    this.form.update((f) => {
      if (!f) return f;
      const variables = f.variables.map((v, n) => {
        if (n !== k) return v;
        const nueva = { ...v, ...cambio };
        // Al cambiar de tipo se propone un valor que tenga sentido.
        if (cambio.tipo && cambio.tipo !== v.tipo) nueva.valor = cambio.tipo === 'nombre' ? 'cliente' : '';
        return nueva;
      });
      return { ...f, variables };
    });
    this.confirmando.set(false);
  }

  protected enviar(): void {
    const f = this.form();
    if (!f || !this.listo() || this.enviando()) return;
    if (!this.confirmando()) {
      this.confirmando.set(true);
      return;
    }
    this.enviando.set(true);
    this.errorForm.set(null);
    this.whatsapp
      .crearCampana({
        nombre: f.nombre.trim(),
        plantillaId: f.plantillaId!,
        variables: f.variables.map((v) => ({ tipo: v.tipo, valor: v.valor.trim() })),
        ...(f.cuando === 'programar' ? { programadaPara: new Date(f.fecha).toISOString() } : {}),
      })
      .subscribe({
        next: (c) => {
          this.enviando.set(false);
          this.form.set(null);
          this.campanas.update((l) => [c, ...l]);
          this.aviso.set({
            texto: f.cuando === 'ahora' ? 'La campaña se está enviando.' : `Campaña programada para el ${this.fecha(c.programadaPara)}.`,
            ok: true,
          });
          setTimeout(() => this.cargar(false), 3000);
        },
        error: (e) => {
          this.enviando.set(false);
          this.confirmando.set(false);
          this.errorForm.set(mensajeDeError(e));
        },
      });
  }

  protected cancelar(c: Campana): void {
    this.whatsapp.cancelarCampana(c.id).subscribe({
      next: (r) => {
        this.confirmandoCancelar.set(null);
        this.campanas.update((l) => l.map((x) => (x.id === r.id ? r : x)));
      },
      error: (e) => {
        this.confirmandoCancelar.set(null);
        this.aviso.set({ texto: mensajeDeError(e), ok: false });
      },
    });
  }

  protected fecha(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }

  /** Para el `min` del campo de fecha: ahora, en hora local. */
  protected ahoraLocal(): string {
    const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
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
