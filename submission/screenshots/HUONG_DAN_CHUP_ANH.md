# HƯỚNG DẪN CHỤP 7 ẢNH MÀN HÌNH (DẸP NHƯ CHƠI GAME)

> **Chuẩn bị:** Đã deploy xong lên production (Render/Vercel/Cloud Run), đã có tài khoản Stripe live, đã có 1-2 khách hàng thật đã hỏi câu hỏi và trả tiền.

---

## CÔNG CỤ CẦN CÓ
- **Windows:** Nhấn `Win + Shift + S` → kéo chọn vùng → tự lưu vào clipboard → dán vào Paint → lưu
- **Mac:** Nhấn `Cmd + Shift + 4` → kéo chọn → tự lưu ra Desktop
- **Hoặc:** Dùng **Snipping Tool** (Windows) / **Screenshot** (Mac)

---

## ẢNH 1: `01_triage_result.png` — Triết Agent Phân Loại

**Đi đến:** Trang chi tiết câu hỏi (Query Detail)

```
Production URL → /query/[id]   (ví dụ: https://expertai.com/query/abc123)
```

**Làm thế nào:**
1. Đăng nhập tài khoản user thường (KHÔNG phải admin/professional)
2. Vào **Dashboard** → click vào một câu hỏi đã hỏi
3. Tìm khu vực **"Phân loại bởi AI"** hoặc **"Triage Result"**
4. Chụp màn hình phần hiển thị:
   - **Domain:** legal / financial / medical
   - **Complexity Score:** 0.xx
   - **Needs Escalation:** true / false
   - **Escalation Reason:** (nếu có)
   - **Mode:** gemini-1.5-flash / local_safety_guidance

**Mẹo:** Chụp full màn hình trang query detail, sau đó crop lại phần triage.

---

## ẢNH 2: `02_specialist_response.png` — Chuyên Gia Trả Lời

**Cùng trang:** `/query/[id]`

**Chụp phần:**
- **Câu hỏi của user** (ngắn gọn)
- **Trả lời của AI Specialist** (LegalAgent / FinancialAgent / MedicalAgent)
- **Disclaimer bắt buộc:** *"ExpertAI provides educational information, not legal/medical/financial advice..."*
- **Agent name:** LegalAgent / FinancialAgent / MedicalAgent

**Ví dụ đẹp:**
```
User: "Tôi bị chủ nhà giữ tiền đặt cọc 2 tháng, có quyền kiện không?"
LegalAgent: "Theo luật [bang], chủ nhà phải trả lại trong 30 ngày... 
⚠️ Disclaimer: Đây là thông tin giáo dục, không phải tư vấn pháp lý..."
```

---

## ẢNH 3: `03_execution_trace.png` — Lịch Sử Thực Thi (Audit Trail)

**Cùng trang:** `/query/[id]` → Tab **"Execution Logs"** hoặc **"Audit Trail"**

**Chụp bảng hiển thị các hàng:**

| Agent Name | Action | Decision | Confidence | Latency | Status |
|------------|--------|----------|------------|---------|--------|
| TriageAgent | classify_and_route | route_legal | 0.92 | 340ms | completed |
| LegalAgent | generate_response | response_available | 0.78 | 1240ms | completed |
| FollowUpAgent | recommend_next_steps | next_steps_generated | 0.85 | 180ms | completed |

**Yêu cầu:** Phải thấy **ít nhất 3 hàng** (Triage + Specialist + FollowUp). Nếu có escalation thì thêm hàng EscalationAgent.

---

## ẢNH 4: `04_escalation_created.png` — Portal Chuyên Gia Nhận Case

**Đi đến:** Trang Professional Portal (cần tài khoản professional)

```
Production URL → /professional   (ví dụ: https://expertai.com/professional)
```

**Cách lấy tài khoản professional:**
1. Đăng ký tài khoản mới
2. Vào database (hoặc admin panel) set `role = 'professional'` cho user đó
3. Hoặc dùng `PROFESSIONAL_INVITE_CODE` nếu đã config

**Chụp màn hình:**
- Danh sách **Available Referrals** (chưa ai claim)
- Click vào 1 case → hiện **Case Summary** (intake brief)
- Phải thấy: Domain, Reason, Case Summary, Query Content (đã ẩn tên/hủy thông tin nhạy cảm)

---

## ẢNH 5: `05_operations_dashboard.png` — Dashboard Vận Hành

**Đi đến:** `/operations` (cần tài khoản admin)

```
Production URL → /operations
```

**Chụp toàn trang hoặc các widget quan trọng:**
- **Total Queries (30 ngày)**
- **AI Resolution Rate** (%)
- **Escalation Rate** (%)
- **Avg Response Time**
- **Revenue (Stripe)**
- **Active Subscriptions**
- **Top Domains** (Legal/Financial/Medical chart)
- **Agent Performance Table**

