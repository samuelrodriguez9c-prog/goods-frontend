import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { IconPencil, IconSparkles, TablerIconComponent } from '@tabler/icons-angular';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { mensajeDeError } from '../../../../../../core/solicitudes/solicitudes.service';
import { NuevaPlantilla, Plantilla, TipoVariable, piePromociones, variablesDe } from '../../../../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../../../../core/whatsapp/whatsapp.service';
import { cop } from '../../../../shared/secciones';
import { OPCIONES_VARIABLE, VARIABLES } from '../../../../shared/variables';
import { PLANTILLA_VACIA, costoDe, marcaVariable, normalizar, partes } from '../../plantillas.util';
import { VistaPreviaWhatsappComponent } from '../vista-previa-whatsapp/vista-previa-whatsapp.component';
import { IaMarcaComponent } from '../../../../../../shared/ui/ia-marca/ia-marca.component';

const TIPOS: { k: NuevaPlantilla['categoria']; l: string; s: string }[] = [
  { k: 'UTILITY', l: 'Servicio', s: `Pedidos, entregas · ≈ ${cop(costoDe('UTILITY'))}` },
  { k: 'MARKETING', l: 'Promoción', s: `Ofertas, novedades · ≈ ${cop(costoDe('MARKETING'))}` },
];

/**
 * «Nueva plantilla»: nombre interno, tipo, mensaje con variables,
 * ejemplos para Meta, vista previa en vivo y costo. La manda a revisión de
 * Meta y avisa con `creada`. También sirve para "Corregir y reenviar" y
 * "Duplicar" (llega con `inicial`).
 */
@Component({
  selector: 'app-formulario-plantilla',
  imports: [IaMarcaComponent, FormsModule, TablerIconComponent, VistaPreviaWhatsappComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './formulario-plantilla.component.html',
  host: { class: 'animar-panel flex flex-col' },
})
export class FormularioPlantillaComponent {
  private readonly whatsapp = inject(WhatsappService);

  readonly inicial = input<NuevaPlantilla>(PLANTILLA_VACIA);
  readonly creada = output<Plantilla>();
  readonly cancelar = output<void>();

  protected readonly i = { lapiz: IconPencil, ia: IconSparkles };
  protected readonly OPCIONES = OPCIONES_VARIABLE;
  protected readonly VARIABLES = VARIABLES;
  protected readonly TIPOS = TIPOS;
  protected readonly v = marcaVariable;

  /** Lo que se está escribiendo; arranca con `inicial` hasta el primer cambio. */
  private readonly editado = signal<NuevaPlantilla | null>(null);
  protected readonly f = computed(() => this.editado() ?? this.inicial());
  protected readonly creando = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly cuerpoEl = viewChild<ElementRef<HTMLTextAreaElement>>('cuerpo');

  protected readonly nVariables = computed(() => variablesDe(this.f().cuerpo));
  protected readonly indices = computed(() => Array.from({ length: this.nVariables() }, (_, k) => k));
  protected readonly partes = computed(() => partes(this.f().cuerpo, this.f().ejemplos));
  protected readonly pie = computed(() => (this.f().categoria === 'MARKETING' ? piePromociones(this.f().idioma) : ''));
  protected readonly costo = computed(() => `≈ ${cop(costoDe(this.f().categoria))} COP`);
  /**
   * De dónde sale cada variable: lo que eligió quien escribe (`f().tipos`) o,
   * si no tocó nada, lo que sugiere la IA al dejar de escribir.
   */
  protected readonly sugeridos = signal<TipoVariable[]>([]);
  protected readonly sugeridoPorIa = signal(false);
  protected readonly tipos = computed<TipoVariable[]>(() =>
    this.indices().map((k) => this.f().tipos?.[k] ?? this.sugeridos()[k] ?? (k === 0 ? 'nombre' : 'texto')),
  );

  constructor() {
    toObservable(computed(() => (this.nVariables() ? JSON.stringify([this.f().cuerpo, this.f().ejemplos.slice(0, this.nVariables())]) : '')))
      .pipe(
        debounceTime(700),
        distinctUntilChanged(),
        switchMap((clave) => {
          if (!clave) return of(null);
          const [cuerpo, ejemplos] = JSON.parse(clave) as [string, string[]];
          return this.whatsapp.sugerirVariables(cuerpo, ejemplos.map((e) => e ?? '')).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        this.sugeridos.set(r?.tipos ?? []);
        this.sugeridoPorIa.set(r?.fuente === 'ia');
      });
  }

  protected elegirTipo(k: number, tipo: TipoVariable): void {
    const tipos = [...this.tipos()];
    tipos[k] = tipo;
    this.parche({ tipos });
  }

  protected readonly puedeCrear = computed(() => {
    const f = this.f();
    if (this.creando()) return false;
    return !!f.nombre.trim() && !!f.cuerpo.trim() && f.cuerpo.length <= 1024 && this.indices().every((k) => !!f.ejemplos[k]?.trim());
  });

  protected parche(cambio: Partial<NuevaPlantilla>): void {
    this.editado.set({ ...this.f(), ...cambio });
  }

  /** Nombre interno: minúsculas, guion bajo, sin tildes. */
  protected cambiarNombre(v: string, el: HTMLInputElement): void {
    const nombre = normalizar(v).replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 512);
    this.parche({ nombre });
    // Si la normalización cambió lo escrito, el input tiene que mostrarlo.
    if (el.value !== nombre) el.value = nombre;
  }

  protected cambiarEjemplo(k: number, valor: string): void {
    const ejemplos = [...this.f().ejemplos];
    ejemplos[k] = valor;
    this.parche({ ejemplos });
  }

  /** Inserta la siguiente variable `{{n}}` donde está el cursor. */
  protected insertarVariable(): void {
    const f = this.f();
    const marca = marcaVariable(this.nVariables() + 1);
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
    const f = this.f();
    if (!this.puedeCrear()) return;
    this.creando.set(true);
    this.error.set(null);
    this.whatsapp.crearPlantilla({ ...f, ejemplos: f.ejemplos.slice(0, this.nVariables()).map((e) => e.trim()), tipos: this.tipos() }).subscribe({
      next: (p) => {
        this.creando.set(false);
        this.creada.emit(p);
      },
      error: (e) => {
        this.creando.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }
}
