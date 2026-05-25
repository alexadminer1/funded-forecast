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
**API fields:** `currentDrawdownPercent` (current trailing drawdown), `maxLossLimitPercent` (limit), `peakBalance`, `realizedBalance` (для computation если нужно)
**Display:** `$120 buffer` (large), caption `"to MLL limit (X%)"` где X = `maxLossLimitPercent`
**Computation:** buffer = `(peakBalance - mllAmount) - realizedBalance` если ещё в plus, иначе показать "0" с red color
**Color zones:**
- buffer > 50% of mllAmount → green
- 50-20% → yellow
- <20% → red
- ≤0 → red, show "0" (failed)

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
**Color zones:** based on pace (assume linear: position N expected by day ceil(N * 10 / 35))
- on/ahead pace → green
- behind by 1-3 → yellow
- behind by 4+ → red

#### Widget 5 — Unique events
**API field:** `uniqueEventsCount` (if available — verify) or computed client-side from positions
**Target:** 30
**Display:** `8 / 30` (large), caption `"unique events"`
**Color zones:** same pace logic as resolved

**Architect verify:** is `uniqueEventsCount` уже в response? If not — either add to API (out of scope for Phase 5) or compute client-side from `/api/user/positions`.

#### Widget 6 — Consistency biggest day %
**API field:** `consistency` (доля 0-1, e.g., 0.18 = 18%)
**Display:** `18%` (large), caption `"biggest winning day (limit 25%)"`
**Color zones:**
- 0-15% → green
- 15-22% → yellow
- >22% → red
- Note: only relevant if user has profit; if total profit ≤ 0, show "—" or "n/a"

## Sandbox mode
В sandbox active challenge нет. Виджеты **не отображаются совсем** — на dashboard просто нет этого блока. Layout adapts gracefully (other dashboard content remains).

## Что входит

### File modifications
- `src/app/dashboard/page.tsx` — add widgets section
- Possibly new components in `src/components/widgets/` if extraction makes sense (Architect decides)
- Tailwind classes для color zones (если нужны custom)

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

- Changes to `/api/user/me` или other endpoints (API data already complete from Phase 3)
- Changes to TradeModal (preview rows уже сделаны в PHILO-1)
- Pricing/FAQ pages (Phase 6)
- Email notifications (Phase 7)
- Backend changes
- Schema changes
- Failed challenge modal/banner changes (orthogonal)
- Animations / micro-interactions (можно потом если хочется polish)

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