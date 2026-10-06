#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const GRAPHQL_URL = process.env.GRAPHQL_URL || 'https://actividad-graphql-topicos.onrender.com/graphql';
// Render (plan free) puede tardar ~50 s en despertar
const TIMEOUT_MS = Number(process.env.GRAPHQL_TIMEOUT_MS) || 90_000;

// Con stdio, stdout es el canal del protocolo: los logs van siempre a stderr
const log = (...args) => console.error('[mcp-productos]', ...args);

async function graphql(query, variables = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const body = await res.json().catch(() => null);
  if (body?.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  if (!res.ok || !body) throw new Error(`El servidor GraphQL respondió HTTP ${res.status}`);
  return body.data;
}

const PRODUCT_FIELDS = 'id name price stock category description';

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  stock: z.number().int(),
  category: z.string(),
  description: z.string().nullable(),
});

function ok(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function fail(err) {
  const message = err.name === 'TimeoutError' ? 'El servidor GraphQL no respondió a tiempo' : err.message;
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

const server = new McpServer({ name: 'mcp-productos', version: '1.0.0' });

server.registerTool(
  'get_products',
  {
    title: 'Listar productos',
    description: 'Obtiene el listado completo de productos (id, nombre, precio, stock, categoría y descripción).',
    inputSchema: {},
    outputSchema: { products: z.array(productSchema) },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async () => {
    try {
      const data = await graphql(`query { products { ${PRODUCT_FIELDS} } }`);
      return ok({ products: data.products });
    } catch (err) {
      log('get_products:', err.message);
      return fail(err);
    }
  }
);

server.registerTool(
  'update_product',
  {
    title: 'Actualizar producto',
    description:
      'Modifica el precio, el stock y/o la categoría de un producto dado su ID. ' +
      'Solo se cambian los campos enviados; hay que enviar al menos uno.',
    inputSchema: {
      id: z.string().regex(/^[a-f\d]{24}$/i, 'Debe ser un ObjectId de MongoDB (24 caracteres hex)').describe('ID del producto'),
      price: z.number().nonnegative().optional().describe('Nuevo precio (>= 0)'),
      stock: z.number().int().nonnegative().optional().describe('Nuevo stock (entero >= 0)'),
      category: z.string().trim().min(1).optional().describe('Nueva categoría'),
    },
    outputSchema: { product: productSchema },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ id, price, stock, category }) => {
    const input = Object.fromEntries(
      Object.entries({ price, stock, category }).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(input).length === 0) {
      return fail(new Error('Indicá al menos uno de: price, stock o category'));
    }

    try {
      const data = await graphql(
        `mutation UpdateProduct($id: ID!, $input: UpdateProductInput!) {
          updateProduct(id: $id, input: $input) { ${PRODUCT_FIELDS} }
        }`,
        { id, input }
      );
      if (!data.updateProduct) return fail(new Error(`No existe un producto con id ${id}`));
      return ok({ product: data.updateProduct });
    } catch (err) {
      log('update_product:', err.message);
      return fail(err);
    }
  }
);

await server.connect(new StdioServerTransport());
log(`listo (stdio) → ${GRAPHQL_URL}`);
