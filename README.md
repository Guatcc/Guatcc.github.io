# GUAT.CC

桂航快速解答是一个纯静态问答站点。内容继续放在 `index.txt` 和 `raw/*.txt`，页面由新的 Node 生成器统一生成。

## 生成页面

```bash
npm run build
```

生成器会读取旧的文本格式：

- `#T标题#t` 表示页面标题
- `Q!问题` 表示一条问题
- `A!答案` 或 `B!答案` 表示答案内容
- `|` 表示答案分段
- `#话题#` 会生成可点击的话题标签
- `&+链接&-按钮文字&_` 会生成按钮链接

输出文件包括 `index.html` 和 `s/*.html`，公共样式在 `css/guatcc.css`，公共交互在 `js/app.js`。

## 校园论坛

论坛是 GitHub Pages 静态前端 + WebSocket 后端的模式。普通页面会探测论坛后端，连接成功才显示“论坛”入口；连接失败时不会显示论坛入口。

启动后端：

```bash
$env:FORUM_ADMIN_TOKEN="change-this-token"
npm run forum:server
```

默认监听 `0.0.0.0:31679`，数据写入 `server/forum-data.json`。部署到 HTTPS 的 GitHub Pages 时，浏览器需要连接 `wss://ws.guat.cc:31679`；本地调试可以打开：

```text
forum.html?forumWs=127.0.0.1:31679
admin/forum.html?forumWs=127.0.0.1:31679
```

论坛后台在 `admin/forum.html`，使用 `FORUM_ADMIN_TOKEN` 登录后可以导入、导出、置顶、锁定和删除帖子。

## 首次推送到 GitHub

如果当前目录还没有 Git 历史，可以直接在 PowerShell 里执行：

```powershell
cd D:\guat.cc

git init
git add .
git commit -m "Initial site with forum"
git branch -M main
git remote add origin https://github.com/Guatcc/Guatcc.github.io.git

$env:GIT_CONFIG_GLOBAL = "NUL"
git push -u origin main
```

如果远端已经存在，先看一眼：

```powershell
git remote -v
```

如果需要重设远端：

```powershell
git remote remove origin
git remote add origin https://github.com/Guatcc/Guatcc.github.io.git
```

这里用了：

```powershell
$env:GIT_CONFIG_GLOBAL = "NUL"
```

是为了临时绕开本机全局 Git 配置里把 `https://github.com/` 改写到镜像站的规则，避免 push 时又被 `gitclone.com` 之类的代理影响。

## 自动部署

仓库里已经加入 GitHub Pages workflow：

- `.github/workflows/deploy-pages.yml`

推送到 `main` 后，会自动：

1. `npm ci`
2. `npm run build`
3. 上传 `dist`
4. 部署到 GitHub Pages

然后在 GitHub 仓库里把 Pages 的发布来源设置成：

- `Settings`
- `Pages`
- `Build and deployment`
- `Source: GitHub Actions`
