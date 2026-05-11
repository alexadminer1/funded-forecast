# FundedForecast — Session Log

Точка входа для любого нового контекста. Читается за 5 минут.

**Как использовать:**
- Новый чат с Claude → прочти этот файл + `docs/BACKLOG.md`
- Детали архитектуры → `docs/BACKLOG.md` раздел "Архитектурные константы"
- Детали задачи → ищи по commit hash в `git show <hash>`

---

## 2026-05-11

### Контекст сессии

Демо-готовность. Четыре задачи по блокерам перед показом инвестору / первым реальным платежом.

---

### [HEADER] Рефакторинг шапки — гостевой хедер на авторизованных страницах `584f0f4`

**Проблема:** Залогиненный пользователь на `/affiliates`, `/faq`, `/leaderboard` видел гостевую шапку (LandingHeader) вместо своей. Три отдельных бага с одним корнем.

**Корень:** `HeaderWrapper.tsx` монтировался на сервере (SSR) без доступа к localStorage — `getToken()` всегда возвращал `null`. `isActive("/affiliates")` не срабатывал, поэтому гостевая шапка просачивалась на аутентифицированные страницы.

**Решение:** mounted-паттерн в `HeaderWrapper` — рендер только после гидратации клиента:
```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);
if (!mounted) return null;
return getToken() ? <Header /> : <LandingHeader />;
```
`Header.tsx` упрощён: убраны все гостевые ветки — он теперь рендерится только для залогиненных.

---

### [SEC-1] Rate limiting через proxy.ts `31349d3`

**Проблема:** Архитектор обнаружил 3 дыры в `src/proxy.ts` (Next.js 16 middleware):

1. `getLimiter()` не знал о 3 affiliate endpoints → они падали в `default` лимитер (60/мин вместо 5/ч)
2. `/api/cron/*` роуты не имели bypass → планировщик мог получить 429 и упасть
3. Нет `try/catch` → если Redis/Upstash недоступен, весь API возвращает 500

**Решение (вариант B — дополнить, не переписывать):**
- `getLimiter()`: добавлены 3 строки для affiliate endpoints
- `proxy.ts`: добавлен bypass для cron + webhook, весь блок обёрнут в `try/catch { return NextResponse.next() }`

**Принцип:** rate limiting — это защита, не блокировка легитимного трафика. Failsafe обязателен.

---

### [D20] Скрыть позиции в failed challenges `274eeab`

**Проблема:** После провала challenge открытые позиции оставались видны в `/dashboard` и `/user/positions`. Пользователь видел "активные" позиции в мёртвом challenge — вводило в заблуждение.

**Решение:** Prisma фильтр `NOT: { challenge: { status: "failed" } }` в двух endpoints:
- `GET /api/user/positions` — список позиций
- `GET /api/user/me` — счётчик `openPositionsCount`

**Важно:** Это workaround, не архитектурный fix. Правильное решение (TODO A2) — автоматически закрывать позиции при провале challenge. Фильтр помечен комментарием `// TODO [A2]`.

**Prisma семантика:** `NOT: { challenge: { status: "failed" } }` включает строки где `challengeId IS NULL` ИЛИ `challenge.status != 'failed'` — именно то, что нужно.

---

### [D15] Popup "Payment confirmed" + fallback polling `47f4ebd`

**Проблема:** После CONFIRMED payment страница `/checkout` не показывала никакого подтверждения. `router.push("/dashboard")` вызывался тихо, без визуального feedback. Если cron активации запаздывал (challengeId ещё null), редирект не происходил вообще. Silent `catch {}` блоки глотали ошибки и прятали реальные проблемы.

**Три правки в `src/app/checkout/page.tsx`:**

1. **Logging:** `catch {}` → `catch (err) { console.error("[checkout] polling error:", err) }`

2. **Popup вместо тихого редиректа:** `router.push("/dashboard")` → `setShowSuccessPopup(true)`. Компонент `SuccessPopup` показывает: план, размер аккаунта, profit target, ссылку на tx в BaseScan. Кнопка "Go to Dashboard →" — единственный выход (нет ×, нет клика по backdrop).

3. **Fallback polling:** 4-й `useEffect` — каждые 10 сек опрашивает `/api/payments/me/active`. Если `recentConfirmed.challengeId` появился — показывает popup. Защита от случая когда основной polling (по `/payments/[id]/status`) не сработал.

**BaseScan links:**
- chainId 8453 → `https://basescan.org/tx/{hash}`
- chainId 84532 → `https://sepolia.basescan.org/tx/{hash}`

---

## 2026-05-08

**Auto-pass logic + email helper refactor.** P0 закрыт.

При закрытии сделки через sell — challenge автоматически переходит в `passed` если выполнены условия (profitTargetMet + tradingDaysCount >= minTradingDays + !drawdownViolated). Раньше требовал ручного действия админа.

Email refactor: создан `src/lib/email.ts` — shared `sendEmail()` helper (никогда не бросает), `buildBrandTemplate()`, `buildKeyValueTable()`. Все email-маршруты переключены на него.

