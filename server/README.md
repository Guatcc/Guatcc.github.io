# GUAT.CC Forum WebSocket API

The forum backend uses JSON messages over WebSocket. The default endpoint is `ws://0.0.0.0:31679` for local serving, and the static site tries `wss://ws.guat.cc:31679` when opened over HTTPS.

## Run

```bash
$env:FORUM_ADMIN_TOKEN="change-this-token"
npm run forum:server
```

Optional environment variables:

- `FORUM_PORT`: defaults to `31679`
- `FORUM_HOST`: defaults to `0.0.0.0`
- `FORUM_DATA_PATH`: defaults to `server/forum-data.json`
- `FORUM_ADMIN_TOKEN`: admin password used by `admin.auth`

## Request Format

```json
{
  "id": "1",
  "type": "forum.list",
  "payload": {}
}
```

Successful response:

```json
{
  "id": "1",
  "type": "ok",
  "data": {}
}
```

Error response:

```json
{
  "id": "1",
  "type": "error",
  "error": {
    "code": "BAD_REQUEST",
    "message": "message"
  }
}
```

Realtime event:

```json
{
  "type": "event",
  "event": "forum.changed",
  "data": {
    "at": "2026-04-22T00:00:00.000Z"
  }
}
```

## Public API

- `hello`: returns server time, thread count, and feature list.
- `forum.list`: accepts `query`, `limit`, `offset`; returns thread summaries.
- `forum.thread`: accepts `id`; returns one full thread.
- `forum.create`: accepts `title`, `body`, `author`, `tags`; creates a thread.
- `forum.reply`: accepts `threadId`, `body`, `author`; creates a reply.

## Admin API

Call `admin.auth` with `{ "token": "..." }` first. Admin state is bound to that WebSocket connection.

- `admin.export`: returns the full data file shape.
- `admin.import`: accepts `{ "data": { "threads": [] }, "merge": false }`.
- `admin.thread.update`: accepts `id`, plus optional `title`, `body`, `tags`, `pinned`, `locked`.
- `admin.thread.delete`: accepts `id`; soft-deletes a thread.
- `admin.reply.delete`: accepts `threadId` and `replyId`; soft-deletes a reply.

## Data Shape

```json
{
  "version": 1,
  "threads": [
    {
      "id": "t_example",
      "title": "Title",
      "body": "Body",
      "author": "匿名同学",
      "tags": ["公告"],
      "pinned": false,
      "locked": false,
      "deleted": false,
      "createdAt": "2026-04-22T00:00:00.000Z",
      "updatedAt": "2026-04-22T00:00:00.000Z",
      "replies": []
    }
  ]
}
```
