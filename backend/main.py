import os
import json
import uuid
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

import gspread
from google.oauth2.service_account import Credentials
from linebot.v3 import WebhookHandler
from linebot.v3.messaging import (
    Configuration,
    ApiClient,
    MessagingApi,
    ReplyMessageRequest,
    TextMessage,
)
from linebot.v3.webhooks import MessageEvent, TextMessageContent
from linebot.v3.exceptions import InvalidSignatureError

# ─── Config ──────────────────────────────────────────────────────────────────
SHEET_NAME        = os.environ.get("SHEET_NAME", "Antigravity_Stock_Bot")
WORKSHEET_NAME    = os.environ.get("WORKSHEET_NAME", "RawData")
LINE_ACCESS_TOKEN = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN", "")
LINE_CHANNEL_SECRET = os.environ.get("LINE_CHANNEL_SECRET", "")
FRONTEND_URL      = os.environ.get("FRONTEND_URL", "*")

# Google Sheets credentials — supports inline JSON string OR file path
GOOGLE_CREDS_JSON = os.environ.get("GOOGLE_CREDENTIALS_JSON", "")
GOOGLE_CREDS_FILE = os.environ.get("GOOGLE_CREDENTIALS_FILE", "credentials.json")

# ─── Google Sheets helper ────────────────────────────────────────────────────
SCOPES = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive",
]

def get_worksheet():
    if GOOGLE_CREDS_JSON:
        creds_dict = json.loads(GOOGLE_CREDS_JSON)
        creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
    elif os.path.exists(GOOGLE_CREDS_FILE):
        creds = Credentials.from_service_account_file(GOOGLE_CREDS_FILE, scopes=SCOPES)
    else:
        raise RuntimeError("No Google credentials found. Set GOOGLE_CREDENTIALS_JSON or provide credentials.json")

    client = gspread.authorize(creds)
    sh = client.open(SHEET_NAME)
    try:
        ws = sh.worksheet(WORKSHEET_NAME)
    except gspread.WorksheetNotFound:
        # Auto-create with headers
        ws = sh.add_worksheet(title=WORKSHEET_NAME, rows=1000, cols=10)
        ws.append_row(["id", "date", "ticker", "type", "shares", "price", "total_amount", "dividend", "note"])
    return ws


def ensure_headers(ws):
    """Make sure row 1 has our headers."""
    headers = ws.row_values(1)
    if not headers or headers[0] != "id":
        ws.insert_row(["id", "date", "ticker", "type", "shares", "price", "total_amount", "dividend", "note"], 1)


def all_records(ws) -> list[dict]:
    records = ws.get_all_records()
    return records


def find_row_by_id(ws, tx_id: str) -> Optional[int]:
    """Return 1-indexed row number for the given transaction id."""
    ids = ws.col_values(1)  # column A = id
    for i, val in enumerate(ids):
        if val == tx_id:
            return i + 1  # 1-indexed
    return None


# ─── LINE Bot setup (lazy init — avoids crash when env vars are empty) ────────
_line_handler: Optional[WebhookHandler] = None

def get_line_handler() -> WebhookHandler:
    global _line_handler
    if _line_handler is None:
        if not LINE_CHANNEL_SECRET:
            raise RuntimeError("LINE_CHANNEL_SECRET is not set")
        _line_handler = WebhookHandler(LINE_CHANNEL_SECRET)
    return _line_handler

# Pending delete state: { user_id: [ list of recent transactions ] }
pending_deletes: dict[str, list[dict]] = {}

# ─── FastAPI app ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Try to verify sheet headers on startup (non-fatal)
    try:
        ws = get_worksheet()
        ensure_headers(ws)
    except Exception as e:
        print(f"Warning: Could not verify sheet headers on startup: {e}")
    yield