Коммиты: `6303c22` (auto-pass), `e9fd5fc` (email refactor)

---

## 2026-05-07

**On-chain payment loop замкнут.** Три больших блока:

**Step 4 — Watcher service** (`5bf63d5` + fixes): viem + Alchemy, batch 9 блоков/запрос (Alchemy free tier inclusive limit = 10, т.е. toBlock-fromBlock ≤ 9). Детектирует USDC Transfer events, матчит с Payment по сумме, advances confirmations. E2E: 2 транзакции из MetaMask → CONFIRMED за 2-22 минуты.

**P0 #1 — Checkout UX + zombie cleanup** (`f3886e2` + 4 коммита): Postgres partial unique index не может содержать `now()` в predicate → zombie AWAITING_PAYMENT блокировали новые invoice. Layered defense: inline cleanup при create + cron expire-payments каждую минуту. Cancel button на /checkout, banner на /account/plans.

**Step 5 — Activation flow** (`c85811f`, `86d85cd`): `activatePayment()` с pg_advisory_xact_lock, создаёт Challenge из Payment, idempotent. Cron `/api/cron/activate-payments` каждую минуту. F5 fix: `/api/payments/me/active` возвращает recentConfirmed → checkout восстанавливает состояние после перезагрузки.

---

## 2026-05-06

**On-chain payment subsystem.** NowPayments полностью удалён.

Step 1 schema (`b0eba69`): новые модели Payment/PaymentTransaction/PaymentWatcherState, BigInt для amount, cuid id. Миграция вручную через Coolify Database Terminal.

Step 2 invoice API (`5514c82`): POST /api/payments/create (advisory lock, amount uniqueness ±50 cents, idempotent), GET /api/payments/[id]/status. tsconfig ES2017 → ES2020 (BigInt literals).

Step 3 checkout UI (`4e577fd` + `c6d21dc` + `22b3c10`): QR код, countdown, polling, 7 UI states. Critical fix: `useRef` flag вместо `useState` в useEffect (предотвращает infinite loop при 429).

---

## 2026-05-05

**Security revamp + UX.** 7 коммитов.

Закрыт бесплатный challenge flow (`a40e135`), STARTING_BALANCE $10 для новых юзеров (`343e66b`), `/account/plans` plan selection UI (`20210df`). Mobile responsive headers. Cron auto-fail expired challenges hourly. Post-challenge dashboard banner (passed/expired/failed).

---

## 2026-05-04

**Affiliate MVP 100% + Sandbox VPS.**

Полный affiliate program: schema, click tracking, conversions, cron, apply/approval, cabinet UI, admin UI, payout flow, public landing page. 

Sandbox: Hetzner CX23, Coolify GUI, tradepredictions.online, PostgreSQL 17, auto-deploy из main. E2E tests T0-T26 ALL PASS на production.

---

## Текущее состояние (2026-05-11)

### Что работает end-to-end
- Регистрация → выбор плана → on-chain оплата USDC (Base Sepolia testnet) → popup подтверждения → активация challenge → торговля → auto-pass при достижении цели → email уведомление
- Affiliate program: клик → attribution → конверсия → холд → payout
- Admin панель: пользователи, affiliate, платежи, планы

### Активные cron задачи на Coolify
| Cron | Расписание | Что делает |
|------|-----------|------------|
| `watch-payments` | `* * * * *` | Alchemy watcher — детектирует USDC transfers |
| `activate-payments` | `* * * * *` | CONFIRMED → Challenge создание |
| `expire-payments` | `* * * * *` | AWAITING → EXPIRED cleanup |
| `expire-challenges` | `0 * * * *` | Active → Failed по дедлайну |
| `affiliate-hold` | `0 3 * * *` | Pending → Available conversions |

### Ключевые env vars (в Coolify)
`DATABASE_URL` (sandbox Postgres), `JWT_SECRET`, `CRON_SECRET`, `ALCHEMY_API_KEY`, `USDC_CONTRACT_ADDRESS`, `RECEIVER_ADDRESS`, `CHAIN_ID=84532` (testnet), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`

### Что НЕ сделано из важного (P1)
- `prisma migrate deploy` в Coolify start command — миграции пока вручную
- Pre-prod security audit (ротировать секреты)
- Coolify → Base Mainnet switch (сейчас testnet)
- Admin dashboard 403 bug (frontend не handle'ит 4xx)

---

## Инфраструктура

| | URL | Назначение |
|--|-----|-----------|
| Production | https://tradepredictions.online | Coolify VPS, Hetzner Helsinki |
| Fallback | https://funded-forecast.vercel.app | Vercel Hobby (not primary) |
| Coolify GUI | https://coolify.tradepredictions.online | Deploys, cron, DB terminal |
| DB terminal | Coolify → Database → Terminal | `psql -U postgres -d fundedforecast` |

**Важно:** sandbox БД резолвится только внутри Coolify контейнеров. Локальный `.env` → production Supabase (другой инстанс).
