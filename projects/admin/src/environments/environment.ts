/**
 * Environment de desarrollo — reemplazado por `environment.production.ts`
 * en el build de producción (ver `fileReplacements` en angular.json, target
 * `admin`). No existía ningún archivo de environments todavía; se agrega
 * junto con `core/auth`/`core/http` porque es la primera vez que el admin
 * necesita saber a qué URL de API pegarle (ver PIVOTE_SAAS_MULTITENANT.md
 * §8 punto 2).
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
};
