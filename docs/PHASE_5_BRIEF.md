# PHASE_5_BRIEF.md — Dashboard widgets for challenge data

## Status
READY TO START — 2026-05-25
Parent: PHASE_KIT.md v3 (single-branch workflow — direct commits to develop)
Predecessors: PHILO-1 + TECH-DEBT-14/15 fully merged (develop @ 0ff07eb)
Source of truth: docs/BUSINESS_RULES.md (Product philosophy + all rules)

## Goal фазы
Реализовать 6 dashboard widgets, которые показывают юзеру state его active challenge. Data уже доступна через `/api/user/me` (Phase 3 extension). Виджеты — pure frontend работа.

Этот этап завершает path "юзер видит что происходит с его challenge". До Phase 5 юзер видел только raw numbers; после — целостная картина с visual cues.

## Product philosophy alignment

Per BUSINESS_RULES.md Product philosophy:
- **UI shows data, does not control behavior** — widgets отображают metric, **не блокируют actions**
- Цветовые индикаторы (зелёный/жёлтый/красный) **допустимы** — это часть данных
- НЕ добавлять text warnings ("you are about to fail!") или predictive coaching
- НЕ disabling кнопок Buy/Sell на основе widget state

Widget может показать "DLL: 85% (yellow zone)" — но Buy button продолжает работать. Юзер решает сам.

## 6 widgets — спецификация

### Layout
**Top row (3 widgets, large):**
1. Daily P&L (drawdown сегодня)
2. MLL buffer (equity vs lifetime drawdown limit)
3. Days remaining (challenge progress)

**Bottom row (3 widgets, smaller):**
4. Resolved positions (counter to 35)
5. Unique events (counter to 30)
6. Consistency biggest day %

### Visual style
- **Минималистичный**: большие числа, минимум графики
- Цвет числа меняется по zone (green/yellow/red)
- Под числом — small caption поясняющий contextually ("% used", "$ left", "days", etc.)
- Без circular gauges, без animated transitions
- Reference: Robinhood-style clean numbers
- Использовать существующий Tailwind стек (никаких новых UI библиотек)

### Widget specs

#### Widget 1 — Daily P&L
**API field:** `dailyDrawdownPercent` (from `/api/user/me.activeChallenge`)
**Display:** `5.2%` (large), caption `"Daily DD (limit 5%)"`
**Color zones:**
- 0-60% of DLL limit → green
- 60-90% → yellow
- ≥90% → red

For Starter $1000 (DLL=5%): green up to 3.0%, yellow 3.0-4.5%, red 4.5%+

#### Widget 2 — MLL buffer
**API field:** `mllBufferAmount` (computed server-side, see MLL formula reference section)
**Display:** `$120` (large), caption `"buffer to MLL"`
**Color zones (buffer ratio to maxLossAmount):**
- buffer / maxLossAmount > 0.5 → green
- 0.2-0.5 → yellow
- <0.2 → red
- 0 → red, show "$0" (failed or about to)

For Starter $1000 (MLL 10%, maxLossAmount=$100):
- buffer > $50 → green
- $20-$50 → yellow
- <$20 → red

#### Widget 3 — Days remaining
**API field:** `daysRemaining`
**Display:** `5` (large), caption `"days left of 10"`
**Color zones:**
- 4+ days left → green
- 2-3 → yellow
- 0-1 → red

#### Widget 4 — Resolved positions
**API field:** `resolvedPositionsCount`
**Target:** 35 (constant, hard-coded reference)
**Display:** `12 / 35` (large), caption `"resolved positions"`
**Color zones (fixed thresholds, target 35):**
- 0-10 resolved → red
- 11-24 → yellow
- 25+ → green

#### Widget 5 — Unique events
**API field:** `uniqueEventsCount` (Phase 5 helper extension, strict distinct on polymarketEventId, null excluded)
**Target:** 30
**Display:** `8 / 30` (large), caption `"unique events"`
**Color zones (fixed thresholds, target 30):**
- 0-9 unique → red
- 10-20 → yellow
- 21+ → green

#### Widget 6 — Consistency biggest day %
**API field:** `consistency` (доля 0-1, e.g., 0.18 = 18%)
**API field:** `startBalance`, `realizedBalance` (for "no profit" detection)
**Display:** if `realizedBalance <= startBalance` → "—", caption "no profit yet". Otherwise: `(consistency × 100).toFixed(0) + "%"` (large), caption `"biggest winning day (limit 25%)"`
**Color zones (only when profit > 0):**
- 0-15% → green
- 15-22% → yellow
- >22% → red

## Sandbox mode
В sandbox active challenge нет. Виджеты **не отображаются совсем** — на dashboard просто нет этого блока. Layout adapts gracefully (other dashboard content remains).

## Что входит

### File modifications
- `src/lib/user/active-challenge.ts` — extend ActiveChallenge interface with 5 new fields:
  - `startBalance: number`
  - `mllAmount: number` (= startBalance × maxLossLimitPercent / 100)
  - `mllBufferAmount: number` (= max(0, realizedBalance - (peakBalance - mllAmount)))
  - `resolvedPositionsCount: number` (Prisma count where status="resolved")
  - `uniqueEventsCount: number` (distinct polymarketEventId via JS Set, "resolved" status, strict — null eventIds excluded)
