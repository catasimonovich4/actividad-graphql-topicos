# Agente auditor de catálogo

Agente de consola hecho con **Vercel AI SDK** + **Gemini** que usa el servidor MCP de `../mcp-server`
para auditar los productos, explicar los problemas y corregir los seguros, **pidiendo autorización
antes de cada modificación**.

```
vos ⇄ agente (index.js, AI SDK) ──stdio──▶ mcp-server ──GraphQL──▶ API en Render ──▶ Atlas
            │
            └──▶ Gemini (decide qué herramienta usar y redacta el informe)
```

## Uso

```bash
npm install
npm run audit     # arranca y lanza una auditoría completa
npm start         # modo conversación
```

En la conversación: `auditar`, cualquier pregunta ("¿qué productos tienen stock negativo?",
"poné el precio de la Notebook Gamer X1 en 1200.5"), o `salir`.

Cuando el agente quiere modificar algo muestra el cambio (valor actual → nuevo) y pregunta:
`s` sí · `n` no · `t` aprobar todas las restantes de la tanda · `c` cancelar todas.

## Configuración (`.env` de la raíz o `agent/.env`)

| Variable | Default |
|---|---|
| `API_KEY` o `GOOGLE_GENERATIVE_AI_API_KEY` | — (obligatoria) |
| `GEMINI_MODEL` | `gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.1-flash-lite` (si uno está saturado prueba el siguiente) |
| `GRAPHQL_URL` | `https://actividad-graphql-topicos.onrender.com/graphql` |
| `MCP_SERVER_PATH` | `../mcp-server/index.js` |
| `MCP_DEBUG` | vacío; con `1` muestra los logs del servidor MCP |

## Cómo funciona

- `createMCPClient` + `Experimental_StdioMCPTransport` (`@ai-sdk/mcp`) lanzan el servidor MCP y
  convierten sus herramientas en tools del AI SDK.
- `generateText` con `stopWhen: stepCountIs(30)` deja que el modelo encadene llamadas.
- `toolApproval: { update_product: 'user-approval' }` frena cada `update_product` y devuelve un
  `tool-approval-request`; la consola pregunta y responde con un `tool-approval-response`
  (aprobado/rechazado). Solo entonces el SDK ejecuta (o no) la herramienta.
- Las reglas de auditoría (qué es SEGURO, qué REQUIERE DECISIÓN) están en `instructions.js`.
