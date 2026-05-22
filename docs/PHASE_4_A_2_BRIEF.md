# PHASE_4_A_2_BRIEF.md — Position resolve hot-fix

## Status
READY TO START — 2026-05-18
Parent: PHASE_KIT.md v2
Predecessor: Phase 4.0 audit merged in develop
Source: docs/PHASE_4_0_AUDIT.md findings #1 + #2 (both CRITICAL)
Type: HOT-FIX

## Goal фазы

Закрыть 2 CRITICAL bugs из Phase 4.0 audit. Оба работают на dev/prod прямо сейчас и корраптят audit trail / balance chain.

**Это код-фаза.** Минимальные изменения в одном файле + 1 admin endpoint для read-only impact assessment. Никаких новых таблиц, никаких миграций, никаких изменений UI.

После Phase 4.A.2 — сразу Phase 4.B (max 1-2 дня gap). Orphan positions, которые создаст Option A в gap-окне, закроет Phase 4.B auto-close или admin manual close.

---

## Бизнес-контекст

Phase 4.0 audit findings:

- **#1 CRITICAL** (`marketResolve.ts:77-117`): когда `position.challengeId` указывает на Challenge со `status != "active"`, гейт на line 125 пропускает только balance update, но Trade + BalanceLog + Position.realizedPnl всё равно пишутся → ChallengeDailyPnL cron потом ретроактивно меняет историю finalized challenge.
- **#2 CRITICAL** (`marketResolve.ts:65-69`): runningBalance chain читается через `findFirst({ where: { userId }, orderBy: createdAt desc })` — без `challengeId` — sandbox/challenge balance chains cross-poллюциoнируют.

Решение продукт-овнера (из основного чата):
- Task 1: fix chain scope — добавить `challengeId` в lastLog where
- Task 2: Option A — skip resolve целиком для non-active challenge positions (gate ПЕРЕД Trade insert на line 77); position остаётся `status="open"` orphan
- Task 3: production impact assessment (read-only SQL) перед merge — оценить корраптнутые rows, решить нужна ли data correction migration

---

## Scope — три task'а

### Task 1 — Fix runningBalance chain scope

**File:** `src/lib/marketResolve.ts:65-69`

**Current code:**
```ts
const lastLog = await tx.balanceLog.findFirst({
  where: { userId: fresh.userId },
  orderBy: { createdAt: "desc" },
  select: { runningBalance: true },
});
```

**Required change:** добавить `challengeId: fresh.challengeId` в where. Prisma матчит `null` точно — это поведение нужно (sandbox positions имеют challengeId=null, для них lastLog должен быть из sandbox-chain).

**New code:**
```ts
const lastLog = await tx.balanceLog.findFirst({
  where: {
    userId: fresh.userId,
    challengeId: fresh.challengeId,
  },
  orderBy: { createdAt: "desc" },
  select: { runningBalance: true },
});
```

**Edge case:** если у пользователя НЕТ предыдущего BalanceLog с тем же `challengeId` (например первый resolve без trades), `lastLog` будет `null`. Текущий код line 70 уже обрабатывает этот случай (`lastLog?.runningBalance ?? 0`). Проверить что эта дефолтная ветка работает корректно для challenge-mode resolve без предшествующих trades — теоретически невозможно (Challenge всегда имеет `challenge_start` BalanceLog после activation), но verify.

### Task 2 — Option A gate for non-active challenge positions

**File:** `src/lib/marketResolve.ts`

**Current flow** (псевдокод):
```
for each position:
  $transaction:
    fresh = findUnique(position.id)
    if (fresh.resolvedAt !== null) skip
    payout = ...
    profit = ...
    lastLog = ...           ← Task 1 fix here
    Trade.create(...)        ← line 77, runs unconditionally
    BalanceLog.create(...)   ← line 94
    Position.update(resolved, realizedPnl, ...)   ← line 108
    if (fresh.challengeId) {
      challenge = findUnique(...)
      if (challenge.status === "active") {        ← line 125, ONLY balance update gated
        Challenge.update(realizedBalance, ...)
        drawdown check / checkAndMarkPassed
      }
    }
```

**Required change:** добавить early-return gate **ПЕРЕД Trade.create**:

