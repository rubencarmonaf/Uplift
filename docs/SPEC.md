# Uplift · Especificación funcional (v0.2)

> Documento de producto redactado desde cero. Describe **qué** hace la herramienta, no **cómo** está implementada.
> No contiene código, contratos de API, textos ni diseño procedentes de ningún producto existente.

## 1. Visión

Herramienta web para equipos de marketing y CRO que permite **mejorar la conversión de una página web reescribiendo sus textos clave con IA**, respetando la marca y las restricciones legales, y **medir qué versión funciona mejor** mediante experimentos A/B servidos por un script ligero instalado en la web del cliente.

Flujo principal:

```
Crear proyecto (URL) → Marcar elementos a optimizar → Definir contexto y reglas
→ Generar variantes con IA → Revisar/aprobar → Definir objetivos
→ Previsualizar → Activar script → Medir resultados → Elegir ganadora
```

## 2. Usuarios y roles

- **Admin de organización**: gestiona miembros, claves de IA y ajustes globales.
- **Editor**: crea y edita proyectos, genera variantes y lanza experimentos.
- **Lector**: consulta proyectos y resultados.

Multi-tenant desde el inicio: todo recurso pertenece a una **organización** (workspace).

## 3. Módulos

### 3.1 Autenticación y cuenta

- Registro, login y logout con email y contraseña. Magic link y OAuth (Google) quedan para después del MVP.
- Recuperación de contraseña.
- Perfil: nombre, idioma de la interfaz y zona horaria.
- Sesiones seguras: token opaco en cookie httpOnly; en la base de datos solo se guarda su hash, con renovación deslizante y revocables al hacer logout.

### 3.2 Proyectos

- Un proyecto representa **una página (o plantilla de página)** a optimizar: nombre, URL, sector, tipo de página e idioma o mercado principal.
- Listado con búsqueda, filtros por estado y orden.
- Acciones: crear, editar, duplicar (con sus elementos, brief y objetivos), archivar y eliminar.
- Estados: `borrador → listo → en experimento → finalizado`.
- Dentro de un proyecto, navegación por pasos (wizard/sidebar) con indicador de progreso por paso.

### 3.3 Elementos a optimizar

- El usuario define qué elementos de la página quiere optimizar (titular, subtítulo, CTA, bullet de beneficios…).
- Selección del elemento:
  - escribiendo manualmente un selector CSS, o
  - **seleccionándolo visualmente** sobre una copia renderizada de la página (modo "picker"): el backend la abre con un navegador headless, incrusta su CSS y elimina los scripts; el front la muestra en un iframe aislado donde, al hacer clic, se obtienen el selector, el texto y un tipo sugerido.
- Por elemento: tipo, texto original (extraído automáticamente), longitud mínima y máxima, y notas.
- Validación: el selector debe resolver exactamente un elemento en la página.

### 3.4 Contexto y reglas (brief)

Configurable a **nivel de proyecto** y **sobrescribible por elemento**. Se organiza en bloques:

- **Voz y tono**: tono, complejidad del lenguaje y longitud preferida.
- **Negocio y página**: qué se vende, objetivo de la página, fase del funnel, propuestas de valor, objeciones habituales y mercado o idioma.
- **Fuente de verdad**: hechos verificables que la IA puede usar y afirmaciones que nunca debe hacer.
- **Marca y cumplimiento**: nivel de riesgo del sector, palabras vetadas, afirmaciones obligatorias y prohibidas, disclaimers y tonos a evitar.

Plantillas de brief reutilizables a nivel de organización ("Brand kits").

### 3.5 Generación de variantes con IA

- Para cada elemento, generar N variantes (configurable) a partir del texto original y el brief.
- Cada variante incluye:
  - el texto propuesto,
  - una **justificación breve** (qué palanca psicológica o ángulo usa),
  - una **puntuación de cumplimiento** (¿respeta las reglas?), con los avisos concretos si no las cumple,
  - una **puntuación de calidad estimada** (claridad, especificidad, longitud).
- Estados de variante: `activa` o `descartada` (se puede restaurar).
- Acciones: regenerar, editar a mano, añadir una variante manual, descartar y restaurar.
- Progreso visible en tiempo real mientras se genera (streaming o SSE).
- Historial de generaciones para no perder variantes anteriores.

### 3.6 Objetivos (goals)

- Un objetivo **primario** y varios **secundarios** por proyecto.
- Tipos de objetivo:
  - clic en un elemento (selector),
  - visita a una URL (coincidencia exacta, prefijo o regex),
  - evento personalizado (dataLayer o llamada JS).

### 3.7 Previsualización

