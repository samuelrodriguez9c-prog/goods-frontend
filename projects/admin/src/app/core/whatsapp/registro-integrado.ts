/**
 * Registro integrado de Meta (Embedded Signup) para conectar el número de
 * WhatsApp del negocio. Carga el SDK de Facebook bajo demanda, abre la
 * ventana de Meta y junta las dos cosas que devuelve: el `code` (por el
 * callback de `FB.login`) y los ids de la cuenta y el número (por un
 * `postMessage` de la ventana). El backend cambia el código por el token.
 *
 * `featureType: 'whatsapp_business_app_onboarding'` es la coexistencia: el
 * dueño conecta el número que ya usa en la app WhatsApp Business del
 * celular y la sigue usando (PROPUESTA_WHATSAPP.md §4.3).
 */
interface FacebookSdk {
  init(o: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void;
  login(cb: (r: { authResponse?: { code?: string } | null }) => void, o: Record<string, unknown>): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

export interface ResultadoRegistro {
  code: string;
  wabaId: string;
  phoneNumberId: string;
}

let cargando: Promise<FacebookSdk> | null = null;

function cargarSdk(appId: string, version: string): Promise<FacebookSdk> {
  if (window.FB) return Promise.resolve(window.FB);
  cargando ??= new Promise<FacebookSdk>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve(window.FB!);
    };
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/es_LA/sdk.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
      cargando = null;
      reject(new Error('No se pudo cargar la ventana de Meta. Revisa tu conexión o si un bloqueador de anuncios la está frenando.'));
    };
    document.body.appendChild(script);
  });
  return cargando;
}

export async function abrirRegistroIntegrado(o: { appId: string; configId: string; graphVersion: string }): Promise<ResultadoRegistro> {
  const fb = await cargarSdk(o.appId, o.graphVersion);
  return new Promise<ResultadoRegistro>((resolve, reject) => {
    let ids: { wabaId: string; phoneNumberId: string } | null = null;
    let code: string | null = null;
    let terminado = false;

    const terminar = (error?: Error) => {
      if (terminado) return;
      if (!error && !(ids && code)) return;
      terminado = true;
      window.removeEventListener('message', alMensaje);
      if (error) reject(error);
      else resolve({ code: code!, ...ids! });
    };

    const alMensaje = (e: MessageEvent) => {
      if (!/^https:\/\/([\w-]+\.)?facebook\.com$/.test(e.origin)) return;
      let datos: { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string; current_step?: string } };
      try {
        datos = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (datos?.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (datos.event === 'CANCEL') {
        terminar(new Error('Cerraste la ventana de Meta antes de terminar.'));
      } else if (datos.event?.startsWith('FINISH') && datos.data?.waba_id && datos.data.phone_number_id) {
        ids = { wabaId: datos.data.waba_id, phoneNumberId: datos.data.phone_number_id };
        terminar();
      }
    };
    window.addEventListener('message', alMensaje);

    fb.login(
      (r) => {
        code = r.authResponse?.code ?? null;
        if (!code) terminar(new Error('Meta no autorizó la conexión.'));
        else if (!ids) {
          // El aviso con los ids puede llegar un instante después del código.
          setTimeout(() => terminar(new Error('Meta no nos dijo qué número elegiste. Intenta de nuevo.')), 5000);
        }
        terminar();
      },
      {
        config_id: o.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' },
      },
    );
  });
}
