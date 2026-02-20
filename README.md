stock_performance/
├── backend/
│   ├── main.py              # FastAPI app + LINE Bot webhook
│   ├── requirements.txt
│   ├── .env.example         # 環境變數範本
│   └── credentials.json     # 本機開發用 (不要 commit!)
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # 主入口，從 API 載入資料
│   │   ├── types.ts         # TypeScript 類型
│   │   ├── index.css        # 全局樣式
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── Dashboard.tsx        # 統計卡片
│   │   │   ├── StockManager.tsx     # 股票標籤切換
│   │   │   ├── TransactionForm.tsx  # 買入/股利表單
│   │   │   ├── TransactionTable.tsx # 交易紀錄表格
│   │   │   └── Toast.tsx            # 通知訊息
│   │   ├── hooks/
│   │   │   └── useStockCalculator.ts
│   │   └── services/
│   │       └── api.ts               # API 呼叫封裝
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── Dockerfile               # 部署用 (frontend build + backend)
└── railway.toml             # Railway 設定
