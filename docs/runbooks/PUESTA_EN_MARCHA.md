# Puesta en marcha de ladder-lab y sens-lab

**Desplegado el 2026-11-05.** Base en Neon, pila en el Mac Mini, acceso solo por Tailscale. Por qué así: [`DECISION_BASE_NEON.md`](../decisions/DECISION_BASE_NEON.md).

| qué       | dónde                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------- |
| MCP       | `https://mac-mini-server.tail1798c7.ts.net:8444/mcp`                                            |
| sens-lab  | `https://mac-mini-server.tail1798c7.ts.net:8445`                                                |
| Pila      | `~/apps/lab-stack` en el Mac, proyecto Compose `lab`; puertos solo en `127.0.0.1` (3011 y 3012) |
| Secretos  | `~/.config/lab/` en ThinkPad y Mac, carpeta 700 y archivos 600. Nunca en el repo                |
| Monitores | Uptime Kuma: `ladder-lab :3011`, `sens-lab :3012` y `respaldo lab (push diario)`                |

## Actualizar

Desde el ThinkPad, con todo commiteado. El push no despliega solo:

```bash
deploy/desplegar.sh                 # los dos
deploy/desplegar.sh sens-lab        # uno
```

Va por `git archive`: el Mac no recibe acceso a GitHub.

## Aplicar una migración nueva

```bash
psql "$(cat ~/.config/lab/owner-uri)" -X -v ON_ERROR_STOP=1 -f supabase/migrations/<archivo>.sql
ssh mac-mini 'cd ~/apps/lab-stack && docker compose restart lab-rest'
```

El reinicio es obligatorio: PostgREST va sin LISTEN y no recarga el esquema solo.

## Conectar otro equipo al MCP

El equipo debe estar en la tailnet. El token está en `~/.config/lab/secretos.json` del ThinkPad, campo `mcp`.

```bash
claude mcp add --transport http --scope user ladder-lab \
  https://mac-mini-server.tail1798c7.ts.net:8444/mcp \
  --header "Authorization: Bearer <TOKEN>"
```

`--scope user` guarda el token en la configuración del usuario, no en un repo.

## Respaldos

| dónde                                                  | cuándo | qué                                                             |
| ------------------------------------------------------ | ------ | --------------------------------------------------------------- |
| Mac, launchd `dev.fmarcos.lab-respaldo`, 05:15         | diario | JSON de estampas y candidatas en `~/respaldos`; avisa a Kuma    |
| ThinkPad, timer `lab-respaldo`, 12:00 con recuperación | diario | copia lo del Mac y hace `pg_dump` completo en `~/respaldos/lab` |

Si el aviso del Mac no llega en 25 horas, Kuma alerta por Telegram. El `pg_dump` del ThinkPad usa `/usr/lib/postgresql/18/bin/pg_dump`: el `pg_dump` de Ubuntu es un wrapper que puede fallar con `PostgreSQL version 14 is not installed`.

**Restaurar `pg_dump`** en una base nueva con los mismos roles:

```bash
/usr/lib/postgresql/18/bin/pg_restore --no-owner --no-acl -d "<uri-destino>" <archivo>.dump
```

**Restaurar el JSON** en una base con las migraciones aplicadas. Primero simula; `--aplicar` escribe:

```bash
docker run --rm --network lab_default --env-file ~/.config/lab/ladder-lab.env \
  -v ~/respaldos/ladder-lab:/respaldos:ro ladder-lab:local \
  node dist/restaurar.js /respaldos/<archivo>.json
```

Las dos se probaron el 2026-11-05 con resultado idéntico por hash.

## Recrear desde cero

Si hay que partir de una base o un Mac nuevos:

1. Crear el proyecto en Neon, en São Paulo, y guardar su URI directa en `~/.config/lab/owner-uri`.
2. Crear los roles, con una clave nueva para `authenticator`:

   ```sql
   create role anon nologin;
   create role authenticated nologin;
   create role service_role nologin bypassrls;
   create role authenticator noinherit login password '<clave>';
   grant anon, authenticated, service_role to authenticator;
   ```

3. Aplicar las migraciones de ladder-lab y luego las de sens-lab, en orden, con `psql`.
4. Guardar la clave en `~/.config/lab/authenticator-password` y crear `~/.config/lab/secretos.json` con `jwt` y `mcp` (`openssl rand -hex 32` cada uno).
5. Generar los entornos: `python3 deploy/generar-entornos.py ~/.config/lab/owner-uri ~/.config/lab/authenticator-password`.
6. Copiar `rest.env`, `ladder-lab.env` y `sens-lab.env` al Mac, en `~/.config/lab/`, y correr `deploy/desplegar.sh`.
7. Publicar por la tailnet en el Mac:

   ```bash
   tailscale serve --bg --https=8444 http://127.0.0.1:3011
   tailscale serve --bg --https=8445 http://127.0.0.1:3012
   ```

8. Instalar el plist `dev.fmarcos.lab-respaldo` en el Mac y `lab-respaldo.service` y `.timer` en el ThinkPad.

## Comprobar de verdad

| comprobación                                         | esperado                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `curl -X POST <mcp>` sin cabecera                    | `401`                                                                     |
| La misma con `Authorization: Bearer basura`          | `401`                                                                     |
| `curl <ip-tailscale>:3011/healthz` directo           | sin respuesta: solo entra por `tailscale serve`                           |
| `claude mcp get ladder-lab`                          | `Connected`                                                               |
| `delete from public.estampa_versiones` **con filas** | error de inmutabilidad; con la tabla vacía da `DELETE 0` y no prueba nada |
| `docker compose logs`                                | ningún token ni clave                                                     |

**No hagas pruebas contra `lab`:** las estampas no se pueden borrar. Usá un proyecto desechable.

## Uso real y congelar el formato

1. Cargar estampas reales con `crear_estampa` y anotar en `docs/flows.md` lo torpe.
2. Con las primeras reales, revisar `DECISION_FORMATO_ESTAMPA_V1.md` y marcarlo **congelado** con fecha. Desde ahí un cambio incompatible exige `version: 2` y un migrador.
3. Umbral de «F1 en uso»: 10 estampas reales. La compuerta de F2 se levantó sin cumplirlo (`DECISION_COMPUERTA_F2.md`).

## Rotar y volver atrás

- **Token del MCP:** cambiarlo en `secretos.json`, regenerar entornos, copiarlos al Mac, `docker compose up -d --force-recreate` y volver a registrar el MCP.
- **Volver atrás:** `docker compose down` en `~/apps/lab-stack`. Los datos siguen en Neon.