- `src/app/api/user/me/route.ts` — forward new helper fields in response composition (currentBalance, profitTarget, profitPercent, mllAmount, mllBufferAmount, resolvedPositionsCount, uniqueEventsCount). Cherry-pick block needs ~7 new field additions; existing Phase-3 overlay pattern is followed.
- `src/lib/types.ts` — extend User.activeChallenge shape to match the expanded ActiveChallenge. New fields added as REQUIRED. Existing Phase-3 overlay fields may remain optional for backward compat with cached responses.
- `src/app/dashboard/page.tsx` — REMOVE ChallengeCard function entirely, replace with `<ChallengeWidgets challenge={user.activeChallenge} />`. Switch from modeData.challenge to user.activeChallenge as data source. Top stats row, PastChallengesSection, SandboxSecondaryCard, SandboxBanner, PostChallengeBanner remain unchanged.
- `src/components/widgets/MetricWidget.tsx` (new) — generic compact metric tile (large value + caption + colorZone prop)
- `src/components/widgets/ChallengeWidgets.tsx` (new) — grid 3+3 layout, accepts ActiveChallenge, renders 6 MetricWidget instances. Use defensive `?? 0` defaults for numerics (protects against stale cached responses).

### Color tokens
Использовать существующие Tailwind colors:
- green: `text-green-500` / `text-green-600`
- yellow: `text-yellow-500` / `text-yellow-600`
- red: `text-red-500` / `text-red-600`

Если нужны custom shades — добавить в `tailwind.config.ts`.

### Responsive
Top row: на mobile — vertical stack. На desktop — horizontal 3 columns.
Bottom row: same.

## Что НЕ входит

- ChallengeCard component is REMOVED entirely (not modified — replaced by ChallengeWidgets layout)
- Schema changes (Position/Market models unchanged)
- API endpoint changes for `/api/user/mode` (only `/api/user/me` touched — cherry-pick block extended to forward new helper fields)
- New API endpoints
- Changes to TradeModal (preview rows уже сделаны в PHILO-1)
- Pricing/FAQ pages (Phase 6)
- Email notifications (Phase 7)
- Backend changes
- Schema changes
- Failed challenge modal/banner changes (orthogonal)
- Animations / micro-interactions (можно потом если хочется polish)

## MLL formula reference

Verified in Phase 5 discovery against engine code (src/app/api/trade/buy/route.ts, sell/route.ts, src/lib/marketResolve.ts):

```
maxLossAmount = startBalance × maxTotalDdPct / 100  (initial-based dollars)
mllFailPoint  = newPeakBalance - maxLossAmount      (trailing point)
fail when:    realizedBalance < mllFailPoint
```

This is a HYBRID formula — fixed-dollar drawdown anchored to startBalance, applied as trailing offset from peakBalance. Not pure peak-based as the comment in active-challenge.ts (line ~32-34) suggests; that comment update is tracked separately as TASK-DOC-2.

The widget 2 server-side computation uses this verified formula.

### Discovery note — Phase 3 cherry-pick gap

Phase 3 extended buildActiveChallenge helper to compute the full ActiveChallenge type, but /api/user/me/route.ts cherry-picks only a subset of fields into the client response. Phase 5 closes that gap by extending both the route's forward list and the User.activeChallenge type in src/lib/types.ts. This is not a retroactive fix to Phase 3 — it's Phase 5 making the full helper contract reach the client where widgets need it.

## Workflow (PHASE_KIT v3)

**Single-branch:** прямо в develop. No feature branches.

### Discovery
1. Architect reads `/dashboard/page.tsx` целиком — текущая структура
2. Architect reads `/api/user/me` response (или Phase 3 brief docs) — какие поля есть
3. Architect verifies `uniqueEventsCount` availability в API
4. Architect plans component structure

### Implementation
1. Architect выдаёт Claude Code task — один comprehensive block с all 6 widgets
2. Claude Code:
   - Делает изменения в /dashboard/page.tsx
   - Возможно создаёт components/widgets/ subfolder
   - Применяет Tailwind classes для colors
   - tsc + build clean
   - Commits **напрямую в develop**
   - Push

### Smoke test (Алексей)
After Coolify auto-deploy на dev:
1. Открыть dev.tradepredictions.online
2. Login as alexadminer (has active challenge)
3. Verify все 6 widgets отображаются
4. Verify colors соответствуют zones (artificially fail something to test red? — optional, можно skip)
5. Sandbox mode: создать new account or use without active challenge → widgets не показываются
6. Mobile responsive check (через browser dev tools)

### Closing
- SESSION_LOG entry
- BACKLOG: mark Phase 5 closed if was tracked
- Decision: prod release Phase 5 сейчас или batch с Phase 6+7?

## Estimated effort
- Architect discovery: 30 min
- Claude Code implementation: 1-2 hours
- Smoke test: 30 min
- Total: ~3 hours

## Decision pending (after smoke)
After Phase 5 merge — Алексей решает:
- **A** — Phase 6 (Pricing/FAQ) сразу
- **B** — Phase 7 (Emails) сразу
- **C** — Mid-prod release (Phase 5 на prod) перед Phase 6/7
- **D** — Отдых

## Out of scope explicit list
- Failed challenge state UI (orthogonal phase if needed)
- Past challenges history page (Phase 5.x extension if requested)
- Admin dashboard widgets (separate scope)
- Affiliate dashboard changes
- Anti-cheat detection UI