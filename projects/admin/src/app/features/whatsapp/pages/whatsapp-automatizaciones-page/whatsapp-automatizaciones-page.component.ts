import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconPencil, IconPlus, IconSparkles, IconTrash, TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { Automatizaciones, HorarioSemanal } from '../../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../../core/whatsapp/whatsapp.service';

const DIAS = [
  { k: '1', nombre: 'Lunes' },
  { k: '2', nombre: 'Martes' },
  { k: '3', nombre: 'Miércoles' },
  { k: '4', nombre: 'Jueves' },
  { k: '5', nombre: 'Viernes' },
  { k: '6', nombre: 'Sábado' },
  { k: '0', nombre: 'Domingo' },
];

const ZONAS = [
  { v: 'America/Bogota', t: 'Colombia' },
  { v: 'America/New_York', t: 'EE. UU. — Este (Nueva York, Miami)' },
  { v: 'America/Chicago', t: 'EE. UU. — Centro (Chicago, Houston)' },
  { v: 'America/Denver', t: 'EE. UU. — Montaña (Denver)' },
  { v: 'America/Los_Angeles', t: 'EE. UU. — Pacífico (Los Ángeles)' },
];

const HORARIO_INICIAL: HorarioSemanal = {
  '1': { desde: '08:00', hasta: '18:00' },
  '2': { desde: '08:00', hasta: '18:00' },
  '3': { desde: '08:00', hasta: '18:00' },
  '4': { desde: '08:00', hasta: '18:00' },
  '5': { desde: '08:00', hasta: '18:00' },
  '6': { desde: '09:00', hasta: '13:00' },
  '0': null,
};

/**
 * Respuestas automáticas y rápidas de WhatsApp (Fase 3 de
 * PROPUESTA_WHATSAPP.md): bienvenida, fuera de horario, palabras clave y los
 * textos guardados del equipo. Solo el dueño (`whatsapp.configurar`) las
 * cambia; el resto del equipo las ve.
 */