app = FastAPI(title="Stock Performance API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic models ─────────────────────────────────────────────────────────
class AddTransactionRequest(BaseModel):
    type: str           # "PURCHASE" or "DIVIDEND"
    date: str           # yyyy/mm/dd
    ticker: str
    shares: Optional[int] = 0
    price: Optional[float] = 0
    total_amount: Optional[float] = 0
    dividend: Optional[float] = 0
    note: Optional[str] = ""

class AddStockRequest(BaseModel):
    ticker: str

# ─── REST API ─────────────────────────────────────────────────────────────────
@app.get("/api/portfolio")
def get_portfolio():
    """Return all stocks with their transactions and calculated stats."""
    try:
        ws = get_worksheet()
        records = all_records(ws)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    portfolio: dict = {}
    for row in records:
        ticker = str(row.get("ticker", "")).upper().strip()
        if not ticker:
            continue
        if ticker not in portfolio:
            portfolio[ticker] = {
                "ticker": ticker,
                "currentPrice": 0,
                "transactions": [],
            }
        tx = {
            "id": str(row.get("id", "")),
            "type": str(row.get("type", "PURCHASE")),
            "date": str(row.get("date", "")),
            "shares": int(row.get("shares") or 0),
            "price": float(row.get("price") or 0),
            "total_amount": float(row.get("total_amount") or 0),
            "dividend": float(row.get("dividend") or 0),
            "note": str(row.get("note", "")),
        }
        portfolio[ticker]["transactions"].append(tx)

    return {"portfolio": portfolio}


@app.get("/api/stocks/{ticker}/summary")
def get_stock_summary(ticker: str):
    """Return summary stats for a single stock."""
    try:
        ws = get_worksheet()
        records = all_records(ws)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    ticker = ticker.upper()
    txs = [r for r in records if str(r.get("ticker", "")).upper() == ticker]
    if not txs:
        raise HTTPException(status_code=404, detail=f"Stock {ticker} not found")

    total_shares = sum(int(r.get("shares") or 0) for r in txs if r.get("type") == "PURCHASE")
    total_cost   = sum(float(r.get("total_amount") or 0) for r in txs if r.get("type") == "PURCHASE")
    total_div    = sum(float(r.get("dividend") or 0) for r in txs if r.get("type") == "DIVIDEND")
    avg_cost     = (total_cost / total_shares) if total_shares > 0 else 0
    actual_cost  = ((total_cost - total_div) / total_shares) if total_shares > 0 else 0

    return {
        "ticker": ticker,
        "totalShares": total_shares,
        "totalCost": total_cost,
        "totalDividends": total_div,
        "bookCost": round(avg_cost, 2),
        "actualCost": round(actual_cost, 2),
    }


@app.post("/api/transactions")
def add_transaction(req: AddTransactionRequest):
    """Add a new transaction (purchase or dividend)."""
    try:
        ws = get_worksheet()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    tx_id = str(uuid.uuid4())[:8]
    ticker = req.ticker.upper().strip()

    if req.type == "PURCHASE":
        total = req.total_amount or (req.price * req.shares)
        price = req.price or (total / req.shares if req.shares else 0)
        row = [tx_id, req.date, ticker, "PURCHASE", req.shares, round(price, 2), round(total, 2), 0, req.note or ""]
    elif req.type == "DIVIDEND":
        row = [tx_id, req.date, ticker, "DIVIDEND", 0, 0, 0, req.dividend, req.note or ""]
    else:
        raise HTTPException(status_code=400, detail="type must be PURCHASE or DIVIDEND")

    ws.append_row(row)
    return {"success": True, "id": tx_id, "ticker": ticker}


@app.delete("/api/transactions/{tx_id}")
def delete_transaction(tx_id: str):
    """Delete a transaction by its ID."""
    try:
        ws = get_worksheet()
        row_num = find_row_by_id(ws, tx_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not row_num:
        raise HTTPException(status_code=404, detail=f"Transaction {tx_id} not found")

    ws.delete_rows(row_num)
    return {"success": True, "deleted_id": tx_id}


@app.get("/api/transactions/{ticker}/recent")
def get_recent_transactions(ticker: str, limit: int = 5):
    """Return the most recent N transactions for a stock."""
    try:
        ws = get_worksheet()
        records = all_records(ws)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    ticker = ticker.upper()
    txs = [r for r in records if str(r.get("ticker", "")).upper() == ticker]
    recent = txs[-limit:][::-1]  # last N, newest first
    return {"ticker": ticker, "transactions": recent}


# ─── LINE Bot Webhook ─────────────────────────────────────────────────────────
@app.post("/webhook/line")
async def line_webhook(request: Request, x_line_signature: str = Header(None)):
    body = await request.body()
    body_str = body.decode("utf-8")

    try:
        handler = get_line_handler()
        handler.handle(body_str, x_line_signature)
    except InvalidSignatureError:
        raise HTTPException(status_code=400, detail="Invalid LINE signature")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return {"status": "ok"}


def _handle_line_event(event: MessageEvent):
    """Process a LINE message event."""
    user_id = event.source.user_id
    msg = event.message.text.strip()
    parts = msg.split()

    line_config = Configuration(access_token=LINE_ACCESS_TOKEN)

    with ApiClient(line_config) as api_client:
        line_api = MessagingApi(api_client)

        def reply(text: str):
            line_api.reply_message(
                ReplyMessageRequest(
                    reply_token=event.reply_token,
                    messages=[TextMessage(text=text)],
                )
            )

        cmd = parts[0].lower() if parts else ""

        # ── new yyyy/mm/dd TICKER SHARES COST ─────────────────────────────
        if cmd == "new" and len(parts) == 5:
            _, date, ticker, shares_str, cost_str = parts
            try:
                shares = int(shares_str)
                cost   = float(cost_str)
                price  = cost / shares if shares else 0
                ticker = ticker.upper()

                ws = get_worksheet()
                tx_id = str(uuid.uuid4())[:8]
                ws.append_row([tx_id, date, ticker, "PURCHASE", shares, round(price, 2), cost, 0, "LineBot"])

                # Recalculate summary
                records = all_records(ws)
                txs = [r for r in records if str(r.get("ticker", "")).upper() == ticker and r.get("type") == "PURCHASE"]
                total_sh = sum(int(r.get("shares") or 0) for r in txs)
                total_co = sum(float(r.get("total_amount") or 0) for r in txs)
                avg = total_co / total_sh if total_sh else 0

                reply(
                    f"✅ 已記錄買入！\n"
                    f"ID: {tx_id}\n"
                    f"─────────────\n"
                    f"📅 {date}  {ticker}\n"
                    f"📦 {shares:,} 股  共 ${int(cost):,}\n"
                    f"─────────────\n"
                    f"📊 目前 {ticker} 統計\n"
                    f"總股數: {total_sh:,}  帳面成本: ${avg:.2f}"
                )
            except Exception as e:
                reply(f"❌ 錯誤: {e}\n格式: new yyyy/mm/dd 代號 股數 成本")

        # ── div yyyy/mm/dd TICKER AMOUNT ──────────────────────────────────
        elif cmd == "div" and len(parts) == 4:
            _, date, ticker, amount_str = parts
            try:
                amount = float(amount_str)
                ticker = ticker.upper()

                ws = get_worksheet()
                tx_id = str(uuid.uuid4())[:8]
                ws.append_row([tx_id, date, ticker, "DIVIDEND", 0, 0, 0, amount, "LineBot"])

                reply(
                    f"✅ 已記錄股利！\n"
                    f"ID: {tx_id}\n"
                    f"─────────────\n"
                    f"📅 {date}  {ticker}\n"
                    f"💰 股利: ${int(amount):,}"
                )
            except Exception as e:
                reply(f"❌ 錯誤: {e}\n格式: div yyyy/mm/dd 代號 金額")

        # ── delete TICKER ─────────────────────────────────────────────────
        elif cmd == "delete" and len(parts) == 2:
            arg = parts[1]

            # If arg looks like a number (1-5), it's confirming a pending delete
            if arg.isdigit() and user_id in pending_deletes:
                idx = int(arg) - 1
                choices = pending_deletes[user_id]
                if 0 <= idx < len(choices):
                    tx = choices[idx]
                    tx_id = str(tx.get("id", ""))
                    try:
                        ws = get_worksheet()
                        row_num = find_row_by_id(ws, tx_id)
                        if row_num:
                            ws.delete_rows(row_num)
                        del pending_deletes[user_id]
                        tx_type = tx.get("type", "")
                        detail = f"{tx.get('shares')}股 ${int(tx.get('total_amount', 0)):,}" if tx_type == "PURCHASE" else f"股利 ${int(tx.get('dividend', 0)):,}"
                        reply(f"🗑️ 已刪除！\n{tx.get('date')} {tx.get('ticker')} {detail}")
                    except Exception as e:
                        reply(f"❌ 刪除失敗: {e}")
                else:
                    reply(f"❌ 請輸入 1 到 {len(choices)} 之間的數字")

            else:
                # arg is a ticker — list recent transactions
                ticker = arg.upper()
                try:
                    ws = get_worksheet()
                    records = all_records(ws)
                    txs = [r for r in records if str(r.get("ticker", "")).upper() == ticker]
                    recent = txs[-5:][::-1]

                    if not recent:
                        reply(f"❌ 找不到 {ticker} 的交易紀錄")
                        return

                    pending_deletes[user_id] = recent
                    lines = [f"🔍 {ticker} 最近 {len(recent)} 筆交易：", "回覆數字選擇要刪除的項目"]
                    for i, t in enumerate(recent, 1):
                        tx_type = t.get("type", "")
                        if tx_type == "PURCHASE":
                            detail = f"買入 {t.get('shares')}股 ${int(t.get('total_amount', 0)):,}"
                        else:
                            detail = f"股利 ${int(t.get('dividend', 0)):,}"
                        lines.append(f"{i}️⃣ {t.get('date')} {detail}")
                    reply("\n".join(lines))

                except Exception as e:
                    reply(f"❌ 錯誤: {e}")

        # ── query TICKER ──────────────────────────────────────────────────
        elif cmd == "query" and len(parts) == 2:
            ticker = parts[1].upper()
            try:
                ws = get_worksheet()
                records = all_records(ws)
                txs = [r for r in records if str(r.get("ticker", "")).upper() == ticker]
                if not txs:
                    reply(f"❌ 找不到 {ticker} 的資料")
                    return
                total_sh = sum(int(r.get("shares") or 0) for r in txs if r.get("type") == "PURCHASE")
                total_co = sum(float(r.get("total_amount") or 0) for r in txs if r.get("type") == "PURCHASE")
                total_dv = sum(float(r.get("dividend") or 0) for r in txs if r.get("type") == "DIVIDEND")
                avg = total_co / total_sh if total_sh else 0
                actual = (total_co - total_dv) / total_sh if total_sh else 0
                reply(
                    f"📊 {ticker} 持倉摘要\n"
                    f"─────────────\n"
                    f"總股數: {total_sh:,}\n"
                    f"總成本: ${int(total_co):,}\n"
                    f"帳面成本: ${avg:.2f}/股\n"
                    f"實際成本: ${actual:.2f}/股\n"
                    f"累計股利: ${int(total_dv):,}"
                )
            except Exception as e:
                reply(f"❌ 錯誤: {e}")

        # ── Help ──────────────────────────────────────────────────────────
        else:
            reply(
                "💡 指令說明：\n"
                "─────────────\n"
                "📥 買入:\n"
                "new yyyy/mm/dd 代號 股數 成本\n"
                "範例: new 2024/01/15 2330 100 60000\n\n"
                "💰 股利:\n"
                "div yyyy/mm/dd 代號 金額\n"
                "範例: div 2024/06/01 2330 2000\n\n"
                "🗑️ 刪除:\n"
                "delete 代號 → 選擇要刪除的筆數\n\n"
                "📊 查詢:\n"
                "query 代號"
            )


# Register handler after the function is defined
try:
    _h = get_line_handler()

    @_h.add(MessageEvent, message=TextMessageContent)
    def _on_message(event: MessageEvent):
        _handle_line_event(event)

except Exception:
    # LINE_CHANNEL_SECRET not set at startup — handler will be registered on first webhook hit
    pass


# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Stock Performance API"}


# ─── Serve built React frontend (production) ──────────────────────────────────
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        # Let API routes pass through; catch-all for SPA
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
else:
    @app.get("/")
    def health_fallback():
        return {"status": "ok", "service": "Stock Performance API (dev mode — run frontend separately)"}
