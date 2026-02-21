# Stock Performance App — 目前進度

## ✅ 已完成

- **Frontend**：React + Vite + TypeScript，完整 Dashboard UI
- **Backend**：FastAPI + Google Sheets + LINE Bot Webhook
- **GitHub**：已 push → https://github.com/Tywi666/stock-performance
- **Railway 環境變數**（已在 Railway 後台填寫完畢）：
  - `GOOGLE_CREDENTIALS_JSON`
  - `LINE_CHANNEL_ACCESS_TOKEN`
  - `LINE_CHANNEL_SECRET`
  - `SHEET_NAME` = `Antigravity_Stock_Bot`

---

## ❌ 卡關中：Railway Healthcheck 失敗

### 問題症狀
```
Healthcheck failure — service unavailable
```

### 已嘗試的修正
1. Dockerfile CMD 改用 `$PORT` shell 展開 → 反而造成 `'$PORT' is not a valid integer`
2. 改回 exec form，讓 `railway.toml` 的 `startCommand` 處理 → 仍失敗

### 下次繼續的方向
點 Railway 的 **Deploy Logs** 標籤（不是 Build Logs），找 Python 的實際 traceback 錯誤，
最可能的問題是：
1. `GOOGLE_CREDENTIALS_JSON` 格式不對（貼錯、有多餘字元）
2. LINE Bot SDK 初始化失敗（空 Secret）
3. 確認 `railway.toml` 的 `startCommand` 有沒有被正確套用

### railway.toml 目前設定
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
```

---

## 部署成功後的下一步

1. 複製 Railway 給的 URL（例如 `https://stock-xxx.railway.app`）
2. LINE Developers Console → Webhook URL 填入：
   ```
   https://stock-xxx.railway.app/webhook/line
   ```
3. 開啟「Use webhook」開關

---

## LINE Bot 指令

| 指令 | 格式 | 範例 |
|------|------|------|
| 買入 | `new yyyy/mm/dd 代號 股數 成本` | `new 2024/01/15 2330 100 60000` |
| 股利 | `div yyyy/mm/dd 代號 金額` | `div 2024/06/01 2330 2000` |
| 刪除 | `delete 代號` → 回覆數字 | `delete 2330` |
| 查詢 | `query 代號` | `query 2330` |
