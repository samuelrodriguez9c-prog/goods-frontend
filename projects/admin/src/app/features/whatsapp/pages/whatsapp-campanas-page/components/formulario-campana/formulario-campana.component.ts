import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconCheck, IconSend, IconSpeakerphone, IconX, TablerIconComponent } from '@tabler/icons-angular';
import { mensajeDeError } from '../../../../../../core/solicitudes/solicitudes.service';
import { Campana, Plantilla, VariableCampana, piePromociones, variablesDe } from '../../../../../../core/whatsapp/whatsapp.model';
import { tipoVariable } from '../../../../shared/variables';
import { WhatsappService } from '../../../../../../core/whatsapp/whatsapp.service';
import { cop } from '../../../../shared/secciones';
import { COSTO_PROMO, aLocal, fechaCorta, hora } from '../../campanas.util';

interface Formulario {
  nombre: string;
  plantillaId: number | null;
  variables: VariableCampana[];
  cuando: 'ahora' | 'programar';
  fecha: string;
}

/**
 * Variables por defecto de una plantilla: las de tipo «nombre» se llenan con
 * el de cada cliente («cliente» si no tiene); el resto es texto fijo de la campaña.
 */
function variablesPara(p: Plantilla | null): VariableCampana[] {
  return Array.from({ length: p ? variablesDe(p.cuerpo) : 0 }, (_, k) =>
    tipoVariable(p?.tiposVariables, k) === 'nombre' ? { tipo: 'nombre', valor: 'cliente' } : { tipo: 'texto', valor: '' },
  );
}

/**
 * «Nueva campaña» / «Editar campaña»: nombre, plantilla (solo si
 * hay más de una de promoción aprobada), la oferta, cuándo, vista previa y
 * el costo. Enviar va en dos toques ("Sí, enviar a N clientes"). Crea con
 * `crearCampana` o guarda una programada con `editarCampana`, y avisa con
 * `guardada`.
 */
