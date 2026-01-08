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