**Nếu chưa có trang /operations:** Chụp màn hình database query kết quả (xem ảnh 7).

---

## ẢNH 6: `06_stripe_revenue.png` — Doanh Thu Stripe

**Đi đến:** https://dashboard.stripe.com

**Đăng nhập tài khoản Stripe LIVE (không phải test mode)**

**Chụp 2 màn hình (có thể ghép 1):**

### Màn hình 1: Payments
```
Payments → All payments → Filter: Last 90 days → Export → Chụp màn hình danh sách
```
Phải thấy: **Succeeded**, **Amount** ($19.00 / $99.00), **Customer email**, **Date**

### Màn hình 2: Subscriptions
```
Subscriptions → Active → Filter: Last 90 days
```
Phải thấy: **Active**, **Plan** (B2C/B2B), **Status**, **Customer**

**Mẹo:** Chuyển Stripe sang **Live mode** (góc trái trên), không dùng Test mode.

---

## ẢNH 7: `07_database_schema.png` — Sơ Đồ Database

**Cách 1: Dùng tool tự động (khuyên dùng)**
```bash
# Nếu dùng PostgreSQL
npx prisma generate && npx prisma db pull
# Hoặc dùng: https://github.com/ralph-pichler/PostgreSQL-Auto-Documentation
```

**Cách 2: Chụp màn hình pgAdmin / DBeaver / TablePlus**
- Kết nối production database
- Mở schema `public`
- Chụp các bảng chính:
  - `users`
  - `queries`
  - `messages`
  - `agent_execution_logs`
  - `escalations`
  - `subscriptions` / `revenue_events`

**Cách 3: Vẽ tay đơn giản (nhanh nhất)**
Mở **draw.io** (diagrams.net) → vẽ 6 hộp → mũi tên khóa ngoại → export PNG

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │ 1:N   │  queries    │ 1:N   │  messages   │
├─────────────┤───────├─────────────┤───────├─────────────┤
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │
│ email       │       │ user_id(FK) │       │ query_id(FK)│
│ role        │       │ domain      │       │ role        │
│ stripe_cus  │       │ status      │       │ content     │
└─────────────┘       └─────────────┘       └─────────────┘
         │                    │
         │ 1:N                │ 1:N
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│ escalations     │  │agent_exec_logs  │
├─────────────────┤  ├─────────────────┤
│ id (PK)         │  │ id (PK)         │
│ query_id (FK)   │  │ query_id (FK)   │
│ professional_id │  │ agent_name      │
│ status          │  │ decision        │
└─────────────────┘  └─────────────────┘
```

---

## CHECKLIST TRƯỚC KHI NỘP

| Ảnh | Đã chụp? | Đã lưu vào `submission/screenshots/`? |
|-----|----------|--------------------------------------|
| 01_triage_result.png | ☐ | ☐ |
| 02_specialist_response.png | ☐ | ☐ |
| 03_execution_trace.png | ☐ | ☐ |
| 04_escalation_created.png | ☐ | ☐ |
| 05_operations_dashboard.png | ☐ | ☐ |
| 06_stripe_revenue.png | ☐ | ☐ |
| 07_database_schema.png | ☐ | ☐ |

---

## LƯU Ý QUAN TRỌNG

1. **KHÔNG chụp màn hình localhost** — Phải là **production URL** (HTTPS)
2. **KHÔNG chụp test data** — Phải là **khách hàng thật**, **tiền thật**
3. **Che thông tin nhạy cảm:** Email khách, API keys, secret keys — dùng Paint vẽ đen
4. **Đặt tên file đúng chuẩn:** `01_triage_result.png` (không dấu cách, không tiếng Việt)
5. **Kích thước:** Tối thiểu 1920x1080, định dạng PNG

---

## NẾU CHƯA CÓ PRODUCTION → LÀM NGAY HÔM NAY

1. **Backend:** Push lên Render.com (free tier có Postgres) / Railway / Fly.io
2. **Frontend:** Push lên Vercel (free) / Netlify
3. **Env vars production:** Set đầy đủ 15 biến trong README
4. **Stripe:** Tạo 2 Price ID (B2C $19, B2B $99) → copy vào env
5. **Gemini:** Lấy API key tại https://aistudio.google.com/apikey
6. **GCS:** Tạo bucket Google Cloud Storage (free tier 5GB)

**Ước tính thời gian:** 2-3 giờ nếu làm tập trung.

---

*Xong 7 ảnh → copy vào `submission/screenshots/` → `git add . && git commit -m "Add screenshots" && git push`*