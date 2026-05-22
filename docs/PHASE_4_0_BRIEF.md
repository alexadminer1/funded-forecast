```markdown
# PHASE_4_0_BRIEF.md — Position isolation audit (READ-ONLY)

## Status
READY TO START — 2026-05-17
Parent: PHASE_KIT.md v2
Predecessors: Phase 4.A merged (develop @ 4b472cb)
Source of truth: BUSINESS_RULES.md + this brief

## Goal фазы
Прокопать кодобазу на предмет того, как сейчас работает изоляция позиций между разными контекстами (challenge active vs ended, sandbox vs challenge). Найти все места где `position.challengeId` учитывается / игнорируется, где PnL может уйти "не в тот кошелёк", и где sell может пройти на позиции из закрытого challenge.

**ЭТО READ-ONLY ФАЗА.** Никакого кода, никаких миграций, никаких коммитов кода. Только discovery отчёт.

После Phase 4.0 — на основе отчёта формируется PHASE_4_B_BRIEF.md с правильной картой изменений (position isolation guards + end-of-challenge finalize).

---

## Бизнес-инвариант (источник истины)

**От Алексея, основной чат:**

> Open positions from an ended challenge must be read-only.
> - НЕ могут быть проданы после challenge ended
> - НЕ влияют на sandbox balance или новый challenge balance
> - Market resolve может разрешать их исторически, но PnL остаётся привязан к старому challenge
>
> Sell endpoint должен разрешать sell ТОЛЬКО если:
> - `position.challengeId == activeChallenge.id`
> - `activeChallenge.status === "active"`
> - `activeChallenge.expiresAt > now`
>
> Если юзер начал новый challenge — старые challenge positions остаются только в истории. Sell старых позиций — reject.
> Market resolve старых позиций — PnL пишется в **старый** Challenge, не в new active или sandbox.

---

## Discovery scope

### Block A — Trade flow (buy + sell)

#### A1. Sell endpoint position selection

Прочитать `src/app/api/trade/sell/route.ts` целиком. Зафиксировать:

- Как находится Position для sell — по `userId + marketId + side` или с фильтром по challengeId?
- Если без фильтра по challengeId — это потенциальный bug: юзер может продать позицию из старого challenge через новый flow
- Проверяется ли `challenge.status === "active"` перед sell?
- Проверяется ли `challenge.expiresAt > now` перед sell?
- Куда пишется PnL от sell — в `user.sandboxBalance` или `challenge.realizedBalance`? По какому критерию выбирается target?

#### A2. Buy endpoint isolation

Прочитать `src/app/api/trade/buy/route.ts` целиком. Зафиксировать:

- При buy в challenge mode — заполняется ли `Position.challengeId`?
- При buy в sandbox mode — Position.challengeId = null?
- Может ли юзер случайно купить в challenge mode когда challenge expired (status=active но now > expiresAt)?
  - Текущее: Phase 2.B добавил MarketEndedError но не ChallengeExpiredError
- Проверка `activeChallenge.expiresAt` в buy сейчас отсутствует — подтвердить

### Block B — Position resolve (market settlement)

#### B1. Position resolve mechanism

Найти все места где Position.status переводится в "resolved":

```
rg -n "status.*resolved\|status: ['\"]resolved['\"]\|status='resolved'" src --type ts
rg -n "Position.*status.*update" src --type ts
```

Зафиксировать:
- Cron name (вероятно market sync cron или отдельный resolve cron)
- Куда пишется PnL при resolve — в balance какого Challenge? По какому критерию (position.challengeId или user.activeChallenge)?
- Что происходит если `position.challengeId` ссылается на Challenge со status="failed" / "passed" / "expired"?

#### B2. Market resolve cron flow

Прочитать соответствующий cron route (вероятно `/api/cron/sync-markets` или похожий).

Зафиксировать:
- Полный flow от "market resolved on Polymarket" до "user balance updated"
- Цепочка: market.status → position.status → balance update
- Источник target balance: `position.challengeId` lookup или `user.activeChallenge`?

### Block C — Balance writes

#### C1. Все места где обновляется challenge.realizedBalance / peakBalance

```
rg -n "realizedBalance\s*[:=]\|peakBalance\s*[:=]" src --type ts
```

Для каждого hit — зафиксировать:
- Файл + строка
- Триггер (buy success, sell success, position resolve, manual update?)
- Критерий выбора target Challenge (position.challengeId vs user.activeChallenge)
- Может ли write попасть в "не тот" Challenge?

#### C2. Все места где обновляется user.sandboxBalance

```
rg -n "sandboxBalance\s*[:=]\|sandboxBalance.*update" src --type ts
```

Зафиксировать:
- Триггеры
- Условие "sandbox vs challenge" (по чему различается)
- Может ли challenge trade случайно обновить sandboxBalance? Или sandbox trade — challenge.realizedBalance?

#### C3. BalanceLog entries

`BalanceLog` model имеет `challengeId` поле. Проверить:
- Все BalanceLog.create — пишется ли challengeId корректно?
- Sandbox trades — challengeId = null?
- Resolve old position — challengeId = position.challengeId (не active)?

### Block D — UI/API queries для positions

#### D1. /api/user/positions (используется TradeModal и Dashboard)

Прочитать `src/app/api/user/positions/route.ts`. Зафиксировать:
- Какие positions возвращаются — все user'а или только active challenge's?
- Если все — отделяются ли historical vs current?

#### D2. Dashboard и UI компоненты с positions

```
rg -n "userPositions\|.positions\." src/app src/components --type ts --type tsx | head -30
```

Зафиксировать:
- Где UI показывает positions
- Есть ли разделение "current challenge positions" vs "past positions" в UI

### Block E — Challenge lifecycle transitions

#### E1. Status mutations

Найти все места где `Challenge.status` меняется:

```
rg -n "status.*active\|status: ['\"](passed|failed|expired)['\"]" src --type ts
```

Зафиксировать:
- Все мутаторы status (cron'ы + endpoints)
- При status transition active → failed/passed/expired — что происходит с открытыми позициями этого challenge?
  - Phase 4.A end-of-day-check — НЕ трогает positions
  - expire-challenges — проверить, трогает или нет
  - Phase 4.B finalize — будет проектироваться на основе этого отчёта

#### E2. New challenge activation (после passed/failed)

Найти flow покупки нового challenge:
- При activation — что происходит со старыми positions старого challenge?
- Они остаются `status="open", challengeId=<old_id>`?
- UI продолжает их показывать?

### Block F — Affiliate / payment (light touch)

#### F1. Не углубляться, но проверить:
- Affiliate commission triggers — зависят от challenge balance? Если да, какого Challenge — текущего active или того что был при покупке?
- Payout flow — читает balance какого Challenge?

Только зафиксировать существование зависимостей. Audit affiliate logic в Phase 4.0 НЕ входит — это TASK-FINAL-1.

---

## Что НЕ входит в Phase 4.0

- Никакого кода
- Никаких миграций
- Никаких изменений docs (только финальный отчёт)
- Никаких коммитов кода
- Anti-cheat audit (#12) — отдельная задача
- Affiliate audit — TASK-FINAL-1, не сейчас
- Sandbox-mode фиксы balance изоляции — могут вылезти в audit, но **не правим в Phase 4.0**, только документируем

---

## Discovery output формат

Архитектор делает **один markdown файл-отчёт** под названием `docs/PHASE_4_0_AUDIT.md`. Структура:

```markdown
# Phase 4.0 Audit — Position isolation