```
for each position:
  $transaction:
    fresh = findUnique(position.id)
    if (fresh.resolvedAt !== null) skip

    // Option A gate: skip resolve entirely for non-active challenge positions
    if (fresh.challengeId !== null) {
      const sourceChallenge = await tx.challenge.findUnique({
        where: { id: fresh.challengeId },
        select: { status: true },
      });
      if (sourceChallenge && sourceChallenge.status !== "active") {
        // Skip: position остаётся status="open" orphan.
        // Phase 4.B auto-close-at-finalize или admin manual close разрешит.
        console.log(`[marketResolve] Skipping position ${fresh.id}: challenge ${fresh.challengeId} status=${sourceChallenge.status}`);
        return;
      }
    }
    // Sandbox positions (challengeId=null) — proceed normally.

    payout = ...
    ... rest of flow unchanged
```

**Важно:** существующий гейт на line 125 (`if (challenge && challenge.status === "active")`) **остаётся** — он защищает balance update от race condition (challenge мог перейти из active в failed между новой проверкой и balance update внутри той же tx). Double-check, не лишний.

**Sandbox case:** `fresh.challengeId === null` — early-return НЕ срабатывает, resolve идёт нормально. Это правильное поведение для sandbox positions.

**Edge case race:** если challenge перейдёт из failed обратно в active между запусками cron — теоретически возможно? Нет: `Challenge.status` mutations все ведут только в терминальные статусы (failed/passed/expired/frozen). Нет обратного перехода. Безопасно.

### Task 3 — Production impact assessment

Перед merge Phase 4.A.2 — оценить сколько rows уже коррапнуто bugs #1 и #2 за последние 30 дней.

**Где:** новый admin endpoint `POST /api/admin/audit/resolve-corruption` (read-only). Защищён `x-admin-key` как остальные admin endpoints.

**File:** `src/app/api/admin/audit/resolve-corruption/route.ts` (новый файл).

**Логика endpoint'а — 3 read-only queries:**

#### Query 1 — Chain leak detection (finding #2)
Найти BalanceLog rows где предыдущий BalanceLog того же user'а (по createdAt desc) имеет другой `challengeId` И эта запись была создана через resolve.

```sql
SELECT
  bl.id,
  bl."userId",
  bl."challengeId",
  bl."type",
  bl."createdAt",
  bl."runningBalance",
  prev."challengeId" as "prevChallengeId",
  prev."runningBalance" as "prevRunningBalance"
FROM "BalanceLog" bl
LEFT JOIN LATERAL (
  SELECT "challengeId", "runningBalance"
  FROM "BalanceLog"
  WHERE "userId" = bl."userId"
    AND "createdAt" < bl."createdAt"
  ORDER BY "createdAt" DESC
  LIMIT 1
) prev ON true
WHERE bl."type" = 'market_resolve'
  AND bl."createdAt" > NOW() - INTERVAL '30 days'
  AND prev."challengeId" IS DISTINCT FROM bl."challengeId"
ORDER BY bl."createdAt" DESC;
```

Каждый row — потенциально некорректный `balanceBefore` / `runningBalance` в resolve.

#### Query 2 — Audit trail corruption (finding #1)
Найти Trade rows со `action='resolve'` где challenge на момент resolve был НЕ active.

```sql
SELECT
  t.id,
  t."userId",
  t."challengeId",
  t."realizedPnl",
  t."createdAt",
  c."status" as "challengeStatusNow",
  c."endedAt" as "challengeEndedAt"
FROM "Trade" t
JOIN "Challenge" c ON c.id = t."challengeId"
WHERE t."action" = 'resolve'
  AND t."createdAt" > NOW() - INTERVAL '30 days'
  AND c."status" != 'active'
  AND (c."endedAt" IS NULL OR c."endedAt" < t."createdAt")
ORDER BY t."createdAt" DESC;
```

Фильтр `c.endedAt < t.createdAt` ловит случаи где challenge был ended ДО resolve trade. Если `endedAt` null но `status != "active"` — данные подозрительные, тоже включаем.

#### Query 3 — Aggregate metrics
Из результатов Query 1 + 2:
- Total affected BalanceLog rows
- Total affected Trade rows
- Cumulative `|realizedPnl|` (абсолютная сумма) — proxy для финансового impact
- Unique affected userIds
- Unique affected challengeIds

#### Endpoint response shape

