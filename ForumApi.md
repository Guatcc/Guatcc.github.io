# GUAT.CC Forum HTTP API

校园论坛后端是独立 HTTP 服务，默认监听 `0.0.0.0:31681`。静态站不会再连接 WebSocket；`npm run build` 会读取 `server/forum-data.json`，抽取最热最新的 10 条帖子生成 `forum.html`。

## 启动

```powershell
$env:FORUM_ADMIN_TOKEN="change-this-token"
npm run forum:server
```

可选环境变量：

- `FORUM_PORT`: 默认 `31681`
- `FORUM_HOST`: 默认 `0.0.0.0`
- `FORUM_DATA_PATH`: 默认 `server/forum-data.json`
- `FORUM_UPLOAD_DIR`: 默认 `server/forum-uploads`
- `FORUM_PUBLIC_ORIGIN`: 上传图片返回绝对地址时使用，例如 `https://api.example.com`
- `FORUM_CORS_ORIGIN`: 默认 `*`
- `FORUM_ADMIN_TOKEN`: 后台管理 Token

## 认证

用户接口使用用户 Token：

```http
Authorization: Bearer guat_xxx
```

也可以使用：

```http
X-User-Token: guat_xxx
```

后台接口使用管理员 Token：

```http
X-Admin-Token: change-this-token
```

## 响应格式

成功：

```json
{
  "thread": {}
}
```

失败：

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "需要用户 Token"
  }
}
```

## 健康检查

```http
GET /api/health
```

## 用户管理

### 创建用户

```http
POST /api/users
Content-Type: application/json
```

```json
{
  "nickname": "桂航同学",
  "avatarUrl": "https://example.com/avatar.png",
  "bio": "新生"
}
```

返回：

```json
{
  "user": {
    "id": "u_xxx",
    "nickname": "桂航同学"
  },
  "token": "guat_xxx"
}
```

### 当前用户

```http
GET /api/users/me
PATCH /api/users/me
```

`PATCH` 可更新 `nickname`、`avatarUrl`、`bio`。

## 帖子

### 列表

```http
GET /api/threads?sort=hot&limit=30&offset=0&q=宿舍
GET /api/forum/threads?sort=latest&includeReplies=1
```

参数：

- `sort`: `hot` 或 `latest`
- `q` / `query`: 搜索标题、正文、作者、标签
- `includeReplies=1`: 列表中包含回复
- `limit`: 1-100
- `offset`: 分页偏移

### 详情

```http
GET /api/threads/{threadId}
GET /api/forum/threads/{threadId}
```

### 发帖

```http
POST /api/threads
Authorization: Bearer guat_xxx
Content-Type: application/json
```

```json
{
  "title": "南校区宿舍怎么选床位？",
  "body": "想问一下报道当天的流程。",
  "tags": ["宿舍", "报到"],
  "images": [
    {
      "url": "https://example.com/1.jpg",
      "alt": "宿舍图"
    }
  ]
}
```

每条帖子最多 9 张图片。图片可以是：

- `https://...`
- `http://...`
- `/uploads/xxx.jpg`
- `data:image/png;base64,...`

推荐 APP 先调用上传接口，拿到 URL 后再发帖。

## 回复

```http
POST /api/threads/{threadId}/replies
Authorization: Bearer guat_xxx
Content-Type: application/json
```

```json
{
  "body": "报道当天现场选床位。",
  "images": []
}
```

回复同样支持最多 9 张图片。

## 点赞

帖子点赞：

```http
POST /api/threads/{threadId}/like
Authorization: Bearer guat_xxx
Content-Type: application/json
```

回复点赞：

```http
POST /api/replies/{replyId}/like
Authorization: Bearer guat_xxx
Content-Type: application/json
```

请求体：

```json
{
  "liked": true
}
```

不传 `liked` 时会自动切换点赞状态。

## 图片上传

```http
POST /api/uploads
Authorization: Bearer guat_xxx
Content-Type: application/json
```

```json
{
  "images": [
    {
      "name": "room.jpg",
      "mime": "image/jpeg",
      "data": "base64..."
    }
  ]
}
```

限制：

- 单次最多 9 张
- 单张最大 5MB
- 支持 `png`、`jpg`、`webp`、`gif`

返回：

```json
{
  "images": [
    {
      "id": "img_xxx",
      "url": "/uploads/upload_xxx.jpg",
      "alt": "room.jpg"
    }
  ]
}
```

## 后台管理

浏览器访问：

```text
http://127.0.0.1:31681/admin
```

### 导出

```http
GET /api/admin/export
X-Admin-Token: change-this-token
```

### 导入

```http
POST /api/admin/import
X-Admin-Token: change-this-token
Content-Type: application/json
```

```json
{
  "merge": false,
  "data": {
    "version": 2,
    "users": [],
    "threads": []
  }
}
```

### 管理帖子

```http
GET /api/admin/threads?includeDeleted=1&includeReplies=1
PATCH /api/admin/threads/{threadId}
DELETE /api/admin/threads/{threadId}
```

`PATCH` 支持：

```json
{
  "title": "新标题",
  "body": "新正文",
  "tags": ["公告"],
  "images": [],
  "pinned": true,
  "locked": false,
  "deleted": false
}
```

### 管理回复

```http
DELETE /api/admin/replies/{replyId}
```

### 管理用户

```http
GET /api/admin/users
PATCH /api/admin/users/{userId}
DELETE /api/admin/users/{userId}
```

`PATCH` 支持：

```json
{
  "nickname": "站务",
  "avatarUrl": "",
  "bio": "",
  "role": "admin",
  "status": "active",
  "deleted": false
}
```

## 静态论坛页生成

构建时执行：

```powershell
npm run build
```

生成器会读取：

```text
server/forum-data.json
```

如果不存在，则读取：

```text
server/forum-data.example.json
```

然后按置顶、点赞、回复数和更新时间综合排序，取前 10 条帖子及其回复生成 `forum.html`。页面底部会显示：

```text
🔒 如需参与讨论或继续浏览 请下载APP
```

这段文字会链接到 `app.html`。