## Date
2026-05-17

## Executive summary
[5-10 строк: главные находки. Сколько мест где изоляция сломана. Risk level. Что точно надо чинить в Phase 4.B vs можно отложить.]

## Block A — Trade flow
### A1. Sell endpoint
[Findings + line numbers]
### A2. Buy endpoint
[Findings + line numbers]

## Block B — Position resolve
### B1. Position resolve mechanism
[Findings]
### B2. Market resolve cron
[Findings]

## Block C — Balance writes
### C1. Challenge balance writes
[Table: file:line | trigger | target selection | risk]
### C2. Sandbox balance writes
[Table]
### C3. BalanceLog entries
[Findings]

## Block D — UI/API positions
### D1. /api/user/positions
### D2. UI components

## Block E — Challenge lifecycle
### E1. Status mutations
### E2. New challenge activation

## Block F — Affiliate / payment (light)

## Identified bugs/risks
[Numbered list. Severity: CRITICAL / HIGH / MEDIUM / LOW. Каждый — file:line, что не так, что должно быть.]

## Phase 4.B scope recommendation
[На основе audit — какие изменения нужны в Phase 4.B чтобы соблюсти invariant из бизнес-уточнения]

## Pre-Phase-4.B blockers
[Что критично починить ДО Phase 4.B vs что можно делать в рамках 4.B vs что отложить как TECH-DEBT]
```

Этот отчёт коммитится одним commit'ом в feature-ветке `feature/p0-3-c-position-audit`.

---

## Пошаговый план

### Шаг A — Feature-ветка
```bash
cd ~/funded-app
git checkout develop
git pull origin develop
git checkout -b feature/p0-3-c-position-audit
```

### Шаг B — Discovery (Claude Code или Архитектор сам)
Прокопать blocks A-F. Все findings — в memory или в /tmp/phase-4-0-notes.md.

Не торопиться. Если block раскрыл что-то неожиданное (например ещё одно место где position resolve пишет в неправильный balance) — углубиться, не пропускать.

### Шаг C — Написать docs/PHASE_4_0_AUDIT.md
Полный отчёт по формату выше.

### Шаг D — Commit + push + PR (документ-only)
```bash
git add docs/PHASE_4_0_AUDIT.md
git commit -m "[P0.3.C] Phase 4.0 — position isolation audit (READ-ONLY)"
git push origin feature/p0-3-c-position-audit
```

PR develop ← feature/p0-3-c-position-audit.

Алексей merge'ит, audit становится permanent record.

### Шаг E — Возврат в основной чат
С отчётом:
- Critical findings (всё что severity CRITICAL/HIGH)
- Phase 4.B scope recommendation summary
- Hash audit commit'а

---

## Контрольные точки

### После Block A (trade flow)
- Sell endpoint полностью прочитан, цепочка sell → balance update зафиксирована
- Buy endpoint полностью прочитан, isolation проверена

### После Block B (resolve)
- Cron resolve mechanism найден и описан
- PnL routing от resolve до balance — explicit

### После Block C (balance writes)
- Полная таблица всех мест где challenge/sandbox balance меняется
- Каждое — с оценкой "isolation works / partially / broken"

### После Block D + E + F
- UI behavior с positions описан
- Lifecycle transitions покрыты
- Affiliate dependency зафиксирована (без аудита самого affiliate)

### После Шага C
- docs/PHASE_4_0_AUDIT.md полный
- Executive summary честный (не приукрашен)
- Phase 4.B scope recommendation готов

---

## Closing checklist

Перед закрытием — Алексей читает Executive summary + Critical findings. Если всё ясно — merge. Если непонятно — задаёт уточняющие вопросы Архитектору.

После merge — Phase 4.B brief формируется на основе audit.

---

## Следующая фаза

Phase 4.B — End-of-challenge finalize + position isolation guards.

Scope формируется после Phase 4.0. Ориентировочный объём:
- Cron `end-of-challenge-finalize` (правила #9, #10, #11, #12)
- Sell guard: position.challengeId == activeChallenge.id + status + expiresAt
- Buy guard: ChallengeExpiredError если now > expiresAt
- Resolve fix: PnL пишется в `position.challengeId`'s balance, не в active

Точный список — после audit.
```

