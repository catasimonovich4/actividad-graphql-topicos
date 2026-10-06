# MCP Productos

Servidor MCP (transporte **stdio**) que expone la API GraphQL de productos desplegada en Render.

| Tool | Parámetros | Qué hace |
|---|---|---|
| `get_products` | — | Query `products`: listado completo |
| `update_product` | `id` (ObjectId, requerido), `price` (number ≥ 0), `stock` (int ≥ 0), `category` (string no vacío) — al menos uno de los tres opcionales | Mutación `updateProduct` |

Los parámetros se validan con Zod antes de llamar a GraphQL; el SDK publica ese esquema como JSON Schema para el cliente.

## Uso

```bash
npm install
npm run inspector   # prueba interactiva con MCP Inspector
```

Variables opcionales:
- `GRAPHQL_URL` (por defecto `https://actividad-graphql-topicos.onrender.com/graphql`)
- `GRAPHQL_TIMEOUT_MS` (por defecto `90000`, por el arranque en frío de Render)

## Conectarlo a un cliente MCP

Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`) u otro cliente con el mismo formato:

```json
{
  "mcpServers": {
    "productos": {
      "command": "node",
      "args": ["C:\\ruta\\absoluta\\a\\mcp-server\\index.js"]
    }
  }
}
```

Claude Code:

```bash
claude mcp add productos -- node C:/ruta/absoluta/a/mcp-server/index.js
```
