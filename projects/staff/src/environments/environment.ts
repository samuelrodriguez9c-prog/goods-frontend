/**
 * Environment de desarrollo — mismo patrón que `admin` (ver ese
 * `environments/environment.ts`): reemplazado por
 * `environment.production.ts` en el build de producción vía
 * `fileReplacements` (angular.json, target `staff`). Primera vez que
 * `staff` necesita saber a qué `apiUrl` pegarle — antes era un placeholder
 * sin llamadas HTTP (ver PIVOTE_SAAS_MULTITENANT.md §8 paso 5).
 *
 * Mismo backend que `admin` (`goods-backend` no se separó, ver
 * PIVOTE_SAAS_MULTITENANT.md §4) — lo que cambia es el rol/permisos del
 * usuario logueado (`staff_goods`), no la URL de la API.
 *
 * `socketUrl` — primera vez que `staff` necesita un socket (§4/§11 Paso 3,
 * evento `empresa.activada` del asistente de activación, ver
 * `RealtimeService`): es la raíz del mismo backend (`RealtimeGateway`
 * cuelga del mismo servidor Nest, pero SIN el `setGlobalPrefix('api')`
 * que sí tiene el resto de las rutas HTTP — ver `main.ts` — así que no
 * lleva el sufijo `/api` que tiene `apiUrl`). Clave separada en vez de
 * derivarla con un `.replace()` sobre `apiUrl`, para que quede explícita.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  socketUrl: 'http://localhost:3000',
};
