# LibreLift ChatGPT plugin

This plugin exposes LibreLift workout data through an MCP server so ChatGPT or
Codex can log strength workouts, record body weight, and review progress.

The local plugin uses stdio. A streamable-HTTP development server is also
included for MCP Inspector and ChatGPT developer-mode testing. It is
intentionally gated because it does not yet implement per-user OAuth.

## Data connection

The server deliberately reuses LibreLift's portable backup format. Configure
one of these connection modes:

### Local backup file

1. In LibreLift, open **Settings → Export Backup**.
2. Set `LIBRELIFT_DATA_FILE` to the absolute path of the exported JSON file.
3. Start a new ChatGPT/Codex task after installing the plugin.

The plugin updates that file atomically. Import it into LibreLift to bring the
changes into the app.

### GitHub Gist backup

1. Connect GitHub Gist backup in LibreLift and push once.
2. Set `LIBRELIFT_GITHUB_TOKEN` to a fine-grained token with Gist access.
3. Optionally set `LIBRELIFT_GIST_ID`; otherwise the server discovers the first
   Gist containing `librelift-backup.json`.

After ChatGPT writes data, use **Restore Backup** in LibreLift to pull it onto
the device. Push current app data before beginning a ChatGPT logging session to
reduce the chance of overwriting newer local-only changes.

When the LibreLift dataset is actively synchronized with LibreSync, this plugin
is still a backup-file writer, not a live replica. Do not let it update an older
Gist or portable backup behind the synchronized dataset: restoring that file is
an explicit import/replacement operation and can create tombstones or conflicts.
Export or push a current safety backup first. A future plugin version can become
its own authorized Node LibreSync device.

## Tools

- `list_exercises`
- `get_recent_workouts`
- `get_exercise_progress`
- `get_body_weight_history`
- `log_strength_workout`
- `log_body_weight`

Write tools accept an optional `request_id` and treat a repeated ID as the same
operation, which makes retries safe.

## Development

```bash
npm install
npm test
LIBRELIFT_DATA_FILE=/absolute/path/to/librelift-backup.json npm start
```

The MCP server uses stdio and writes protocol messages only to stdout.

## ChatGPT developer-mode prototype

Use a disposable or sanitized backup while authentication is unfinished:

```bash
LIBRELIFT_DATA_FILE=/absolute/path/to/test-backup.json \
LIBRELIFT_ALLOW_UNAUTHENTICATED_HTTP=1 \
npm run start:http
```

The endpoint is `http://127.0.0.1:8787/mcp`. Test it with MCP Inspector. To
connect from ChatGPT, expose the port through an HTTPS development tunnel and
use the resulting `/mcp` URL.

Do not expose real workout data through this unauthenticated development
endpoint. A published plugin must add OAuth 2.1 discovery, token validation,
and per-user storage before deployment.
