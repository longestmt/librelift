#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createBackupStore } from './backup-store.mjs';
import { createLibreLiftMcpServer } from './mcp-server.mjs';

const server = createLibreLiftMcpServer(createBackupStore());
await server.connect(new StdioServerTransport());
