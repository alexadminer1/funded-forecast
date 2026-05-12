# FundedForecast — Session Log

Точка входа для любого нового контекста. Читается за 5 минут.

**Как использовать:**
- Новый чат с Claude → прочти этот файл + `docs/BACKLOG.md`
- Детали архитектуры → `docs/BACKLOG.md` раздел "Архитектурные константы"
- Детали задачи → ищи по commit hash в `git show <hash>`

---

## Session 2026-05-12 (continued) — Session 10 — P0.2.c CLOSED + new findings

### Закрыто
- P0.2.c Equity-aware MLL upgrade (Wave C)
  - Новый файл: src/lib/equity.ts (computeOpenPositionsValue + computeEquity)
  - Schema: добавлено Challenge.peakEquity Float?
  - SQL migration: ALTER TABLE + UPDATE backfill 5 active challenges
  - 3 правки: src/app/api/trade/buy/route.ts, sell/route.ts, marketResolve.ts
    - В каждом: isFailedByCash || isFailedByEquity
    - violationReason: разный формат для cash-fail vs equity-fail
    - peakEquity: MAX(peakEquity ?? peakBalance, equity)
  - Commit: 4b2b487
  - Coolify deploy: ✅ Success (после одного разового retry)
  - БД миграция: ALTER + UPDATE выполнен Алексеем 12 мая
  - Sanity test (test8 Starter, challenge id=17):
    - Before buy: realizedBalance=1000, peakBalance=1000, peakEquity=1000
    - After buy 75 sh @ 0.0652 (cost $4.89):
      realizedBalance=995.11, peakBalance=1000, peakEquity=1000
    - Formula verified: equity = 995.11 + 75×0.065 = 999.99 < 1000
    - peakEquity stayed at 1000 (MAX(1000, 999.99))

### Discovery findings (НЕ блокеры, новые задачи)
- Coverage gap в sync-markets: limit=30, но cron шлёт offset += 100
  → пропускаются индексы 30-100, 130-200, 230+
  → 298/541 (55%) live маркетов stale > 7 дней
- Stale market accumulation: 70 маркетов с endDate < NOW status='live'
  → Polymarket их не возвращает в active feed, никогда не cleanup