```json
{
  "success": true,
  "environment": "dev" | "prod",
  "windowDays": 30,
  "checkedAt": "ISO timestamp",
  "chainLeak": {
    "totalRows": N,
    "uniqueUsers": M,
    "sampleRows": [first 10 from Query 1]
  },
  "auditCorruption": {
    "totalRows": N,
    "uniqueUsers": M,
    "uniqueChallenges": K,
    "cumulativeAbsRealizedPnl": "12.34",
    "sampleRows": [first 10 from Query 2]
  },
  "escalationTrigger": {
    "thresholds": { "cumulativeUsdAbove": 100, "affectedUsersAbove": 50 },
    "exceeded": boolean,
    "reason": "string explaining which threshold hit or 'none'"
  }
}
```

**Запустить против:**
- Dev DB (через локальный/staging endpoint)
- Prod DB (через prod admin endpoint)

**Action на основе результатов:**
- Если `escalationTrigger.exceeded === false` (impact < $100 cumulative AND < 50 users) → merge Phase 4.A.2 без data correction
- Если `exceeded === true` → STOP merge, escalate в основной чат Алексея, обсудить data correction migration отдельной задачей

---

## Что НЕ входит в Phase 4.A.2

- Data correction migration (если impact низкий — не делаем; если высокий — отдельная задача)
- Auto-close orphan positions (это Phase 4.B)
- Любые изменения buy/sell endpoints (это Phase 4.B)
- Cron lifecycle fixes (это Phase 4.B)
- Status transition tx wrapping (это Phase 4.B)
- Любые findings #3-#13 из audit (Phase 4.B или TECH-DEBT)

---

## Tests required

### Test 1 — Chain scope fix (Task 1)
**File:** `src/lib/__tests__/marketResolve.chainScope.test.ts` (новый)

Сценарий:
1. Создать user с sandbox BalanceLog row `runningBalance=100, challengeId=null`
2. Создать active challenge с BalanceLog seed `runningBalance=10000, challengeId=X`
3. Создать challenge position на market M
4. Вызвать `resolveMarketPositions(M, winningOutcome, ...)`
5. Assert: новый BalanceLog row после resolve имеет `balanceBefore = 10000` (из challenge chain), НЕ `100` (sandbox)
6. Cross-test: тот же сценарий с sandbox position (challengeId=null) — `balanceBefore` берётся из sandbox chain

### Test 2 — Option A gate (Task 2)
**File:** `src/lib/__tests__/marketResolve.endedChallengeGate.test.ts` (новый)

Сценарии:
1. **Ended challenge → skip:** создать challenge status="failed", открытую position на нём, market resolves. Assert: position остаётся status="open", НЕТ нового Trade, НЕТ нового BalanceLog, challenge.realizedBalance не изменился.
2. **Active challenge → proceed:** challenge status="active", position resolves нормально. Все writes происходят как раньше.
3. **Sandbox → proceed:** position.challengeId=null, resolves нормально, BalanceLog/Trade/Position обновляются.
4. **Race scenario:** challenge переходит из active в failed между Task 2 check и line 125 check — текущий гейт на line 125 защищает balance update. Trade/BalanceLog уже не успеют создаться благодаря Task 2 early-return.

### Test 3 — Impact assessment endpoint
**File:** `src/app/api/admin/audit/__tests__/resolve-corruption.test.ts` (новый)

- Auth check (x-admin-key required)
- Returns proper shape
- Query 1 finds known seeded chain-leak row
- Query 2 finds known seeded audit-corruption row
- escalationTrigger correctly computed

---

## Step-by-step план

### Шаг 1 — Feature branch
```bash
cd ~/funded-app
git checkout develop && git pull origin develop
git checkout -b feature/p0-3-d-resolve-hotfix
```

### Шаг 2 — Task 1 (chain scope fix)
- Открыть `src/lib/marketResolve.ts`
- Apply change на lines 65-69
- Запустить test 1 → должен пройти

### Шаг 3 — Task 2 (Option A gate)
- В том же `src/lib/marketResolve.ts` добавить early-return gate перед line 77
- Запустить test 2 → должен пройти

После Шага 2-3 commit:
```bash
git add src/lib/marketResolve.ts src/lib/__tests__/marketResolve.*.test.ts
git commit -m "[P0.3.D] Fix marketResolve chain scope + ended-challenge gate"
git push origin feature/p0-3-d-resolve-hotfix
```

Verify Vercel build passes.

### Шаг 4 — Task 3 (impact assessment endpoint)
- Создать `src/app/api/admin/audit/resolve-corruption/route.ts`
- Реализовать 3 queries через `prisma.$queryRaw`
- Реализовать response shape
- Тесты
- Локальный smoke test: запустить против dev DB

