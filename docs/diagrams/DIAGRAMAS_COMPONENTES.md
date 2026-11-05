# Diagramas de Componentes (Flowcharts)

Propósito: mapa estable del sistema. Actualizar solo si cambia topología.

## Contexto (alto nivel)

```mermaid
flowchart LR
    subgraph pc[PC de juegos]
        cc[Claude Code]
    end
    subgraph tp[ThinkPad]
        dev[Desarrollo de ladder-lab]
    end
    subgraph mac[Mac Mini M1]
        srv[ladder-lab<br/>MCP Streamable HTTP<br/>contenedor Docker]
    end
    sb[(Supabase propio<br/>Postgres)]
    conv[Convertidor<br/>producto separado]

    cc -- "HTTP /mcp + token<br/>solo por Tailscale" --> srv
    dev -- "despliegue" --> srv
    srv -- "supabase-js" --> sb
    srv -. "exportar: JSON versionado<br/>única conexión" .-> conv
```

La ubicación de Supabase (nube o local en el Mac) está abierta: punto 1 de [`../backlog/README.md`](../backlog/README.md).

## Componentes principales

```mermaid
flowchart TB
    subgraph cliente[Cliente]
        cc[Claude Code]
    end

    subgraph servidor[ladder-lab en el Mac Mini]
        direction TB
        http["http: /mcp, /healthz<br/>auth con token (F0)"]
        mcp[McpServer<br/>createServer]
        tools["tools: crear, corregir, ver, listar, exportar (F1)<br/>F2/F3: comparar, mejor, matches, historial, archivar, importar"]
        dom["domain/estampa<br/>esquema Zod, constantes, export"]
        repo["data: repositorio<br/>interfaz + supabase-js + doble en memoria"]
        cfg["config: env Joi<br/>logger Pino a stderr"]
    end

    subgraph datos[Supabase]
        direction TB
        est[(estampas)]
        ver[(estampa_versiones<br/>inmutables: triggers)]
        rpc["funciones RPC atómicas<br/>crear_estampa, corregir_estampa"]
        vistas["vistas security_invoker<br/>estampas_vigentes, estampas_historial"]
    end

    cc --> http --> mcp --> tools --> dom
    tools --> repo
    dom --> repo
    repo --> rpc
    rpc --> est
    rpc --> ver
    repo --> vistas
    vistas --> est
    vistas --> ver
    cfg -.-> http
    cfg -.-> repo
```

Fronteras: el servidor es la única pieza que habla con Supabase; el cliente nunca recibe la clave de servicio; el convertidor solo ve JSON.