- Эти проблемы влияют на equity accuracy (Wave C считает на старых ценах
  для маркетов, которые не sync'аются)

### Создано в BACKLOG
- P0.2.d Sync coverage fix
- P0.2.e Stale market cleanup

### Lessons learned
- Wave A (cash-based MLL) — backstop check, остался работать после Wave C
- На buy equity почти не меняется (cash↓ балансирует position value↑),
  Wave C полезен в первую очередь в sell/marketResolve
- Округление: cost $4.89 vs avgPrice 0.0652 × 75 = $4.89 (нет drift)

---

## Session 2026-05-12 (continued) — Session 10 — P0.2.b CLOSED

### Закрыто
- P0.2.b Sync-prices cron infrastructure
  - Bug fix: убран хардкод "https://funded-forecast.vercel.app"
    в src/app/api/cron/sync/route.ts (2 места)
  - Заменено на getBaseUrl() helper с throw if NEXT_PUBLIC_APP_URL missing
  - Добавлена проверка ADMIN_API_KEY с throw (было ! non-null assertion)
  - sync-prices fetch теперь захватывает response (раньше терялся)
  - console.error при failure (раньше silent)
  - Commit: 0f2ce7d
  - Coolify deploy: ✅ Success
  - Coolify Scheduled Task создан:
    - Name: sync-prices
    - Command: curl -fsS -H "Authorization: Bearer $CRON_SECRET"
               https://tradepredictions.online/api/cron/sync
    - Frequency: */15 * * * *
    - Timeout: 300s
  - Verify (Coolify Recent executions): 2 Success runs
  - Verify (DB): MAX("lastSyncedAt")=2026-05-12 05:54:12,
    128 markets synced last 5 minutes, 537 total live markets

### Lessons learned
- NEXT_PUBLIC_APP_URL был выставлен правильно в Coolify,
  настоящая проблема была в отсутствии cron task (никто не вызывал endpoint)
- Хардкод Vercel fallback — бомба замедленного действия (silent fail
  если кто-то удалит env), убран ради diagnostics

### Unblocked
- P0.2.c Equity-aware MLL upgrade (требовал свежих цен)

---

## Session 2026-05-12 (continued) — Session 10 — P0.2 Wave A CLOSED

### Закрыто
- P0.2 Wave A — MLL Trailing (TFP-style fixed drawdown, realized-based)
  - Формула: maxLossAmount = startBalance × maxLossPct/100 (FIXED)
  - MLL = peakBalance − maxLossAmount (trailing вверх)
  - isFailed = realizedBalance < MLL
  - Файлы (3):
    - src/app/api/trade/buy/route.ts (~204 строка)
    - src/app/api/trade/sell/route.ts (~191 строка)
    - src/lib/marketResolve.ts (~108 строка)
  - violationReason единый формат:
    "Max Loss hit: balance $XXX below limit $YYY (peak $ZZZ)"
  - Commit: f2f46bb
  - Coolify deploy: ✅ Success
  - БД миграция (Алексей вручную в Coolify Terminal):
    UPDATE "Challenge" SET "peakBalance" = GREATEST("startBalance", "realizedBalance")
    WHERE status = 'active';
  - 5 active challenges мигрированы

### Discovery findings
- peakBalance уже было в schema (из подготовки)
- newPeakBalance уже обновлялся в buy/sell/resolve (правильно)
- Был сломан только MLL check — считал от startBalance вместо peakBalance
- violationReason нигде не парсится — можно менять формат свободно

### НЕ ДЕЛАЛИ (отложено)
- P0.2.b Sync-prices cron infrastructure (новая задача в BACKLOG)
- P0.2.c Equity-aware MLL upgrade (новая задача в BACKLOG)
  - Цены в БД stale: 0 маркетов обновлены за 24ч, 313/501 > 7 дней
  - Wave C невозможен пока цены не свежие
  - Текущий Wave A безопасен на realizedBalance

### Critical findings (для P0.2.b)
- BUG: src/app/api/cron/sync/route.ts хардкодит fallback URL
  "https://funded-forecast.vercel.app" — Vercel мёртв, sync падает
- Нет sync-prices cron в Coolify Scheduled Tasks
- Все 501 live маркетов имеют stale цены

### Lessons learned
- Claude Code предлагал неправильную формулу: drawdown = (peak-realized)/peak × 100
  Это НЕ TFP-style. Правильно: maxLossAmount FIXED от startBalance
- Architecture decision требует проверки данных до выбора (вариант B vs C решён
  по результатам discovery)

---

## Session 2026-05-12 — Session 10 — P0.1 Refundable Fee CLOSED

### Закрыто
- P0.1 Refundable Fee removal (backend + БД + Admin, без текстов)
  - БД: UPDATE "ChallengePlan" SET "refundableFeeCents" = 0 (3 plans)
  - Backend: src/app/api/user/payout/route.ts — убран bonus calculation
    (priorPaid query + refundableFeeCents → finalAmount = amount)
  - Backend: src/app/api/admin/payouts/[id]/route.ts — убрана установка
    refundableFeePaidAt при approve payout
  - Frontend: src/app/admin/page.tsx — 7 точечных правок
    (поле из emptyNew, startEdit, saveEdit, addPlan + 2 input-поля
     из Edit/Add forms + Fee bonus из payouts list + grid 3→2 и 4→3)
  - Commit: 841a536
  - Coolify deploy: ✅ Success (5m 41s)
  - Production test: Edit Plan ✓, New Plan ✓, Payouts list ✓

### НЕ ТРОНУТО (deferred)
- prisma/schema.prisma — поле refundableFeeCents остаётся
- src/lib/payment/activation.ts — копирование оставлено (default 0 из БД)
- src/app/api/admin/plans/route.ts + [id]/route.ts — API backward compatible
- src/app/page.tsx — тексты "Refundable Fee" на лендинге (отложено)
- DROP COLUMN миграция — через 7 дней после стабильной работы P0

### Lessons learned
- Claude Code изначально хотел делать больше (Prisma schema, activation.ts,
  admin/plans API) — Архитектор скорректировал scope
- В git add попали лишние файлы (.gitignore от прошлого коммита) —
  Claude Code сделал git restore --staged, всё прошло чисто
- БД UPDATE выполнен Алексеем вручную в Coolify DB Terminal (по правилу
  CLAUDE.md — не через Claude Code)

---

## Session 2026-05-11 (continuation 4) — P0.3.e Trading Days default 10→15

### Done
- ChallengePlan.minTradingDays UPDATED 10 → 15 для всех 3 планов (Starter/Pro/Elite)
- Применено напрямую через Coolify DB Terminal (sandbox БД)
- Existing active challenges не затронуты (minTradingDays — snapshot в Challenge таблице, NOT NULL без default)
- SQL: BEGIN; UPDATE "ChallengePlan" SET "minTradingDays" = 15; COMMIT;
- UI Admin Plans editor проверен — MIN TRADING DAYS=15 отображается корректно для всех планов

### Not done yet
- Production БД (когда переключимся с sandbox на mainnet) — повторить SQL

---

## Session 2026-05-11 (continuation 5) — P0.6 USDC unification

### Done
- prisma/schema.prisma: PayoutRequest.currency default "USDT" → "USDC"
- БД (sandbox): ALTER TABLE PayoutRequest ALTER COLUMN currency SET DEFAULT 'USDC'
- БД (sandbox): UPDATE existing USDT → USDC (0 rows — sandbox чистый)
- src/app/api/user/payout/route.ts: hardcoded "USDT" → "USDC" (line 191, hotfix после первого P0.6 коммита)
- src/app/account/page.tsx: 4 дефолта walletNetwork → "USDC ERC20", оба select-а (profile + payout) → только USDC ERC20 + USDC Polygon
- src/app/faq/data.ts:56: текст обновлён на "USDC on ERC20 and Polygon networks"
- src/app/how-it-works/page.tsx:40: "USDT is sent" → "USDC is sent"

### Scope NOT touched
- src/app/terms/page.tsx раздел 8.3 — это affiliate payout (отдельный flow с AffiliatePaymentMethod enum, оставляем оба варианта)
- src/app/api/admin/payouts/* — currency валидация уже корректна
- src/lib/payment/* — incoming USDC payments, не трогаем

### Not done yet
- Production БД (когда переключимся с sandbox на mainnet) — повторить ALTER + UPDATE

---

## Session 2026-05-11 (continuation 6) — P0.10 email templates DRAFTS

### Done
- Создана директория src/lib/email-templates/ с 7 файлами:
  - verification.ts — Email verification (registration)
  - payment-confirmed.ts — Challenge активирован после payment
  - challenge-passed.ts — Challenge passed
  - challenge-failed.ts — Challenge failed (drawdown/expired) + Instant Reset CTA
  - payout-approved.ts — Payout одобрен админом
  - payout-completed.ts — Payout отправлен on-chain (BaseScan/PolygonScan link)
  - index.ts — barrel export
- Все шаблоны используют buildBrandTemplate + buildKeyValueTable + escapeHtml из src/lib/email.ts
- Типизированные параметры (export interface XxxEmailData)
- TFP-style DRAFTS — финальный copywriting от заказчика (OPEN_QUESTIONS_P0.md #2)
- TypeScript check: clean

### Scope NOT covered (отложено в Wave 2/3)
- Inactivity warning email — P1 (не P0)
- MLL warning email — P1
- Интеграция в endpoints (вызовы sendEmail) — Wave 3
- Существующий auto-pass email в trade/sell/route.ts:323 — будет переподключён в Wave 3

### Hotfix приложен к коммиту
- src/app/api/user/payout/route.ts:191 — currency hardcode "USDT" → "USDC" (часть P0.6, пропущенная в коммите 41bb411)

---

## Session 2026-05-11 (continuation 3) — Backlog audit + corrections

### Получено
- Аудит backlog от заказчика (19 пунктов замечаний + 3 корректировки структуры)

### Принято в backlog
- 18/22 пунктов аудита приняты с моими решениями
- 4 пункта вынесены в OPEN_QUESTIONS_P0.md (требуют ответа заказчика)
- Скорректирована оценка P0 с buffer 30% (132ч)
- Добавлены P0.10 Email templates + P0.11 Backup & DR
- P1 разделён на P1.early (critical, 117ч) + P1.late (48ч)
- Добавлены P1.7 Analytics + P1.8 Support
- Создан MIGRATION_PLAN с rollback strategy

### Total estimate to production
- 44 working days ≈ 9 weeks

### Blocked on
- 4 open questions: KYC rejection policy, email copywriting, MaxMind verification, backup storage

---

## Session 2026-05-11 (continuation 2) — TFP audit + decisions

### Получено от заказчика
- 10 decisions по бизнес-модели (см. BACKLOG)
- 4 предупреждения решены (migration, partial sell, trading days, порядок P0)

### Зафиксировано
- BACKLOG реструктурирован: P0/P1/P2/P3
- Старые блокеры → Archive section
- Оценка P0: ~86ч (~11 дней)
- Оценка P1: ~136ч (~17 дней)

### Pre-prod plan
- Перед катом P0 в prod: synthetic users simulation (10-20 ботов)
- Existing test data (test6/7/8) маркированы как legacy

### Следующий шаг
- Создать MIGRATION_PLAN_P0.md с детальным порядком работы
- НЕ начинать implementation до подтверждения backlog

---

## 2026-05-11 (продолжение) — D26 + ghost balance discovery

### Контекст сессии

Продолжение той же демо-сессии. Закрыты D27/D28 (изоляция позиций), D26 (история challenges + secondary sandbox card), обнаружен D29 (ghost balance). Создан docs/WALLET_MODEL.md — архитектурное решение [A1] подтверждено.

---

### [D27/D28] Full-reload после покупки + изоляция позиций по challengeId `6773a37`

**Проблема D27:** `router.push("/dashboard")` в checkout — SPA-навигация, не вызывает повторных fetch. После успешной покупки дашборд оставался с данными предыдущей сессии.

**Проблема D28:** После провала challenge позиции того challenge всё ещё показывались в дашборде. Старый фильтр `NOT: { challenge: { status: "failed" } }` (D20) не разделял sandbox и challenge wallets — позиции от разных контекстов перемешивались.

**Решение D27:** `src/app/checkout/page.tsx` — `router.push("/dashboard")` → `window.location.href = "/dashboard"`. Full page reload форсирует все fetch заново.

**Решение D28:** Явная фильтрация по `challengeId`:
- Active challenge → `challengeId: activeChallenge.id`
- Нет active challenge → `challengeId: null` (sandbox)

Применено в двух местах:
- `GET /api/user/positions/route.ts` — список позиций
- `GET /api/user/me/route.ts` — счётчик `openPositionsCount` (запрос `activeChallenge` перемещён выше счётчика — reuse без extra query)

**TODO [A1]** в обоих файлах — заменить на нативную walletId фильтрацию после реализации wallet model. Детали: `docs/WALLET_MODEL.md`.

---

### [D26] История challenges + sandbox secondary card `00370d0`, `6dbfbc3`

**Проблема:** После провала/прохождения challenge пользователь не видел историю. Sandbox режим при активном challenge не отображался в UI.

**Бэкенд** (`00370d0`):
- Новый `GET /api/user/challenges` — terminal challenges (passed/failed/expired) с вычисленными полями: `pnl`, `profitTargetProgress` (0–100%), `drawdownUsed` (0–100%), `positionsCount` через Prisma `_count`
- `GET /api/user/mode` расширен: если active challenge — добавляет `sandboxBalance` + `sandboxPositionsCount` для вторичной карточки

**Фронтенд** (`6dbfbc3`):
- `PastChallengesSection` — таблица с badge (passed=green, failed=red, expired=gray), hover border transition, caret. Клик → `ChallengeDetailModal`
- `SandboxSecondaryCard` — мутный фон, PAUSED badge, balance + кол-во позиций, helper text. Видна только при active challenge
- `ChallengeDetailModal` — закрытие через ESC + ✕ + клик по backdrop. Stats как `{label: string; value: string; color?: string}[]` — не `React.ReactNode` (React не импортирован в файл, только хуки). Violation reason block если заполнен
- Layout порядок: ChallengeCard → PastChallengesSection → SandboxSecondaryCard → Open Positions
- 4-й fetch в `Promise.all` с failsafe: `.catch(() => null)` — дашборд не ломается если endpoint недоступен

---

### [D29] Обнаружен: Ghost balance в sandbox режиме (не закрыт, P2 #18)

**Проблема:** После завершения challenge (passed/failed) дашборд в sandbox режиме показывает `currentBalance` из последнего challenge вместо реального sandbox BalanceLog.

**Корень:** `GET /api/user/mode/route.ts` — запрос `lastLog` не имеет фильтра `challengeId`. `findFirst` с `orderBy: createdAt desc` возвращает лог от завершённого challenge (более свежий), а не sandbox.

**Простой fix (не реализован):**
```typescript
// mode/route.ts — добавить challengeId фильтр к lastLog
const lastLog = await prisma.balanceLog.findFirst({
  where: activeChallenge
    ? { userId, challengeId: activeChallenge.id }
    : { userId, challengeId: null },
  orderBy: { createdAt: "desc" },
});
```

**Статус:** Баг обнаружен, задокументирован как D29. Не блокирует демо (проявляется только после завершения challenge, а не во время активного). Закроется автоматически при внедрении [A1] wallet model.

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