@Component({
  selector: 'app-whatsapp-automatizaciones-page',
  imports: [FormsModule, RouterLink, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-automatizaciones-page.component.html',
})
export class WhatsappAutomatizacionesPageComponent {
  private readonly whatsapp = inject(WhatsappService);
  private readonly auth = inject(AuthService);

  protected readonly i = { mas: IconPlus, editar: IconPencil, borrar: IconTrash, ia: IconSparkles };
  protected readonly dias = DIAS;
  protected readonly zonas = ZONAS;
  protected readonly puedeConfigurar = computed(() => (this.auth.currentUser()?.permisos ?? []).includes('whatsapp.configurar'));

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly datos = signal<Automatizaciones | null>(null);
  protected readonly aviso = signal<{ seccion: string; texto: string; ok: boolean } | null>(null);
  protected readonly guardando = signal<string | null>(null);

  // Asistente de IA
  protected readonly asistenteActivo = signal(false);
  protected readonly asistenteInstrucciones = signal('');

  // Bienvenida
  protected readonly bienvenidaActiva = signal(false);
  protected readonly bienvenidaTexto = signal('');

  // Fuera de horario
  protected readonly fueraActiva = signal(false);
  protected readonly fueraTexto = signal('');
  protected readonly zona = signal('America/Bogota');
  protected readonly horario = signal<HorarioSemanal>(HORARIO_INICIAL);

  // Palabra clave (formulario de alta/edición)
  protected readonly palabraForm = signal<{ id?: number; palabras: string; texto: string } | null>(null);
  // Respuesta rápida (formulario)
  protected readonly rapidaForm = signal<{ id?: number; atajo: string; texto: string } | null>(null);

  constructor() {
    this.cargar();
  }

  protected vistaPrevia(texto: string): string {
    const tienda = this.datos()?.enlaceTienda ?? '(tu tienda en línea)';
    return texto.replace(/\{nombre\}/gi, 'Ana').replace(/\{tienda\}/gi, tienda);
  }

  protected abierto(dia: string): boolean {
    return !!this.horario()[dia];
  }

  protected alternarDia(dia: string): void {
    this.horario.update((h) => ({ ...h, [dia]: h[dia] ? null : { desde: '08:00', hasta: '18:00' } }));
  }

  protected cambiarHora(dia: string, campo: 'desde' | 'hasta', valor: string): void {
    this.horario.update((h) => ({ ...h, [dia]: h[dia] ? { ...h[dia]!, [campo]: valor } : h[dia] }));
  }

  protected guardarAsistente(): void {
    this.guardar(
      'asistente',
      this.whatsapp.guardarAsistente({ activa: this.asistenteActivo(), instrucciones: this.asistenteInstrucciones() }),
    );
  }

  protected guardarBienvenida(): void {
    this.guardar('bienvenida', this.whatsapp.guardarBienvenida({ activa: this.bienvenidaActiva(), texto: this.bienvenidaTexto() }));
  }

  protected guardarFueraHorario(): void {
    this.guardar(
      'fuera',
      this.whatsapp.guardarFueraHorario({
        activa: this.fueraActiva(),
        texto: this.fueraTexto(),
        zonaHoraria: this.zona(),
        horario: this.horario(),
      }),
    );
  }

  protected nuevaPalabra(): void {
    this.palabraForm.set({ palabras: '', texto: '' });
  }

  protected editarPalabra(p: { id: number; config: { palabras: string[]; texto: string } }): void {
    this.palabraForm.set({ id: p.id, palabras: p.config.palabras.join(', '), texto: p.config.texto });
  }

  protected guardarPalabra(): void {
    const f = this.palabraForm();
    if (!f) return;
    const palabras = f.palabras.split(',').map((p) => p.trim()).filter(Boolean);
    this.guardar('palabras', this.whatsapp.guardarPalabraClave({ palabras, texto: f.texto }, f.id), () => this.palabraForm.set(null));
  }

  protected alternarPalabra(p: { id: number; activa: boolean; config: { palabras: string[]; texto: string } }): void {
    this.guardar('palabras', this.whatsapp.guardarPalabraClave({ ...p.config, activa: !p.activa }, p.id));
  }

  protected borrarPalabra(id: number): void {
    this.guardar('palabras', this.whatsapp.borrarPalabraClave(id));
  }

  protected nuevaRapida(): void {
    this.rapidaForm.set({ atajo: '', texto: '' });
  }

  protected guardarRapida(): void {
    const f = this.rapidaForm();
    if (!f) return;
    this.guardar('rapidas', this.whatsapp.guardarRespuestaRapida({ atajo: f.atajo, texto: f.texto }, f.id), () => this.rapidaForm.set(null));
  }

  protected borrarRapida(id: number): void {
    this.guardar('rapidas', this.whatsapp.borrarRespuestaRapida(id));
  }

  protected parchePalabra(cambio: Partial<{ palabras: string; texto: string }>): void {
    this.palabraForm.update((f) => (f ? { ...f, ...cambio } : f));
  }

  protected parcheRapida(cambio: Partial<{ atajo: string; texto: string }>): void {
    this.rapidaForm.update((f) => (f ? { ...f, ...cambio } : f));
  }

  private guardar(seccion: string, peticion: { subscribe: (o: { next: () => void; error: (e: unknown) => void }) => unknown }, alTerminar?: () => void): void {
    this.guardando.set(seccion);
    this.aviso.set(null);
    peticion.subscribe({
      next: () => {
        this.guardando.set(null);
        this.aviso.set({ seccion, texto: 'Guardado.', ok: true });
        alTerminar?.();
        this.cargar(false);
      },
      error: (e) => {
        this.guardando.set(null);
        this.aviso.set({ seccion, texto: mensajeDeError(e), ok: false });
      },
    });
  }

  private cargar(conFormularios = true): void {
    this.whatsapp.automatizaciones().subscribe({
      next: (d) => {
        this.datos.set(d);
        this.cargando.set(false);
        if (!conFormularios) return;
        this.asistenteActivo.set(d.asistente.config?.activa ?? false);
        this.asistenteInstrucciones.set(d.asistente.config?.config.instrucciones ?? '');
        this.bienvenidaActiva.set(d.bienvenida?.activa ?? false);
        this.bienvenidaTexto.set(d.bienvenida?.config.texto ?? 'Hola {nombre}, gracias por escribirnos. ¿En qué te podemos ayudar?');
        this.fueraActiva.set(d.fueraHorario?.activa ?? false);
        this.fueraTexto.set(
          d.fueraHorario?.config.texto ?? 'Hola {nombre}, en este momento estamos cerrados. Te respondemos apenas abramos. Mientras tanto puedes ver nuestro catálogo: {tienda}',
        );
        this.zona.set(d.fueraHorario?.config.zonaHoraria ?? 'America/Bogota');
        this.horario.set(d.fueraHorario?.config.horario ?? HORARIO_INICIAL);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e, 'No pudimos cargar las respuestas automáticas.'));
        this.cargando.set(false);
      },
    });
  }
}
