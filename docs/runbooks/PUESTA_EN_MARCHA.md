# Puesta en marcha de ladder-lab (lo que exige credenciales reales)

Todo lo de este documento lo ejecuta **Freddy**, con sus propias credenciales. Nada se ejecutó: el código y la migración se probaron contra contenedores desechables (`scripts/test-integracion.sh`), no contra Supabase ni contra el Mac Mini. Las credenciales nunca se escriben en el repo ni se pegan en el chat.

Requisitos en el equipo desde el que se ejecuta: `pnpm`, `docker`, `psql`, Supabase CLI y Tailscale.

## 1. Proyecto Supabase propio (nube)

1. Crear un proyecto nuevo, **solo para ladder-lab**. No reutilizar el de otro sistema (riesgo del concepto: incidente de seguridad pendiente en el Mac Mini).
2. Anotar, fuera del repo: la URL del proyecto y la clave `service_role` (Ajustes → API). Esa clave ignora RLS: solo vive en el archivo de entorno del servidor.
3. **Plan gratuito:** el proyecto se pausa tras una semana con poca actividad y no hay copias descargables (`docs/decisions/DECISION_MODELO_DATOS.md`, última sección). Verificar en la documentación vigente la ventana de restauración. El respaldo programado (sección 9) es obligatorio, no opcional.

## 2. Aplicar la migración

```bash
supabase init            # solo si no existe supabase/config.toml; NO sobrescribe supabase/migrations
supabase login           # interactivo, abre el navegador
supabase link --project-ref <ref-del-proyecto>
supabase db push         # aplica supabase/migrations/*.sql
```

Comprobar (SQL editor del proyecto o `psql` con la cadena de conexión del proyecto):

```sql
select count(*) from public.estampas_vigentes;                 -- 0, sin error
select count(*) from pg_trigger where tgname like 'estampa%';  -- los triggers de inmutabilidad existen
-- Debe FALLAR con LL010 (si no falla, la migración no se aplicó entera):
delete from public.estampa_versiones;
```

## 3. Token HTTP

```bash
openssl rand -hex 32
```

Guardarlo en un gestor de contraseñas. Mínimo 32 caracteres (lo exige el arranque del servidor).

## 4. Archivo de entorno en el Mac Mini

Fuera del repo, p. ej. `~/.config/ladder-lab/ladder-lab.env`, con `chmod 600`:

```
MCP_TRANSPORT=http
MCP_AUTH_TOKEN=<el token de la sección 3>
SUPABASE_URL=<url del proyecto>
SUPABASE_SERVICE_KEY=<clave service_role>
LOG_LEVEL=info
```

`MCP_HOST` y `PORT` no hacen falta: la imagen ya fija `0.0.0.0` y `3000` dentro del contenedor.

## 5. Probar el servidor compilado con las credenciales reales (antes de desplegar)

```bash
pnpm build
node --env-file=/ruta/a/ladder-lab.env dist/main.js     # en otra terminal:
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/healthz                                   # 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/mcp                               # 401
```

## 6. Desplegar en el Mac Mini

Según `docs/decisions/DECISION_DEPLOY.md` (supuesto, sin confirmar). A mano, sin workflow:

```bash
docker build -t ladder-lab:local .
docker rm -f ladder-lab 2>/dev/null
docker run -d --name ladder-lab --restart unless-stopped \
  -p <ip-tailscale-del-mac>:3000:3000 \
  --env-file ~/.config/ladder-lab/ladder-lab.env \
  ladder-lab:local
docker inspect -f '{{.State.Health.Status}}' ladder-lab      # healthy tras ~10 s
```

## 7. Registrar el servidor en Claude Code del PC de juegos

```bash
claude mcp add --transport http --scope user ladder-lab \
  http://<host-tailscale-del-mac>:3000/mcp \
  --header "Authorization: Bearer <TOKEN>"
```

`--scope user` guarda el token en la configuración local del usuario, no en `.claude/settings.json` de ningún repo.

## 8. Comprobar de verdad (cada una debe poder fallar)

| Comprobación                                         | Esperado                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| `curl -X POST http://<host>:3000/mcp` sin cabecera   | `401`                                                                 |
| La misma con `Authorization: Bearer basura`          | `401` (si da 200, el servicio no autentica y todo lo demás vale cero) |
| `curl http://<host>:3000/healthz`                    | `200`                                                                 |
| Desde Claude Code: `/mcp`                            | `ladder-lab` conectado con las herramientas                           |
| `crear_estampa` → `ver_estampa` → `corregir_estampa` | versión 2, y `ver_estampa` indica `totalVersiones: 2`                 |
| `exportar` con `incluirVersiones`                    | la versión 1 sigue ahí                                                |
| `docker logs ladder-lab`                             | ningún token ni clave                                                 |
| Desde otro equipo fuera del tailnet                  | sin respuesta                                                         |