Commit:
```bash
git add src/app/api/admin/audit/resolve-corruption/
git commit -m "[P0.3.D] Add resolve-corruption impact assessment endpoint"
git push origin feature/p0-3-d-resolve-hotfix
```

### Шаг 5 — Production impact assessment
- Задеплоить feature branch на dev environment (Coolify/Vercel preview)
- Curl против dev DB endpoint, получить metrics
- Curl против prod DB endpoint (через prod admin key), получить metrics
- Сохранить оба JSON response в `/tmp/phase-4-a-2-impact-dev.json` и `/tmp/phase-4-a-2-impact-prod.json`

### Шаг 6 — Decision gate
**STOP — escalate в основной чат с результатами:**
- Dev metrics
- Prod metrics
- `escalationTrigger.exceeded` value

Алексей решает: merge без data correction OR пауза для миграции.

### Шаг 7 (only if merge approved) — PR + merge
```
PR develop ← feature/p0-3-d-resolve-hotfix
```

В описании PR:
- Link на docs/PHASE_4_0_AUDIT.md findings #1, #2
- Impact assessment results (JSON)
- Acceptance criteria checklist (из audit отчёта)

После merge — выдать Phase 4.B brief.

---

## Контрольные точки

### После Шага 3
- `marketResolve.ts` имеет ровно 2 изменения: chain scope + Option A gate
- Все existing tests проходят
- 2 новых теста проходят
- Vercel build green

### После Шага 4
- Impact assessment endpoint работает локально против dev DB
- Тесты endpoint'а проходят

### После Шага 5
- Получены metrics из dev И prod
- JSON files сохранены для permanent record

### После Шага 6
- Решение принято Алексеем — merge или escalate
- Если escalate — Phase 4.A.2 не merge'ится, открывается отдельная задача data correction

### После Шага 7
- PR merged
- Phase 4.B brief формируется и стартует

---

## Acceptance criteria

Из audit отчёта (Phase 4.0):

1. **Task 1:** новые BalanceLog rows во время resolve имеют `runningBalance` derived from same-`(userId, challengeId)` predecessor only. Verified test 1.

2. **Task 2 (Option A):** для positions whose `challengeId` references non-active challenge — НЕТ Trade insert, НЕТ BalanceLog insert, НЕТ Position state change. Position остаётся `status="open"`. Verified test 2.

3. **Task 3:** impact assessment endpoint работает, возвращает proper shape, escalation thresholds правильно применены.

4. **ChallengeDailyPnL cron output** для finalized challenges остаётся стабильным после subsequent market resolutions. Verified test 2 + manual check after deploy.

---

## Risks

1. **Orphan positions window:** между Phase 4.A.2 deploy и Phase 4.B deploy — positions от ended challenges остаются `status="open"`. UI их не показывает (finding #5 в audit). Sell их не закроет (finding #3). Если market этих positions резолвится в этот window — они skip'аются (новый Option A gate), остаются orphan. Mitigation: Phase 4.B стартует в течение 1-2 дней; admin manual close через `admin/expire-challenges/route.ts` доступен сейчас если нужно срочно.

2. **Impact assessment может занять > 30 секунд** на prod (если 30 дней данных много) — добавить timeout 60s на route, или paginate. Skip pagination на текущем размере userbase.

3. **Concurrent resolves** — `prisma.$transaction` уже изолирует per-position resolve. Новый gate тоже внутри tx → consistent view of `challenge.status` в момент check. Safe.

---

## Следующая фаза

Phase 4.B — End-of-challenge finalize + position isolation guards.

Brief формируется после merge Phase 4.A.2. Scope из Phase 4.0 audit раздел "Phase 4.B Must":
- Cron `end-of-challenge-finalize` (правила #9-12)
- Auto-close-at-finalize pattern применить к 8+ сайтам
- Explicit sell guard (3 условия)
- Wrap status transitions в $transaction

Pre-Phase-4.B mitigation для orphan positions:
- SQL query найти все `Position WHERE status='open' AND challengeId IN (SELECT id FROM Challenge WHERE status != 'active')`
- Если их немного — admin manual close через `/api/admin/expire-challenges` или ad-hoc skript
- Если много — Phase 4.B auto-close обработает в одном проходе по challenge ids
