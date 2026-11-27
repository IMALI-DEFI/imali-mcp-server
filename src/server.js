#!/usr/bin/env node
/*
 * IMALI MCP server (stdio). Read-only and keyless: no trading tools, no user keys.
 *   IMALI_API_URL   default https://api.imali-defi.com
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from './client.js';
import { buildTools } from './tools.js';

const VERSION = '0.3.0';
const client = createClient({
  baseUrl: process.env.IMALI_API_URL || 'https://api.imali-defi.com',
  userAgent: `imali-mcp/${VERSION}`,
});

const server = new McpServer({ name: 'imali', version: VERSION });
for (const t of buildTools({ client })) {
  server.tool(t.name, t.description, t.shape, t.handler);
}
await server.connect(new StdioServerTransport());
console.error(`IMALI MCP ${VERSION} running`);