## 9. Respaldo programado (FASE_3)

Detalle y límites en `docs/decisions/DECISION_RESPALDO.md`. En el plan gratuito de Supabase **no hay copias descargables**: este respaldo es la única red de seguridad.

**Hacer un respaldo a mano** (desde el Mac Mini, con la misma imagen y el mismo archivo de entorno del servidor):

```bash
mkdir -p ~/respaldos/ladder-lab
docker run --rm --user "$(id -u):$(id -g)" \
  --env-file ~/.config/ladder-lab/ladder-lab.env \
  -v ~/respaldos/ladder-lab:/respaldos -e RESPALDO_DIR=/respaldos \
  ladder-lab:local node dist/respaldo.js
echo "código de salida: $?"     # 0 bien · 1 falló · 2 hecho pero con alerta
```

Debe imprimir el denominador (estampas y versiones) y dejar un `ladder-lab-AAAAMMDDTHHMMSSZ.json`. Verificarlo:

```bash
docker run --rm --env-file ~/.config/ladder-lab/ladder-lab.env \
  -v ~/respaldos/ladder-lab:/respaldos:ro ladder-lab:local \
  node dist/respaldo.js --verificar /respaldos/<archivo>.json
```

**Programarlo** (una vez al día basta; también mantiene activa la base): una entrada de `cron` o un `launchd` en el Mac con el primer comando. Que el programador avise si el código de salida no es 0.

**Copiar fuera del Mac Mini y de Supabase** (Freddy elige el destino; ninguna credencial va al repo). **Sin `--delete` a propósito**: la retención local poda archivos viejos y un espejo exacto vaciaría el respaldo externo justo cuando el local falla; la retención del destino externo es decisión de Freddy:

```bash
rsync -a ~/respaldos/ladder-lab/ <destino-externo>:ladder-lab/   # o: rclone copy …
```

**Restaurar** (base nueva con las migraciones ya aplicadas, sección 2). Primero simular, luego aplicar:

```bash
docker run --rm --env-file <entorno-de-la-base-destino> -v ~/respaldos/ladder-lab:/respaldos:ro \
  ladder-lab:local node dist/restaurar.js /respaldos/<archivo>.json            # simula
docker run --rm --env-file <entorno-de-la-base-destino> -v ~/respaldos/ladder-lab:/respaldos:ro \
  ladder-lab:local node dist/restaurar.js /respaldos/<archivo>.json --aplicar  # restaura
```

**Prueba obligatoria antes de confiar en el respaldo:** restaurar un respaldo real en un proyecto Supabase de prueba vacío y comparar con `exportar`. Un respaldo que nunca se restauró no está probado.

## 10. Uso real y congelar el formato (tarea 1.12 y compuerta de F2)

1. Cargar estampas reales con `crear_estampa`. Anotar en `docs/flows.md` lo que no se entienda o resulte torpe.
2. Con las primeras estampas reales, revisar `docs/decisions/DECISION_FORMATO_ESTAMPA_V1.md` y marcar el formato como **congelado** con fecha. Desde ahí un cambio incompatible exige `version: 2` y un migrador (`DECISION_VERSIONADO_FORMATO.md`).
3. Hacer un `exportar` con `incluirVersiones` y comprobar a mano que reconstruye los datos.
4. Umbral de «F1 en uso»: 10 estampas reales. La compuerta de F2 se levantó por orden de Freddy el 2026-11-05 sin cumplirlo; ver `docs/decisions/DECISION_COMPUERTA_F2.md`.

## Rotación del token y reversa

- **Rotar el token:** generar uno nuevo, cambiarlo en el archivo de entorno y en `claude mcp add` (`claude mcp remove ladder-lab` y volver a agregar), reiniciar el contenedor. El anterior deja de valer al instante.
- **Volver atrás:** `docker rm -f ladder-lab`. Los datos no se tocan (están en Supabase y las versiones no se pueden borrar).

## Qué no se pudo verificar sin credenciales

- La migración contra un proyecto Supabase real (sí contra la imagen oficial de Supabase Postgres y PostgREST).
- El repositorio de `supabase-js` contra la API real de Supabase (sí contra PostgREST real, con el mismo contrato que el doble).
- La conexión por Tailscale desde el PC de juegos y el despliegue en el Mac Mini.
- El comportamiento de pausa e inactividad del plan gratuito.
- El respaldo y la restauración contra un proyecto Supabase real y con una carpeta externa real (sí contra Postgres de Supabase real en contenedor y dentro de la imagen Docker).
