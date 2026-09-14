# Frontend — Goods

Workspace Angular de **Goods**, calcado visualmente de Shopify Admin sobre
datos y flujos propios. Contiene dos proyectos hoy: `admin` (el admin de
un emprendimiento) y `staff` (el panel de staff de Goods, todavía sin
pantallas reales), más una librería compartida entre ambos, `shared-ui`.

Goods está pivotando de administrar una sola tienda a ser un **SaaS
multi-tenant** (ver
[`../PIVOTE_SAAS_MULTITENANT.md`](../PIVOTE_SAAS_MULTITENANT.md), en la
raíz del workspace): Goods pasa a ser el proveedor de esta herramienta de
administración para muchos emprendimientos (cada uno una `Empresa`/tenant),
no el dueño de una tienda. Del lado del backend ese pivote ya está
terminado (ver `MODULOS_PENDIENTES.md` en `../backend`); del lado del
frontend ya está hecho el scaffold del panel de staff como proyecto
Angular aparte, `shared-ui` como librería real del workspace (§4/§8
punto 3 de `PIVOTE_SAAS_MULTITENANT.md`), y `core/auth` real en `admin`
(login, tokens, guard de rutas, `GET /auth/me` para saber qué Empresa y
qué rol tiene el usuario logueado — §8 punto 2). Todavía falta construir
las pantallas propias del panel de staff (separar rutas/sidebar de las
de `admin`, punto 5 del mismo documento) y la página pública de
registro/checkout. Más adelante este workspace va a sumar un tercer
proyecto (la tienda pública de cada emprendimiento, cuando exista el Plan
Plus).

Ver **[`ADMIN_DISENO.md`](./ADMIN_DISENO.md)** para el detalle completo:
tokens de diseño extraídos de las capturas de Shopify, qué compara
contra qué captura, y las decisiones técnicas tomadas a medida que se
construyó cada composite (por qué `p-table` no se puede envolver en un
componente propio, por qué `SelectionCheckboxComponent` es manual, la
estructura de carpetas de `features/`/`core`/`layout`/`shared`, etc.).
Es el documento de referencia de este repo — no un README aparte que se
desactualiza.

## Stack

- **Angular 21** (standalone components, signals — sin `NgModule`).
- **PrimeNG 21** con `theme: 'none'` — solo se usa por comportamiento
  (overlays, positioning, accesibilidad), el estilo visual completo es
  Tailwind vía la API `pt` (pass-through) de PrimeNG.
- **Tailwind CSS v4** — tokens de diseño como bloque `@theme`, calcados
  con pipeta de las capturas reales de Shopify (ver `ADMIN_DISENO.md`).
  Definidos hoy por separado en `projects/admin/src/styles.css` y
  `projects/staff/src/styles.css` (mismos valores, duplicados a
  propósito por ahora — extraerlos a un preset de Tailwind compartido
  entre los dos proyectos queda como mejora futura, no bloqueante).
- **npm** como gestor de paquetes (usar `--legacy-peer-deps` al instalar
  — ver nota abajo).

## Arrancar en desarrollo

```bash
npm install --legacy-peer-deps
ng serve admin   # admin de un emprendimiento — http://localhost:4200
ng serve staff   # panel de staff de Goods — puerto distinto si corren juntos
```

> El flag `--legacy-peer-deps` hace falta por un conflicto de peers de
> `vitest` al instalar, no por PrimeNG — hay que repetirlo en cada
> instalación nueva de paquetes en este proyecto.

`admin` pide login real (`core/auth`) contra el backend en
`environment.apiUrl` (`projects/admin/src/environments/environment.ts`,
por defecto `http://localhost:3000/api` en desarrollo) — hace falta el
backend corriendo para entrar.

## Estructura

```
projects/
├── admin/src/app/            # admin de un emprendimiento (cliente de Goods)
│   ├── core/                   # servicios singleton de toda la app (auth/http/layout state)
│   ├── layout/                  # el shell: shell/ (topbar+sidebar+router-outlet), sidebar/, topbar/
│   ├── features/                # una carpeta por área de negocio (dashboard, orders, products, customers)
│   │   └── <feature>/             # pages/ (atadas a ruta) + components/ + services/ + models/
│   ├── shared/
│   │   ├── models/                 # tipos genéricos cross-feature
│   │   └── (ui/ y utils/ se movieron a la librería shared-ui, ver abajo)
│   ├── app.routes.ts              # lazy-load de cada features/*/*.routes.ts, bajo el shell
│   └── app.ts / app.html           # `<router-outlet />` — el layout real vive en layout/shell
├── staff/src/app/             # panel de staff de Goods (administra clientes, no una tienda)
│   └── app.ts / app.html          # todavía un placeholder — ver PIVOTE_SAAS_MULTITENANT.md §8 punto 5
└── shared-ui/src/lib/         # librería Angular real del workspace, consumida por admin y staff
    ├── status-badge/               # StatusBadgeComponent
    ├── data-table/                  # DataTableComponent + dataTablePt() + SelectionCheckboxComponent
    ├── order-line-item/              # OrderLineItemComponent
    ├── quick-adjust-popover/          # QuickAdjustPopoverComponent
    └── utils/format-money.ts          # formatMoney (la usa OrderLineItemComponent)
```

`shared-ui` (`projects/shared-ui/`) empezó como una carpeta interna de
`admin` (`shared/ui/`) y se promovió a librería real del workspace
(`ng generate library shared-ui`) recién cuando existió un segundo
proyecto que la consume de verdad (`staff`) — antes de eso, diseñar una
API pública de librería hubiera sido a ciegas. Se importa como cualquier
paquete: `import { StatusBadgeComponent } from 'shared-ui';`. El detalle
de diseño de cada composite (por qué está armado así, contra qué captura
de Shopify se verificó) sigue en `ADMIN_DISENO.md` — mudarlos de carpeta
no cambió su diseño ni su comportamiento.

`features/dev-showcase` de `admin` (ruta `/dev`, fuera del sidebar) no es
una pantalla de negocio — es donde se comparan los composites de
`shared-ui` contra las capturas de Shopify antes de darlos por buenos. Se
mantiene aparte para no ensuciar el shell real.

Más contexto de cada decisión de estructura (por qué en inglés, la
historia de por qué `shared/ui` no era librería y cuándo pasó a serlo,
etc.) está en `ADMIN_DISENO.md`.

## Build

```bash
ng build admin
ng build staff
ng build shared-ui   # solo hace falta a mano si se toca la librería fuera de un build de admin/staff
```

## Tests

```bash
ng test admin
ng test staff
```

## Flujo de ramas

Repo privado, GitHub Flow:

- `main` siempre queda en un estado andante (`ng build admin` y
  `ng build staff` sin errores).
- Todo cambio va en una rama nueva desde `main`: `feature/<algo>` para
  funcionalidad nueva, `fix/<algo>` para corrección de bugs (ej.
  `feature/order-detail-page`, `fix/badge-color-contraste`).
- Commits con prefijo de tipo — `feat:`, `fix:`, `docs:`, `refactor:`,
  `test:`, `chore:` — ayuda a que el historial de `main` se lea como una
  lista de cambios, aunque no haya changelog automático todavía.
- Al terminar: Pull Request a `main`. Revisar el diff (aunque sea de uno
  mismo), mergear con **squash** para que cada feature quede como un
  commit en `main`, borrar la rama.
- Repo hermano: [`backend`](../backend) (NestJS + PostgreSQL).
