# ScreenFish Web

ScreenFish 的 Web UI（React + Vite），用于调用 `screenfish` 后端（FastAPI）的 `/v1` API。

## 开发运行

1) 启动后端（默认 `http://127.0.0.1:8000`）：

```bash
cd ../screenfish
stock_screener serve --cache ./data
```

2) 启动前端（默认 `http://localhost:5173`），并通过 Vite 代理 `/api -> http://localhost:8000`：

```bash
cd ../screenfish-web
npm install
npm run dev
```

也可以用 `deploy.sh` 一键启动（后端 + 前端 + Cloudflare quick tunnel，偏开发用途）：

```bash
./deploy.sh
```

## 环境变量

参考 `.env.example`：

- `VITE_API_URL`：后端地址；开发默认用 `/api`（走 Vite proxy）
- `VITE_PROXY_TARGET`：开发可选；Vite dev proxy 目标地址（默认 `http://localhost:8000`）
- `VITE_API_KEY`：若后端设置了 `STOCK_SCREENER_API_KEY`，需设置该值以自动带上请求头 `X-API-Key`

## 生产部署建议

- 前端用 `npm run build` 生成 `dist/` 静态文件后部署
- 后端建议通过同域反代 `/api` 或正确设置 `STOCK_SCREENER_CORS_ORIGINS`

## 本机生产模式（screenfish.biglone.tech）

当前机器的线上入口已配置为同域 `/api`：

- `https://screenfish.biglone.tech/`：前端静态资源（`dist/`）
- `https://screenfish.biglone.tech/api/*`：反代到后端，再映射到后端的 `/v1/*`

实现方式（本机）：

- Cloudflare Tunnel（named tunnel）把 `screenfish.biglone.tech` 指向 `http://127.0.0.1:5174`
- Caddy 监听 `127.0.0.1:5174`，静态托管 `dist/`，并将 `/api/*` 反代到后端 `127.0.0.1:8001`

## 同事手动部署/启停（本机生产）

在服务器上（以同一个 Linux 用户运行）：

```bash
cd ~/workspace/screenfish-web
./scripts/screenfish-prod.sh deploy
./scripts/screenfish-prod.sh status
./scripts/screenfish-prod.sh logs backend -f
```

## 远程开发：一键部署 + 本地查看

如果你是通过 SSH 在服务器上开发（服务器不方便开浏览器），推荐：

1) 在服务器上部署到 `screenfish-prod`（会重启服务）：

```bash
cd ~/workspace/screenfish-web
./scripts/prod-deploy.sh
```

2) 在你的电脑上端口转发并打开页面：

```bash
./scripts/prod-forward.sh <user>@<server> --open
```

停止转发：

```bash
./scripts/prod-forward.sh --stop
```