@Component({
  selector: 'app-formulario-campana',
  imports: [FormsModule, RouterLink, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './formulario-campana.component.html',
  host: { class: 'block' },
})
export class FormularioCampanaComponent {
  private readonly whatsapp = inject(WhatsappService);

  /** Plantillas de promoción aprobadas. */
  readonly promos = input<Plantilla[]>([]);
  readonly alcance = input(0);
  /** La campaña programada que se edita; null = nueva. */
  readonly campana = input<Campana | null>(null);
  /** Plantilla elegida de entrada (desde Plantillas: "Usar en campaña"). */
  readonly plantillaInicial = input<number | null>(null);
  readonly guardada = output<{ campana: Campana; editada: boolean }>();
  readonly cerrar = output<void>();

  protected readonly i = { megafono: IconSpeakerphone, cerrar: IconX };

  private readonly inicial = computed<Formulario>(() => {
    const c = this.campana();
    const promos = this.promos();
    if (c) {
      const p = promos.find((x) => x.nombre === c.plantilla) ?? null;
      const vars = p && variablesDe(p.cuerpo) === c.variables.length ? c.variables.map((v) => ({ ...v })) : variablesPara(p);
      return { nombre: c.nombre, plantillaId: p?.id ?? null, variables: vars, cuando: 'programar', fecha: aLocal(new Date(c.programadaPara)) };
    }
    const p = promos.find((x) => x.id === this.plantillaInicial()) ?? (promos.length === 1 ? promos[0] : null);
    return { nombre: '', plantillaId: p?.id ?? null, variables: variablesPara(p), cuando: 'ahora', fecha: '' };
  });
  private readonly editado = signal<Formulario | null>(null);
  protected readonly f = computed(() => this.editado() ?? this.inicial());

  protected readonly confirmando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly editando = computed(() => !!this.campana());
  protected readonly plantilla = computed(() => this.promos().find((p) => p.id === this.f().plantillaId) ?? null);
  /** El selector de plantilla solo aparece si hay de dónde elegir. */
  protected readonly conSelector = computed(() => this.promos().length > 1 || (this.promos().length === 1 && !this.plantilla()));

  /** Campos numerados: 1 · Nombre, [2 · Plantilla], N · Oferta…, N · Cuándo. */
  protected readonly campos = computed(() => {
    let n = 1;
    const plantilla = this.conSelector() ? ++n : 0;
    const variables = this.f().variables.map((v) => (v.tipo === 'texto' ? ++n : 0));
    return { plantilla, variables, cuando: ++n };
  });
  /** El primer dato de texto es "Oferta"; los demás, "Dato N". */
  protected readonly primerTexto = computed(() => this.f().variables.findIndex((v) => v.tipo === 'texto'));

  protected readonly subtitulo = computed(() => {
    const c = this.campana();
    if (!c) return `Le llega a quien aceptó promociones · ${this.alcance()} clientes`;
    return `Sale el ${fechaCorta(c.programadaPara)} a las ${hora(new Date(c.programadaPara))} · ${this.alcance()} clientes`;
  });
  protected readonly opcionesCuando = computed(() => {
    const fecha = this.f().fecha;
    const d = fecha ? new Date(fecha) : null;
    return [
      { k: 'ahora' as const, t: 'Ahora', s: 'Sale en unos minutos' },
      { k: 'programar' as const, t: 'Programar', s: d && !isNaN(d.getTime()) ? `${capital(fechaCorta(d.toISOString()))} · ${hora(d)}` : 'Eliges fecha y hora' },
    ];
  });

  protected readonly vistaPrevia = computed(() => {
    const p = this.plantilla();
    if (!p) return '';
    const vars = this.f().variables;
    return p.cuerpo.replace(/\{\{(\d+)\}\}/g, (todo, n: string) => {
      const v = vars[Number(n) - 1];
      return !v ? todo : v.tipo === 'nombre' ? 'Ana' : v.valor.trim() || '…';
    });
  });
  protected readonly pie = computed(() => piePromociones(this.plantilla()?.idioma ?? 'es'));
  protected readonly costoTotal = computed(() => cop(this.alcance() * COSTO_PROMO));
  protected readonly COSTO = cop(COSTO_PROMO);

  protected readonly listo = computed(() => {
    const f = this.f();
    if (!this.plantilla() || !f.nombre.trim()) return false;
    if (f.variables.some((v) => !v.valor.trim())) return false;
    return f.cuando === 'ahora' || (!!f.fecha && new Date(f.fecha).getTime() > Date.now());
  });
  protected readonly boton = computed(() => {
    const ahora = this.f().cuando === 'ahora';
    if (this.enviando()) return { t: this.editando() ? 'Guardando…' : 'Enviando…', icono: IconSend, clase: 'bg-[#303030] text-white' };
    if (this.confirmando()) return { t: `Sí, ${ahora ? 'enviar' : 'programar'} a ${this.alcance()} clientes`, icono: IconCheck, clase: 'bg-[#2be0d5] text-[#003331]' };
    if (this.editando() && !ahora) return { t: 'Guardar cambios', icono: IconCheck, clase: 'bg-[#303030] text-white hover:bg-[#1a1a1a]' };
    return { t: ahora ? 'Revisar y enviar' : 'Revisar y programar', icono: IconSend, clase: 'bg-[#303030] text-white hover:bg-[#1a1a1a]' };
  });

  protected parche(cambio: Partial<Formulario>): void {
    this.editado.set({ ...this.f(), ...cambio });
    this.confirmando.set(false);
  }

  protected elegirPlantilla(id: string): void {
    const p = this.promos().find((x) => String(x.id) === String(id)) ?? null;
    this.parche({ plantillaId: p?.id ?? null, variables: variablesPara(p) });
  }

  protected cambiarVariable(k: number, valor: string): void {
    this.parche({ variables: this.f().variables.map((v, n) => (n === k ? { ...v, valor } : v)) });
  }

  protected ahoraLocal(): string {
    return aLocal(new Date());
  }

  protected enviar(): void {
    const f = this.f();
    if (!this.listo() || this.enviando()) return;
    // Programar cambios de una que ya está programada va en un toque; enviar, en dos.
    if (!this.confirmando() && !(this.editando() && f.cuando === 'programar')) return this.confirmando.set(true);
    this.enviando.set(true);
    this.error.set(null);
    const datos = {
      nombre: f.nombre.trim(),
      plantillaId: f.plantillaId!,
      variables: f.variables.map((v) => ({ tipo: v.tipo, valor: v.valor.trim() })),
    };
    const c = this.campana();
    const peticion = c
      ? this.whatsapp.editarCampana(c.id, { ...datos, programadaPara: f.cuando === 'programar' ? new Date(f.fecha).toISOString() : new Date().toISOString() })
      : this.whatsapp.crearCampana({ ...datos, ...(f.cuando === 'programar' ? { programadaPara: new Date(f.fecha).toISOString() } : {}) });
    peticion.subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.guardada.emit({ campana: r, editada: !!c });
      },
      error: (e) => {
        this.enviando.set(false);
        this.confirmando.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