- Ver la página con las variantes aplicadas, cambiando de variante por elemento.
- Vista escritorio y móvil.
- Opción de ocultar banners de cookies o popups para una vista limpia.
- Estados de carga claros mientras se renderiza la página.
- Enlace de preview compartible (token temporal) para enseñárselo a stakeholders sin cuenta.

### 3.8 Activación (script de experimentos)

- Snippet JS para instalar en la web del cliente (una línea).
- El script:
  - asigna al visitante una variante de forma persistente (cookie o localStorage),
  - aplica los textos,
  - evita el parpadeo del contenido original con un anti-flicker y timeout configurable,
  - registra impresiones y conversiones.
- Configuración: ámbito (dominios y rutas donde se ejecuta), anti-flicker, reparto de tráfico (%), fecha de inicio y fin.
- Estados de activación: `inactivo → activo → pausado → finalizado`.
- Verificación de instalación ("¿está el script detectado en la URL?").

### 3.9 Resultados

- Por variante: visitantes, conversiones, tasa de conversión, uplift frente al control e **intervalo de confianza / probabilidad de ser mejor** (enfoque bayesiano recomendado).
- Gráfica temporal de la evolución.
- Resaltado visual de la ganadora y de las perdedoras cuando se cumplen los criterios (muestra mínima y umbral de probabilidad).
- Botón "Aplicar ganadora" para dejarla fija al 100 %.
- **Modo demo (prioritario, es un proyecto de portfolio)**: simulación de tráfico **determinista** (con semilla, siempre reproducible), con métricas que se actualizan de forma animada para enseñar la herramienta sin tráfico real.

### 3.10 Biblioteca y plantillas

- Biblioteca de variantes ganadoras reutilizables entre proyectos.
- Plantillas de proyecto por sector o tipo de página (landing SaaS, ficha de producto, etc.).

### 3.11 Ajustes

- Organización: nombre, miembros e invitaciones, y roles.
- Proveedor de IA y modelo por defecto, y límites de uso.
- Idiomas soportados para generación.

## 4. Requisitos no funcionales

- **i18n** de la interfaz desde el día 1 (es, en al menos).
- **Accesibilidad** WCAG AA en la app.
- **Rendimiento del snippet**: menos de 10 KB gzip, sin dependencias y servido desde CDN.
- **Privacidad**: sin datos personales en el tracking (IDs anónimos), compatible con el consentimiento de cookies del cliente.
- **Auditoría**: registro de quién aprobó o activó qué y cuándo.
- **Observabilidad**: logs estructurados y trazas de las llamadas a la IA (coste y latencia).

## 5. Arquitectura técnica (decidida)

- **Monorepo** con pnpm workspaces:
  - `apps/web`: React, Vite, TypeScript, React Router, TanStack Query, shadcn/ui, Tailwind, react-hook-form, zod, Recharts y react-i18next.
  - `apps/api`: Node, **NestJS 12** (ESM, compilado con SWC), TypeScript, zod para validar (pipe propio).
  - `packages/shared`: esquemas zod y tipos compartidos entre web y api.
  - `packages/snippet`: script de experimentos (bundle mínimo).
- **Base de datos**: PostgreSQL con **Drizzle ORM** y sus migraciones.
- **Jobs asíncronos** (generación IA, capturas de página): cola (p. ej. BullMQ con Redis) o, para empezar, jobs en proceso.
- **Render o captura de páginas** para preview y picker: Playwright en el backend.
- **IA**: capa de proveedor abstracta (Claude por defecto) con salidas estructuradas validadas por zod.
- **Local**: docker-compose con Postgres y Redis.

## 6. Roadmap propuesto

| Fase                | Contenido                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| **0. Base**         | Monorepo, lint y format, CI, docker-compose, auth, organizaciones y layout de la app             |
| **1. MVP**          | Proyectos, elementos (selector manual), brief, generación de variantes y previsualización básica |
| **2. Experimentos** | Objetivos, snippet, tracking, resultados con estadística y modo demo                             |
| **3. Pulido**       | Picker visual, brand kits, biblioteca, enlaces de preview compartibles, roles                    |
| **4. Portfolio**    | Onboarding, landing pública, proyecto demo precargado y despliegue público                       |

## 7. Decisiones de alcance (proyecto de portfolio)

- Sin facturación. Organizaciones y roles se mantienen simples (una organización por usuario en el MVP).
- Tracking propio y ligero. Las integraciones con GA4 u otras herramientas quedan fuera del alcance.
- Idiomas de interfaz: es y en. La generación admite cualquier idioma que soporte el modelo.
- Demo pública con un usuario de prueba y datos simulados para que cualquier reclutador pueda probarla.
