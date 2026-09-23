/**
 * Environment de desarrollo — reemplazado por `environment.production.ts`
 * en el build de producción (ver `fileReplacements` en angular.json, target
 * `admin`). No existía ningún archivo de environments todavía; se agrega
 * junto con `core/auth`/`core/http` porque es la primera vez que el admin
 * necesita saber a qué URL de API pegarle (ver PIVOTE_SAAS_MULTITENANT.md
 * §8 punto 2).
 *
 * `socketUrl` — primera vez que `admin` necesita un socket real (Messages,
 * ver `MessageListPageComponent`/`RealtimeService`): mismo criterio que
 * `staff/src/environments/environment.ts` — es la raíz del mismo backend
 * (`RealtimeGateway` cuelga del mismo servidor Nest, pero SIN el
 * `setGlobalPrefix('api')` que sí tiene el resto de las rutas HTTP — ver
 * `main.ts`), así que no lleva el sufijo `/api` que sí tiene `apiUrl`.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  socketUrl: 'http://localhost:3000',
};
