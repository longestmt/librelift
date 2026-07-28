#!/usr/bin/env node

import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createBackupStore } from './backup-store.mjs';
import { createLibreLiftMcpServer } from './mcp-server.mjs';

if (process.env.LIBRELIFT_ALLOW_UNAUTHENTICATED_HTTP !== '1') {
  throw new Error(
    'HTTP mode has no user authentication yet. '
    + 'Set LIBRELIFT_ALLOW_UNAUTHENTICATED_HTTP=1 only for local development with disposable data.'
  );
}

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';
const store = createBackupStore();
const methods = new Set(['POST', 'GET', 'DELETE']);

const httpServer = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'OPTIONS' && url.pathname === '/mcp') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, mcp-session-id',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id',
    });
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('LibreLift MCP development server');
    return;
  }

  if (url.pathname === '/mcp' && request.method && methods.has(request.method)) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

    const server = createLibreLiftMcpServer(store);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    response.on('close', () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response);
    } catch (error) {
      console.error('LibreLift MCP request failed:', error);
      if (!response.headersSent) response.writeHead(500).end('Internal server error');
    }
    return;
  }

  response.writeHead(404).end('Not Found');
});

httpServer.listen(port, host, () => {
  const address = httpServer.address();
  const listeningPort = typeof address === 'object' && address ? address.port : port;
  console.log(`LibreLift MCP development server listening on http://${host}:${listeningPort}/mcp`);
});
