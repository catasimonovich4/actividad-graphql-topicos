#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import dotenv from 'dotenv';
import { generateText, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport as StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { instructions } from './instructions.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Lee agent/.env si existe y, si no, el .env de la raíz del proyecto
dotenv.config({ path: [path.join(here, '.env'), path.join(here, '..', '.env')], quiet: true });

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.API_KEY;
if (!apiKey) {
  console.error('Falta la API key de Gemini: definí GOOGLE_GENERATIVE_AI_API_KEY (o API_KEY) en .env');
  process.exit(1);
}

// Modelos en orden de preferencia: si uno está saturado se prueba el siguiente.
// GEMINI_MODEL acepta uno o varios separados por coma.
const MODELS = (process.env.GEMINI_MODEL || 'gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.1-flash-lite')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
let currentModel = MODELS[0];
const MCP_SERVER = process.env.MCP_SERVER_PATH || path.join(here, '..', 'mcp-server', 'index.js');
const GRAPHQL_URL = process.env.GRAPHQL_URL || 'https://actividad-graphql-topicos.onrender.com/graphql';
const AUDIT_PROMPT = 'Auditá el catálogo completo, explicá los hallazgos y corregí los problemas seguros.';

const color = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const google = createGoogleGenerativeAI({ apiKey });

const mcp = await createMCPClient({
  transport: new StdioMCPTransport({
    command: process.execPath,
    args: [MCP_SERVER],
    env: { ...process.env, GRAPHQL_URL },
    stderr: process.env.MCP_DEBUG ? 'inherit' : 'ignore', // logs del servidor MCP
  }),
});
const tools = await mcp.tools();

const rl = readline.createInterface({ input: stdin, output: stdout });
const messages = [];
// Últimos productos vistos, para mostrar el valor actual al pedir autorización
const productsById = new Map();

function rememberProducts(steps) {
  for (const step of steps) {
    for (const r of step.toolResults ?? []) {
      const list = r.toolName === 'get_products' ? r.output?.structuredContent?.products : null;
      const updated = r.toolName === 'update_product' ? r.output?.structuredContent?.product : null;
      for (const p of list ?? (updated ? [updated] : [])) productsById.set(p.id, p);
    }
  }
}

function logToolActivity(steps) {
  for (const step of steps) {
    for (const r of step.toolResults ?? []) {
      const failed = r.output?.isError;
      const args = Object.keys(r.input ?? {}).length ? ` ${JSON.stringify(r.input)}` : '';
      console.log(color.dim(`  🔧 ${r.toolName}${args} ${failed ? color.red('✗') : '✓'}`));
    }
  }
}

function describeChange(input) {
  const current = productsById.get(input.id);
  const name = current ? `"${current.name}"` : '(producto desconocido)';
  const changes = ['price', 'stock', 'category']
    .filter((field) => input[field] !== undefined)
    .map((field) => `${field}: ${current ? JSON.stringify(current[field]) : '?'} → ${JSON.stringify(input[field])}`);
  return `${name} [${input.id}]\n     ${changes.join('\n     ')}`;
}

// Pide autorización por cada modificación. "t" aprueba todas las pendientes de esta tanda.
async function askApprovals(requests) {
  console.log(color.yellow(`\n⚠  El agente quiere aplicar ${requests.length} modificación(es):`));
  const responses = [];
  let approveRest = false;

  for (const [i, req] of requests.entries()) {
    console.log(`\n  ${i + 1}/${requests.length} ${describeChange(req.toolCall.input)}`);
    let approved = approveRest;
    if (!approveRest) {
      const answer = (await rl.question(color.bold('  ¿Autorizar? [s]í / [n]o / [t]odas las restantes / [c]ancelar todas: ')))
        .trim()
        .toLowerCase();
      if (answer === 't') approveRest = approved = true;
      else if (answer === 'c') {
        responses.push(
          ...requests.slice(i).map((r) => ({ type: 'tool-approval-response', approvalId: r.approvalId, approved: false, reason: 'El usuario canceló las modificaciones' }))
        );
        console.log(color.red('  ✗ Canceladas todas las restantes'));
        break;
      } else approved = answer === 's' || answer === 'si' || answer === 'sí';
    }
    console.log(approved ? color.green('  ✓ Autorizada') : color.red('  ✗ Rechazada'));
    responses.push({
      type: 'tool-approval-response',
      approvalId: req.approvalId,
      approved,
      ...(approved ? {} : { reason: 'El usuario rechazó esta modificación' }),
    });
  }
  return responses;
}

function isOverloaded(err) {
  const status = err.statusCode ?? err.lastError?.statusCode;
  return status === 429 || status === 503 || /high demand|overloaded|unavailable|quota/i.test(err.message);
}

async function generateWithFallback(options) {
  const start = MODELS.indexOf(currentModel);
  const order = [...MODELS.slice(start), ...MODELS.slice(0, start)];
  for (const [i, model] of order.entries()) {
    try {
      const result = await generateText({ ...options, model: google(model), maxRetries: 1 });
      currentModel = model;
      return result;
    } catch (err) {
      if (!isOverloaded(err) || i === order.length - 1) throw err;
      console.log(color.dim(`  (${model} no disponible, probando ${order[i + 1]}...)`));
    }
  }
}

// Ejecuta el agente hasta que responda sin pedir más autorizaciones
async function runTurn() {
  while (true) {
    const result = await generateWithFallback({
      instructions,
      messages,
      tools,
      toolApproval: { update_product: 'user-approval' },
      stopWhen: stepCountIs(30),
    });

    messages.push(...result.response.messages);
    rememberProducts(result.steps);
    logToolActivity(result.steps);

    const approvals = result.content.filter((part) => part.type === 'tool-approval-request');
    if (approvals.length === 0) {
      console.log(`\n${result.text}\n`);
      return;
    }
    if (result.text) console.log(`\n${result.text}`);
    messages.push({ role: 'tool', content: await askApprovals(approvals) });
  }
}

async function ask(text) {
  messages.push({ role: 'user', content: text });
  try {
    await runTurn();
  } catch (err) {
    console.error(color.red(`\nError: ${err.message}\n`));
  }
}

console.log(color.cyan(color.bold('Agente auditor de catálogo')) + color.dim(` · ${MODELS.join(' → ')} · MCP: ${path.relative(process.cwd(), MCP_SERVER)}`));
console.log(color.dim(`Herramientas: ${Object.keys(tools).join(', ')}`));
console.log(color.dim('Escribí "auditar" para una auditoría completa, cualquier pregunta, o "salir".\n'));

try {
  if (process.argv.includes('--audit')) await ask(AUDIT_PROMPT);

  while (true) {
    const input = (await rl.question(color.cyan('vos › '))).trim();
    if (!input) continue;
    if (['salir', 'exit', 'quit'].includes(input.toLowerCase())) break;
    await ask(input.toLowerCase() === 'auditar' ? AUDIT_PROMPT : input);
  }
} finally {
  rl.close();
  await mcp.close();
}
