import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import {
  IconArrowLeft,
  IconBan,
  IconCalendarCheck,
  IconCalendarClock,
  IconCalendarPlus,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconDeviceFloppy,
  IconDeviceMobile,
  IconInfoCircle,
  IconLoader2,
  IconMail,
  IconMailForward,
  IconMinus,
  IconPencil,
  IconPhone,
  IconPhoneCheck,
  IconPhoneOff,
  IconPointFilled,
  IconSend,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { StatusBadgeComponent, StatusBadgeTone } from 'shared-ui';
import { Observable, Subscription, forkJoin, interval } from 'rxjs';
import { EmpresaDetallePanelComponent } from '../../../empresas/pages/empresa-detalle-panel/empresa-detalle-panel.component';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { SuscripcionService } from '../../../../core/catalog/suscripcion.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { RealtimeService } from '../../../../core/realtime/realtime.service';
import { EmpresaConDueno } from '../../../../core/catalog/models/empresa.model';
import { Plan } from '../../../../core/catalog/models/plan.model';

/** Payload real de `RealtimeGateway.emitirAUsuario(..., 'empresa.activada', ...)`
 * (ver `EmpresaService.activarPorConfirmacionCliente` del backend). */
interface EventoEmpresaActivada {
  empresaId: number;
  nombre: string;
}

/** Las cuatro fases visibles del asistente. `preparar`/`enCurso` son los dos
 * momentos del paso 1 (antes y durante la llamada); `esperando` es el paso 2;
 * `activada` es el final feliz, que llega por WebSocket o por el poll. */
type FaseWizard = 'preparar' | 'enCurso' | 'esperando' | 'activada';

/** Guion mínimo de la llamada — es la ayuda que hoy el staff tiene en la
 * cabeza. Tildable, nunca obligatorio (ver la nota bajo el botón). */
const GUION = [
  { texto: 'Presentate y confirmá que hablás con el dueño', nota: 'Si atiende otra persona, no sigas: reagendá.' },
  { texto: 'Leele el nombre del negocio como quedó cargado', nota: 'Si lo quiere distinto, corregilo acá mismo antes de terminar.' },
  { texto: 'Confirmá el plan que pidió', nota: 'Es el que se le va a facturar cuando confirme.' },
  { texto: 'Avisale que le llega un correo para definir la contraseña', nota: 'Sin ese paso la Empresa no se activa.' },
];

const CHECKLIST = [
  'Hablaste con el dueño del negocio',
  'El nombre y el plan quedaron como él los quiere',
  'Sabe que le llega un correo para terminar',
];

/**
 * Asistente de activación (§4/§11 Paso 3, PROPUESTA_FLUJO_ALTA_ASISTIDA.md)
 * — rediseño del 2026-09-17, hermano de la "hoja del día"
 * (`AltasPendientesPageComponent`), tercer handoff integrado componente
 * por componente.
 *
 * Misma máquina de estados y mismas llamadas al backend que la versión
 * anterior (`corregirNombre` + `actualizar` + `cambiarPlan`,
 * `programarLlamada`, `llamadaFinalizada`, `reenviarEnlace`, `rechazar`, más
 * el WebSocket `empresa.activada` con polling de respaldo). Lo que cambió es
 * la forma:
 *
 * 1. **No usa `SidePanelComponent`** (cabecera fija + cuerpo scrolleable +
 *    pie contextual; ese panel scrollea todo junto). Arma su propio overlay
 *    de pantalla completa — mismo backdrop, `z-50` y keyframes
 *    (`fade-in-up`/`slide-in-right`) que `SidePanelComponent`, así que se
 *    sigue sintiendo igual que el resto y sigue apilando bien arriba de
 *    `AltasPendientesPageComponent`. `SidePanelComponent` sigue intacto —
 *    lo sigue usando el resto del panel.
 * 2. **`ModalComponent` se reemplaza por dos modales inline** (confirmar
 *    llamada finalizada / rechazar), con `z-[60]` explícito para quedar
 *    siempre arriba del overlay del asistente sin depender del orden del
 *    DOM. Tienen más contenido que un modal genérico de dos botones
 *    (checklist + bloque "qué pasa al confirmar"), así que no valía la
 *    pena forzarlos dentro de `ModalComponent` — que sigue intacto para
 *    Planes/Usuarios/Roles.
 * 3. **`fase` en vez de `paso` + `llamadaIniciada` + `exito`**: cuatro
 *    estados explícitos (`preparar`, `enCurso`, `esperando`, `activada`) que
 *    el template lee directo. Los signals viejos siguen existiendo como
 *    fuente (`llamadaIniciada`, `exito`) para no tocar la lógica de red.
 * 4. **Sin teléfono no se puede llamar**: "Llamar ahora" se reemplaza por un
 *    bloque deshabilitado. Antes se podía iniciar una llamada sin número.
 * 5. **Cronómetro y guion tildable** durante la llamada; **línea de progreso
 *    de cuatro hitos** en el paso 2; **animación de activación** al recibir
 *    el evento — tres keyframes nuevas (`latido`, `aparecer`, `pop`, `onda`)
 *    sumadas a `styles.css`, solo en `staff` (mismo criterio que
 *    `slide-in-right`: son de piezas que no existen en `admin` todavía).
 * 6. **Pie contextual**: dice qué se pierde (o no) al cerrar, según la fase.
 *
 * El ícono de info del paso 1 sigue abriendo `EmpresaDetallePanelComponent`
 * anidado (mismo `z-50`, más adelante en el DOM que el overlay del
 * asistente, así que sigue pintando arriba — confirmado con Playwright, ver
 * ADMIN_DISENO.md).
 *
 * PENDIENTE DE BACKEND: `programarLlamada` ya existe, pero el listado
 * (`GET /empresas`) todavía no devuelve la fecha agendada, así que la hoja la
 * guarda en memoria. Al exponerla, la etiqueta "Agendada …" de la fila pasa a
 * sobrevivir el refresh.
 */
@Component({
  selector: 'app-activar-empresa-wizard',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    InputTextModule,
    TablerIconComponent,
    StatusBadgeComponent,
    EmpresaDetallePanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activar-empresa-wizard.component.html',
})
export class ActivarEmpresaWizardComponent {
  private readonly empresaService = inject(EmpresaService);
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly planService = inject(PlanService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly router = inject(Router);

  readonly empresaId = input.required<number>();
  readonly actualizada = output<void>();
  readonly cerrar = output<void>();

  protected readonly guion = GUION;
  protected readonly checklist = CHECKLIST;

  protected readonly iconCerrar = IconX;
  protected readonly iconEditar = IconPencil;
  protected readonly iconGuardar = IconDeviceFloppy;
  protected readonly iconLlamar = IconPhone;
  protected readonly iconSinTelefono = IconPhoneOff;
  protected readonly iconMovil = IconDeviceMobile;
  protected readonly iconAgenda = IconCalendarClock;
  protected readonly iconAgendaMas = IconCalendarPlus;
  protected readonly iconAgendaCheck = IconCalendarCheck;
  protected readonly iconInfo = IconInfoCircle;
  protected readonly iconTilde = IconCheck;
  protected readonly iconLlamadaOk = IconPhoneCheck;
  protected readonly iconEnlace = IconMailForward;
  protected readonly iconReenviar = IconSend;
  protected readonly iconRechazar = IconBan;
  protected readonly iconVolver = IconArrowLeft;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly empresa = signal<EmpresaConDueno | null>(null);

  protected readonly paso = signal<1 | 2>(1);
  protected readonly exito = signal(false);

  // Paso 1 — datos editables al vuelo.
  protected readonly nombre = signal('');
  protected readonly telefono = signal('');
  protected readonly planId = signal<number | null>(null);
  protected readonly planes = signal<Plan[]>([]);
  private planIdOriginal: number | null = null;
  protected readonly guardandoDatos = signal(false);
  protected readonly datosGuardados = signal(false);
  protected readonly errorGuardarDatos = signal<string | null>(null);

  protected readonly hayCambiosDatos = computed(() => {
    const actual = this.empresa();
    if (!actual) {
      return false;
    }
    return (
      this.nombre().trim() !== actual.nombre ||
      this.telefono().trim() !== (actual.telefonoContacto ?? '') ||
      this.planId() !== this.planIdOriginal
    );
  });

  // Paso 1 — llamar ahora / programar.
  protected readonly llamadaIniciada = signal(false);
  protected readonly mostrarFormularioProgramar = signal(false);
  protected readonly fechaHoraProgramada = signal('');
  protected readonly agendadaEn = signal<Date | null>(null);
  protected readonly programando = signal(false);
  protected readonly errorProgramar = signal<string | null>(null);

  protected readonly mostrarConfirmacionLlamada = signal(false);
  protected readonly confirmandoLlamada = signal(false);
  protected readonly errorConfirmarLlamada = signal<string | null>(null);

  // Llamada en curso — cronómetro y guion.
  protected readonly horaInicio = signal('');
  private readonly segundos = signal(0);
  protected readonly puntosHechos = signal<number[]>([]);
  private cronoSub: Subscription | null = null;

  // Paso 2.
  protected readonly reenviando = signal(false);
  protected readonly enlaceReenviado = signal(false);
  protected readonly errorReenviar = signal<string | null>(null);
  private pollingSub: Subscription | null = null;
  private socketSub: Subscription | null = null;

  protected readonly mostrarRechazar = signal(false);
  protected readonly motivoRechazo = signal('');
  protected readonly rechazando = signal(false);
  protected readonly errorRechazar = signal<string | null>(null);

  protected readonly mostrarDetalle = signal(false);

  protected readonly fase = computed<FaseWizard>(() => {
    if (this.exito()) {
      return 'activada';
    }
    if (this.paso() === 2) {
      return 'esperando';
    }
    return this.llamadaIniciada() ? 'enCurso' : 'preparar';
  });

  protected readonly cronometro = computed(() => {
    const s = this.segundos();
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  protected readonly guionCompleto = computed(() => this.puntosHechos().length === GUION.length);

  protected readonly etiquetaEstado = computed(() => {
    const fase = this.fase();
    return fase === 'activada' ? 'Activa' : fase === 'esperando' ? 'Información corroborada' : 'Solicitud recibida';
  });

  protected readonly tonoEstado = computed<StatusBadgeTone>(() => {
    const fase = this.fase();
    return fase === 'activada' ? 'success' : fase === 'esperando' ? 'info' : 'warning';
  });

  protected readonly subtitulo = computed(() => {
    const e = this.empresa();
    if (!e) {
      return '';
    }
    const fase = this.fase();
    if (fase === 'esperando' || fase === 'activada') {
      return this.horaInicio() ? `Llamada hecha hoy ${this.horaInicio()}` : 'Llamada hecha · enlace enviado';
    }
    return `${e.rubro ?? 'Sin rubro declarado'} · registrada el ${this.fechaCorta(e.creadoEn)}`;
  });

  protected readonly pasos = computed(() => {
    const fase = this.fase();
    const unoHecho = fase === 'esperando' || fase === 'activada';
    return [
      {
        texto: 'La llamada',
        icono: unoHecho ? IconCheck : IconPhone,
        barra: unoHecho ? 'bg-success-solid' : 'bg-primary-button',
        tinta: unoHecho ? 'text-success-solid' : 'text-gray-900',
      },
      {
        texto: fase === 'activada' ? 'Activada' : 'Confirmación del cliente',
        icono: fase === 'activada' ? IconCheck : fase === 'esperando' ? IconLoader2 : IconMail,
        barra: fase === 'activada' ? 'bg-success-solid' : fase === 'esperando' ? 'bg-sky-600' : 'bg-gray-200',
        tinta: fase === 'activada' ? 'text-success-solid' : fase === 'esperando' ? 'text-sky-900' : 'text-gray-300',
      },
    ];
  });

  protected readonly ficha = computed(() => {
    const e = this.empresa();
    if (!e) {
      return [];
    }
    const dias = this.diasDesde(e.creadoEn);
    return [
      { etiqueta: 'Dueño declarado', valor: this.nombreDueno(e), tinta: 'text-gray-900' },
      { etiqueta: 'Correo', valor: e.duenoCorreo ?? e.correoContacto, tinta: 'text-gray-900' },
      {
        etiqueta: 'Esperando',
        valor: dias === 0 ? 'Entró hoy' : `${dias} ${dias === 1 ? 'día' : 'días'}`,
        tinta: dias >= 10 ? 'text-amber-700' : 'text-gray-900',
      },
      { etiqueta: 'Registrada', valor: this.fechaCorta(e.creadoEn), tinta: 'text-gray-900' },
    ];
  });

  /** Atajos de agenda — los tres horarios que el staff usa de verdad. */
  protected readonly atajos = computed(() => {
    const base = new Date();
    const enLocal = (dias: number, hora: number) => {
      const f = new Date(base);
      f.setDate(f.getDate() + dias);
      f.setHours(hora, 0, 0, 0);
      const p = (n: number) => String(n).padStart(2, '0');
      return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}T${p(f.getHours())}:${p(f.getMinutes())}`;
    };
    return [
      { texto: 'Hoy 16:00', valor: enLocal(0, 16) },
      { texto: 'Mañana 10:00', valor: enLocal(1, 10) },
      { texto: 'Mañana 15:00', valor: enLocal(1, 15) },
    ];
  });

  protected readonly resumenAgenda = computed(() =>
    this.fechaHoraProgramada()
      ? `Queda en la hoja con la etiqueta “Agendada ${this.fechaAgenda(this.fechaHoraProgramada())}” y el botón pasa a “Empezar ahora”. La cifra de espera deja de gritar: ya tiene hora.`
      : 'Elegí un atajo o una fecha. La alta no se mueve de la hoja — solo cambia la etiqueta por la hora acordada.',
  );

  protected readonly textoBotonAgendar = computed(() =>
    this.programando()
      ? 'Guardando…'
      : this.fechaHoraProgramada()
        ? `Agendar ${this.fechaAgenda(this.fechaHoraProgramada())}`
        : 'Elegí fecha y hora',
  );

  protected readonly nombrePlanElegido = computed(
    () => this.planes().find((p) => p.id === this.planId())?.nombre ?? '',
  );

  protected readonly consecuencias = computed(() => {
    const e = this.empresa();
    const correo = e?.duenoCorreo ?? e?.correoContacto ?? '';
    return [
      { icono: IconMail, texto: `Se le manda un enlace a ${correo} para que defina su contraseña.` },
      { icono: IconClock, texto: 'La Empresa pasa a “información corroborada” y baja a la lista de espera de la hoja.' },
      { icono: IconCircleCheck, texto: 'Cuando el cliente abra el enlace se activa sola y arranca la facturación del plan.' },
    ];
  });

  protected readonly progreso = computed(() => {
    const e = this.empresa();
    const correo = e?.duenoCorreo ?? e?.correoContacto ?? '';
    const hitos = [
      { texto: 'Llamada hecha', nota: this.horaInicio() ? `Con el dueño, hoy ${this.horaInicio()}` : 'Con el dueño', estado: 'ok' },
      { texto: 'Enlace enviado', nota: correo, estado: 'ok' },
      { texto: 'El cliente define su contraseña', nota: 'Es el único paso que falta', estado: 'ahora' },
      { texto: 'La Empresa se activa sola', nota: 'Automático — no tenés que volver acá', estado: 'pendiente' },
    ];

    return hitos.map((h) => ({
      texto: h.texto,
      nota: h.nota,
      punto:
        h.estado === 'ok'
          ? 'border-success-solid bg-success-solid'
          : h.estado === 'ahora'
            ? 'animate-[latido_1.6s_ease-in-out_infinite] border-sky-600 bg-sky-100'
            : 'border-gray-200 bg-card-bg',
      icono: h.estado === 'ok' ? IconCheck : h.estado === 'ahora' ? IconPointFilled : IconMinus,
      iconoTinta: h.estado === 'ok' ? 'text-white' : h.estado === 'ahora' ? 'text-sky-600' : 'text-transparent',
      tinta:
        h.estado === 'pendiente'
          ? 'text-gray-400'
          : h.estado === 'ahora'
            ? 'font-semibold text-sky-900'
            : 'font-medium text-gray-700',
    }));
  });

  /** Qué dice el pie según la fase — su trabajo es que cerrar no dé miedo. */
  protected readonly pie = computed(() => {
    switch (this.fase()) {
      case 'enCurso':
        return {
          icono: IconPhone,
          tinta: 'text-success-solid',
          texto: 'Llamada en curso',
          nota: 'Si cortás acá, la llamada queda sin registrar.',
        };
      case 'esperando':
        return {
          icono: IconClock,
          tinta: 'text-sky-600',
          texto: 'En manos del cliente',
          nota: 'Podés cerrar: se activa sola cuando confirme.',
        };
      default: {
        const agenda = this.agendadaEn();
        if (agenda) {
          return {
            icono: IconCalendarClock,
            tinta: 'text-sky-700',
            texto: `Agendada ${this.fechaAgendaDesde(agenda)}`,
            nota: 'Nada se pierde al cerrar.',
          };
        }
        const cambios = this.hayCambiosDatos();
        return {
          icono: IconDeviceFloppy,
          tinta: 'text-gray-400',
          texto: cambios ? 'Tenés cambios sin guardar' : 'Nada pendiente de guardar',
          nota: cambios ? 'Guardalos arriba antes de salir.' : 'Cerrar no cancela ni rechaza nada.',
        };
      }
    }
  });

  constructor() {
    effect(() => {
      this.cargar(this.empresaId());
    });
    inject(DestroyRef).onDestroy(() => {
      this.detenerEscucha();
      this.detenerCrono();
    });
  }

  private cargar(id: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.paso.set(1);
    this.exito.set(false);
    this.llamadaIniciada.set(false);
    this.datosGuardados.set(false);
    this.puntosHechos.set([]);
    this.detenerEscucha();
    this.detenerCrono();

    forkJoin({
      empresa: this.empresaService.obtenerUno(id),
      suscripciones: this.suscripcionService.listar('pendiente', id),
      planes: this.planService.listarTodos(),
    }).subscribe({
      next: ({ empresa, suscripciones, planes }) => {
        this.empresa.set(empresa);
        this.nombre.set(empresa.nombre);
        this.telefono.set(empresa.telefonoContacto ?? '');
        this.planIdOriginal = suscripciones.data[0]?.planId ?? null;
        this.planId.set(this.planIdOriginal);
        this.planes.set(planes.data);
        this.cargando.set(false);

        if (empresa.estado === 'informacion_corroborada') {
          this.entrarPaso2();
        }
      },
      error: () => {
        this.error.set('No se pudo cargar el detalle de la Empresa. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  protected guardarDatos(): void {
    const actual = this.empresa();
    if (!actual || this.guardandoDatos() || !this.hayCambiosDatos()) {
      return;
    }

    this.guardandoDatos.set(true);
    this.errorGuardarDatos.set(null);

    const pedidos: Observable<unknown>[] = [];
    if (this.nombre().trim() !== actual.nombre) {
      pedidos.push(this.empresaService.corregirNombre(actual.id, this.nombre().trim()));
    }
    if (this.telefono().trim() !== (actual.telefonoContacto ?? '')) {
      pedidos.push(
        this.empresaService.actualizar(actual.id, { telefonoContacto: this.telefono().trim() || undefined }),
      );
    }
    const planElegido = this.planId();
    if (planElegido !== null && planElegido !== this.planIdOriginal) {
      pedidos.push(this.suscripcionService.cambiarPlan(actual.id, planElegido));
    }

    forkJoin(pedidos).subscribe({
      next: () => {
        this.guardandoDatos.set(false);
        this.datosGuardados.set(true);
        this.planIdOriginal = this.planId();
        this.empresa.update((e) =>
          e ? { ...e, nombre: this.nombre().trim(), telefonoContacto: this.telefono().trim() || null } : e,
        );
        this.actualizada.emit();
      },
      error: (err: unknown) => {
        this.guardandoDatos.set(false);
        this.errorGuardarDatos.set(this.mensajeDeError(err));
      },
    });
  }

  protected llamarAhora(): void {
    if (!this.telefono().trim()) {
      return; // sin número no hay llamada — el template ya lo deshabilita
    }
    this.llamadaIniciada.set(true);
    this.mostrarFormularioProgramar.set(false);
    this.horaInicio.set(this.horaActual());
    this.segundos.set(0);
    this.puntosHechos.set([]);
    this.arrancarCrono();
  }

  protected alternarProgramar(): void {
    this.mostrarFormularioProgramar.update((v) => !v);
  }

  protected confirmarProgramarLlamada(): void {
    const actual = this.empresa();
    const fechaHora = this.fechaHoraProgramada();
    if (!actual || !fechaHora || this.programando()) {
      return;
    }

    this.programando.set(true);
    this.errorProgramar.set(null);
    this.empresaService.programarLlamada(actual.id, new Date(fechaHora).toISOString()).subscribe({
      next: () => {
        this.programando.set(false);
        this.mostrarFormularioProgramar.set(false);
        this.agendadaEn.set(new Date(fechaHora));
        this.actualizada.emit();
      },
      error: (err: unknown) => {
        this.programando.set(false);
        this.errorProgramar.set(this.mensajeDeError(err));
      },
    });
  }

  /** Solo limpia la vista: no hay endpoint para desagendar todavía. */
  protected quitarAgenda(): void {
    this.agendadaEn.set(null);
    this.fechaHoraProgramada.set('');
  }

  protected alternarPunto(i: number): void {
    this.puntosHechos.update((hechos) =>
      hechos.includes(i) ? hechos.filter((n) => n !== i) : [...hechos, i],
    );
  }

  protected estaHecho(i: number): boolean {
    return this.puntosHechos().includes(i);
  }

  protected abrirConfirmarLlamadaFinalizada(): void {
    this.errorConfirmarLlamada.set(null);
    this.mostrarConfirmacionLlamada.set(true);
  }

  protected cancelarConfirmacionLlamada(): void {
    this.mostrarConfirmacionLlamada.set(false);
  }

  protected confirmarLlamadaFinalizada(): void {
    const actual = this.empresa();
    if (!actual || this.confirmandoLlamada()) {
      return;
    }

    this.confirmandoLlamada.set(true);
    this.errorConfirmarLlamada.set(null);
    this.empresaService.llamadaFinalizada(actual.id).subscribe({
      next: (empresaActualizada) => {
        this.confirmandoLlamada.set(false);
        this.mostrarConfirmacionLlamada.set(false);
        this.empresa.update((e) => (e ? { ...e, ...empresaActualizada } : e));
        this.actualizada.emit();
        this.entrarPaso2();
      },
      error: (err: unknown) => {
        this.confirmandoLlamada.set(false);
        this.mostrarConfirmacionLlamada.set(false);
        this.errorConfirmarLlamada.set(this.mensajeDeError(err));
      },
    });
  }

  private entrarPaso2(): void {
    this.detenerCrono();
    this.paso.set(2);
    this.enlaceReenviado.set(false);
    this.escucharActivacion();
  }

  /** WebSocket + polling cada 30s como red de seguridad: lo que llegue
   * primero cierra el paso 2 con la animación de activación. */
  private escucharActivacion(): void {
    this.detenerEscucha();

    this.socketSub = this.realtimeService
      .escuchar<EventoEmpresaActivada>('empresa.activada')
      .subscribe((evento) => {
        if (evento.empresaId === this.empresaId()) {
          this.onActivada();
        }
      });

    this.pollingSub = interval(30_000).subscribe(() => {
      this.empresaService.obtenerUno(this.empresaId()).subscribe({
        next: (empresa) => {
          if (empresa.estado === 'activa') {
            this.onActivada();
          }
        },
        // Un poll fallido no tira abajo el asistente: el socket sigue
        // escuchando y el próximo poll lo reintenta solo.
        error: () => undefined,
      });
    });
  }

  private onActivada(): void {
    this.detenerEscucha();
    this.exito.set(true);
    this.actualizada.emit();
  }

  private detenerEscucha(): void {
    this.pollingSub?.unsubscribe();
    this.socketSub?.unsubscribe();
    this.pollingSub = null;
    this.socketSub = null;
  }

  private arrancarCrono(): void {
    this.detenerCrono();
    this.cronoSub = interval(1000).subscribe(() => this.segundos.update((s) => s + 1));
  }

  private detenerCrono(): void {
    this.cronoSub?.unsubscribe();
    this.cronoSub = null;
  }

  protected reenviarEnlace(): void {
    const actual = this.empresa();
    if (!actual || this.reenviando()) {
      return;
    }

    this.reenviando.set(true);
    this.errorReenviar.set(null);
    this.enlaceReenviado.set(false);
    this.empresaService.reenviarEnlace(actual.id).subscribe({
      next: () => {
        this.reenviando.set(false);
        this.enlaceReenviado.set(true);
      },
      error: (err: unknown) => {
        this.reenviando.set(false);
        this.errorReenviar.set(this.mensajeDeError(err));
      },
    });
  }

  protected abrirRechazar(): void {
    this.motivoRechazo.set('');
    this.errorRechazar.set(null);
    this.mostrarRechazar.set(true);
  }

  protected cancelarRechazar(): void {
    this.mostrarRechazar.set(false);
  }

  protected confirmarRechazar(): void {
    const actual = this.empresa();
    const motivo = this.motivoRechazo().trim();
    if (!actual || !motivo || this.rechazando()) {
      return;
    }

    this.rechazando.set(true);
    this.errorRechazar.set(null);
    this.empresaService.rechazar(actual.id, motivo).subscribe({
      next: () => {
        this.rechazando.set(false);
        this.mostrarRechazar.set(false);
        this.detenerEscucha();
        this.detenerCrono();
        this.actualizada.emit();
        this.cerrar.emit();
      },
      error: (err: unknown) => {
        this.rechazando.set(false);
        this.errorRechazar.set(this.mensajeDeError(err));
      },
    });
  }

  protected abrirDetalle(): void {
    this.mostrarDetalle.set(true);
  }

  protected cerrarDetalle(): void {
    this.mostrarDetalle.set(false);
  }

  protected onDetalleActualizado(): void {
    this.actualizada.emit();
  }

  protected verEmpresa(): void {
    this.cerrar.emit();
    void this.router.navigate(['/empresas']);
  }

  protected cerrarYSeguirTrabajando(): void {
    this.cerrar.emit();
  }

  protected cerrarConExito(): void {
    this.cerrar.emit();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrarYSeguirTrabajando();
    }
  }

  protected onModalBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.mostrarConfirmacionLlamada.set(false);
      this.mostrarRechazar.set(false);
    }
  }

  protected iniciales(nombre: string): string {
    return nombre
      .split(' ')
      .filter((palabra) => palabra.length > 2)
      .slice(0, 2)
      .map((palabra) => palabra[0])
      .join('')
      .toUpperCase();
  }

  private nombreDueno(empresa: EmpresaConDueno): string {
    return (
      [empresa.duenoNombres, empresa.duenoApellidos].filter(Boolean).join(' ').trim() ||
      'Sin datos del registro'
    );
  }

  private diasDesde(fechaIso: string): number {
    return Math.max(0, Math.round((Date.now() - new Date(fechaIso).getTime()) / 86_400_000));
  }

  private fechaCorta(fechaIso: string): string {
    return new Date(fechaIso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private fechaAgenda(valorLocal: string): string {
    return this.fechaAgendaDesde(new Date(valorLocal));
  }

  private fechaAgendaDesde(fecha: Date): string {
    return fecha.toLocaleString('es', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private horaActual(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private mensajeDeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const mensaje = (err.error as { message?: string } | null)?.message;
      if (mensaje) {
        return Array.isArray(mensaje) ? mensaje.join(' ') : mensaje;
      }
    }
    return 'No se pudo completar la acción. Intenta de nuevo.';
  }
}
