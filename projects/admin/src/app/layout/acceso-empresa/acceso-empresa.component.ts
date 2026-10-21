import { RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
  IconAlertTriangle,
  IconBan,
  IconCalendarDue,
  IconClockPause,
  IconGift,
  IconHourglass,
  IconLock,
  IconMessageCircle,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { AuthService } from '../../core/auth/auth.service';
import { AccesoEmpresa } from '../../core/auth/models/current-user.model';

const TITULOS: Record<string, string> = {
  suspendida: 'Tu cuenta está suspendida',
  cancelada: 'Tu cuenta fue dada de baja',
  rechazada: 'Tu solicitud no fue aprobada',
  alta_en_curso: 'Tu cuenta se está activando',
  sin_plan: 'Tu cuenta no tiene un plan activo',
  suscripcion_vencida: 'Tu suscripción venció',
  prueba_terminada: 'Terminó tu prueba gratis',
};

/**
 * Aviso de acceso de la Empresa según `CurrentUser.accesoEmpresa`, en tres
 * variantes:
 *
 * - `variante="cobro"` — el cobro del próximo mes ya se generó: franja
 *   informativa con fecha y monto.
 * - `variante="banner"` — en mora dentro de la gracia: una franja arriba
 *   del contenido, sin cortar nada.
 * - `variante="bloqueo"` — Empresa no operativa: reemplaza el contenido del
 *   Shell. El backend ya rechaza las llamadas (`AccesoEmpresaInterceptor`),
 *   esto solo explica por qué y qué hacer. Queda la topbar para salir.
 */
@Component({
  selector: 'app-acceso-empresa',
  standalone: true,
  imports: [TablerIconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variante() === 'banner') {
      <div class="flex items-start gap-3 border-b border-[#f3d38a] bg-[#fff8e1] px-6 py-3 text-[13px] text-[#5c4300]" role="status">
        <tabler-icon [icon]="iconoMora" [size]="18" [stroke]="2" class="mt-px shrink-0 text-[#b07400]" />
        <p class="m-0 flex-1 leading-5">
          <strong class="font-semibold">Pago pendiente.</strong>
          {{ acceso().mensaje }} Si ya pagaste, envíale el comprobante al equipo de Goods.
        </p>
      </div>
    } @else if (variante() === 'prueba') {
      <!-- Período de prueba: azul mientras quedan días, ámbar los últimos 3. -->
      <div
        class="flex items-start gap-3 border-b px-6 py-3 text-[13px]"
        [class]="pruebaUrgente() ? 'border-[#f3d38a] bg-[#fff8e1] text-[#5c4300]' : 'border-[#cfe3f5] bg-[#f0f7fd] text-[#0c4a6e]'"
        role="status"
      >
        <tabler-icon [icon]="iconoPrueba" [size]="18" [stroke]="2" class="mt-px shrink-0" [class]="pruebaUrgente() ? 'text-[#b07400]' : 'text-badge-info-solid'" />
        <p class="m-0 flex-1 leading-5">
          <strong class="font-semibold">{{ tituloPrueba() }}</strong>
          @if (acceso().pruebaHasta; as hasta) {
            Puedes usar Goods gratis hasta el {{ fecha(hasta) }}.
          }
          @if (acceso().proximoCobro; as c) {
            Para seguir sin interrupciones, paga {{ monto(c.monto) }} y envíale el comprobante al equipo de Goods.
          } @else {
            Antes de que termine te avisamos cómo pagar para seguir sin interrupciones.
          }
        </p>
      </div>
    } @else if (variante() === 'cobro') {
      @if (acceso().proximoCobro; as c) {
        <div class="flex items-start gap-3 border-b border-[#cfe3f5] bg-[#f0f7fd] px-6 py-3 text-[13px] text-[#0c4a6e]" role="status">
          <tabler-icon [icon]="iconoCobro" [size]="18" [stroke]="2" class="mt-px shrink-0 text-badge-info-solid" />
          <p class="m-0 flex-1 leading-5">
            <strong class="font-semibold">Tu plan se renueva el {{ fecha(c.fechaLimite) }}.</strong>
            El cobro es de {{ monto(c.monto) }}. Si ya pagaste, envíale el comprobante al equipo de Goods.
          </p>
        </div>
      }
    } @else {
      <div class="flex min-h-full items-center justify-center p-6">
        <div class="w-full max-w-[460px] rounded-2xl bg-card-bg p-8 shadow-[0_1px_0_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.05)]">
          <span class="flex size-11 items-center justify-center rounded-xl" [class]="tono().caja">
            <tabler-icon [icon]="tono().icono" [size]="22" [stroke]="2" [class]="tono().tinta" />
          </span>
          <h1 class="mt-5 text-xl font-semibold tracking-[-0.01em] text-gray-900">{{ titulo() }}</h1>
          <p class="mt-2 text-sm leading-6 text-gray-600">{{ acceso().mensaje }}</p>
          @if (acceso().motivoEstado) {
            <p class="mt-3 rounded-lg bg-canvas-bg px-3.5 py-2.5 text-[13px] leading-5 text-gray-700">
              <span class="font-medium">Motivo:</span> {{ acceso().motivoEstado }}
            </p>
          }
          <p class="mt-4 text-sm leading-6 text-gray-600">{{ queHacer() }}</p>
          @if (conChat()) {
            <a
              routerLink="/messages"
              class="mt-5 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-gray-700"
            >
              <tabler-icon [icon]="iconoChat" [size]="16" [stroke]="2" />
              Hablar con Goods
            </a>
          }
          <p class="mt-5 text-xs text-gray-400">
            Tus datos siguen guardados. Puedes cerrar sesión desde la parte superior.
          </p>
        </div>
      </div>
    }
  `,
})
export class AccesoEmpresaComponent {
  readonly acceso = input.required<AccesoEmpresa>();
  /** `banner`: en mora · `cobro`: próximo cobro generado · `bloqueo`: sin acceso. */
  readonly variante = input<'banner' | 'cobro' | 'prueba' | 'bloqueo'>('bloqueo');

  protected readonly iconoMora = IconHourglass;
  protected readonly iconoCobro = IconCalendarDue;
  protected readonly iconoChat = IconMessageCircle;
  protected readonly iconoPrueba = IconGift;

  /** Días que quedan de prueba (redondeado hacia arriba). */
  private readonly diasPrueba = computed(() => {
    const hasta = this.acceso().pruebaHasta;
    return hasta ? Math.max(0, Math.ceil((new Date(hasta).getTime() - Date.now()) / 86_400_000)) : null;
  });
  protected readonly pruebaUrgente = computed(() => (this.diasPrueba() ?? 99) <= 3);
  protected readonly tituloPrueba = computed(() => {
    const d = this.diasPrueba();
    if (d === null) return 'Estás en tu prueba gratis.';
    if (d <= 1) return 'Tu prueba gratis termina mañana.';
    return `Te quedan ${d} días de prueba gratis.`;
  });
  /** El chat con soporte sigue abierto con la cuenta bloqueada (no durante el alta: todavía no hay nada que gestionar ahí). */
  protected readonly conChat = computed(() => this.acceso().motivo !== 'alta_en_curso');

  protected fecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  }

  protected monto(valor: number): string {
    return `$${Math.round(valor).toLocaleString('es-CO')}`;
  }

  protected readonly titulo = computed(() => TITULOS[this.acceso().motivo ?? ''] ?? 'Tu cuenta no está disponible');

  protected readonly tono = computed(() => {
    switch (this.acceso().motivo) {
      case 'alta_en_curso':
        return { icono: IconClockPause, caja: 'bg-badge-info-bg', tinta: 'text-badge-info-solid' };
      case 'suscripcion_vencida':
      case 'prueba_terminada':
      case 'sin_plan':
        return { icono: IconAlertTriangle, caja: 'bg-badge-warning-bg', tinta: 'text-[#5c4300]' };
      case 'cancelada':
      case 'rechazada':
        return { icono: IconBan, caja: 'bg-field-error-bg', tinta: 'text-badge-error-solid' };
      default:
        return { icono: IconLock, caja: 'bg-field-error-bg', tinta: 'text-badge-error-solid' };
    }
  });

  protected readonly queHacer = computed(() => {
    switch (this.acceso().motivo) {
      case 'suscripcion_vencida':
        return 'Para recuperar el acceso, realiza el pago de tu plan y envíale el comprobante al equipo de Goods. Apenas lo registremos, tu cuenta vuelve a funcionar.';
      case 'prueba_terminada':
        return 'Para seguir usando Goods, realiza el pago de tu plan y envíale el comprobante al equipo de Goods. Apenas lo registremos, tu cuenta vuelve a funcionar con todo lo que cargaste.';
      case 'alta_en_curso':
        return 'Te avisaremos por correo cuando esté lista.';
      case 'sin_plan':
        return 'Comunícate con el equipo de Goods para elegir un plan.';
      default:
        return 'Si crees que es un error, comunícate con el equipo de Goods.';
    }
  });
}
