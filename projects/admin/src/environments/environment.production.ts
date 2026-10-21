/**
 * Environment de producción. `socketUrl` va sin `/api` (ver `environment.ts`).
 */
// TODO(infra): poner `apiUrl` y `socketUrl` reales cuando exista el dominio de despliegue.
export const environment = {
  production: true,
  apiUrl: 'https://api.goods.example.com/api',
  socketUrl: 'https://api.goods.example.com',
};
