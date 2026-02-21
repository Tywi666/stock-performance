# Stock Performance App — 進度記錄（2026-02-21）

## ✅ 已完成

### 部署層
- **Railway 成功部署** → `stock-performance-production.up.railway.app`
- Dockerfile CMD 改用 `sh -c "uvicorn ... --port ${PORT:-8000}"` 解決 $PORT 展開問題
- `railway.toml` 移除 `startCommand`，讓 Dockerfile CMD 處理 PORT
- LINE Bot webhook URL 設定完成，Verify OK ✅

### 程式修復
- LINE Bot WebhookHandler 延遲初始化（避免空 secret crash）
- `reply()` closure 移回 `with ApiClient()` block 內
- Google Sheets API scope 從舊版 `spreadsheets.google.com/feeds` 更新為 `googleapis.com/auth/spreadsheets`
- 支援 `SPREADSHEET_ID` 環境變數直接用 ID 開啟試算表（不依賴名稱搜尋）
- 支援 `OWNER_EMAIL` 環境變數（auto-create 時分享給指定信箱）

### Railway 環境變數（已設定）
| 變數 | 值 |
|------|--|
| `GOOGLE_CREDENTIALS_JSON` | ✅ 已設定 |
| `LINE_CHANNEL_ACCESS_TOKEN` | ✅ 已設定 |
| `LINE_CHANNEL_SECRET` | ✅ 已設定 |
| `SHEET_NAME` | `Antigravity_Stock_Bot` |
| `SPREADSHEET_ID` | `16wRGKQyB4kJxcho7zNZQQ6dumoKe8uffhlO9ecLPjbg` |

---

## ❌ 卡關：Google Sheets PermissionError

### 問題確認
- **Railway 使用的 service account**：`stock-bot-sa@stock-bot-488001.iam.gserviceaccount.com`
- **本地 credentials.json 的 SA**：`stockbot@gen-lang-client-0131710382.iam.gserviceaccount.com`
- 這是**兩個不同的 SA**！

### 用 debug endpoint 驗證
```bash
curl https://stock-performance-production.up.railway.app/api/debug
# 回傳：
# {"service_account_email":"stock-bot-sa@stock-bot-488001.iam.gserviceaccount.com",
#  "spreadsheet_id":"16wRGKQyB4kJxcho7zNZQQ6dumoKe8uffhlO9ecLPjbg", ...}
```

### 已嘗試的修復
- Google Sheet 已分享給 `stock-bot-sa@stock-bot-488001.iam.gserviceaccount.com`（編輯者）
- 但 2026-02-21 22:10 測試時 PermissionError 仍然存在

### 下次繼續方向
1. **先確認 sharing 是否真的生效**：直接打 `/api/portfolio`，看是否還是 PermissionError
2. **如果還是 PermissionError**：觸發 Railway 手動 redeploy → 測試
3. **如果一直失敗**：考慮重新生成一個新的 service account，把 credentials.json 更新到 Railway

---

## 程式架構

```
stock_performance/
├── backend/
│   ├── main.py           # FastAPI + LINE Bot + Google Sheets
│   └── requirements.txt
├── frontend/
│   └── src/              # React + TypeScript Dashboard
├── Dockerfile            # sh -c CMD 處理 $PORT
└── railway.toml
```

## Railway URL
```
https://stock-performance-production.up.railway.app
```

## LINE Bot Webhook URL（已設定）
```
https://stock-performance-production.up.railway.app/webhook/line
```

## LINE Bot 指令

| 指令 | 格式 | 範例 |
|------|------|------|
| 買入 | `new yyyy/mm/dd 代號 股數 成本` | `new 2024/01/15 2330 100 60000` |
| 股利 | `div yyyy/mm/dd 代號 金額` | `div 2024/06/01 2330 2000` |
| 刪除 | `delete 代號` → 回覆數字 | `delete 2330` |
| 查詢 | `query 代號` | `query 2330` |

## GitHub Repo
```
https://github.com/Tywi666/stock-performance
```
最新 commit：`2a8a9e7` (debug: add /api/debug endpoint)
