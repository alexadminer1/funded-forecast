# PHASE_DLL_INVESTIGATION_BRIEF.md — TECH-DEBT-14 DLL anomaly investigation

## Status
READY TO START — 2026-05-25
Parent: PHASE_KIT.md v2
Predecessors: PHILO-1 merged (develop @ f3e0574)
Source of truth: TECH-DEBT-14 в BACKLOG (полное описание + reconstruction)

## Goal фазы
Найти root cause расхождения DLL violation reason с фактическим P&L. Решить: bug, intentional design, или edge case. Предложить fix (если bug) или documentation update (если design).

**Это READ-ONLY investigation фаза.** Никакого кода, никаких миграций. Только discovery отчёт + recommendation.

После phase — отдельный brief для fix implementation (если bug), либо docs update (если design).

## Concrete reproduction case

Из PHILO-1 smoke test:
- Challenge: test8 Starter $1000 (DLL limit $50 = 5%)
- Executed trades: 3 buys + 1 sell, final P&L −$0.36 (−0.04%)
- Rejected trade attempted: $49.47 cost
- DLL violation reason: "Daily drawdown 5.83% exceeded limit 5%"
- Sum of all buy costs (включая rejected): $2.09 + $6.75 + $49.47 = $58.31 = 5.83% от $1000

Точное совпадение 5.83% = gross cumulative buy cost / startBalance подтверждает гипотезу что DLL считает по этой формуле.

## Scope discovery

### Block A — Найти DLL calculation код
- `rg "DrawdownViolatedError" src/` — все throw sites
- `rg "Daily drawdown" src/` — error messages
- `rg "maxDailyDdPct" src/` — все consumers поля
- `rg "dayStartBalance" src/` — comparison reference (lazy reset value)
- `rg "5.83\|dailyDD\|dailyDrawdownPercent" src/` — где percent вычисляется

### Block B — Понять текущую формулу
Прочитать целиком файлы где DLL trigger:
- `src/app/api/trade/buy/route.ts` (catch handler DrawdownViolatedError)
- `src/app/api/trade/sell/route.ts` (same)
- `src/lib/marketResolve.ts` (resolve-time DLL check)
- `src/lib/challengeStatus.ts` (если есть DLL helpers)

Зафиксировать:
- Точную формулу вычисления `currentDrawdownPercent`
- Что является "baseline" (startBalance, dayStartBalance, realizedBalance, peakBalance?)
- Что является "currentValue" (gross buy cost, net P&L, equity, balance?)
- Включается ли hypothetical new trade в расчёт ПЕРЕД commit транзакции

### Block C — Сравнить с user-facing P&L
- `rg "Final P&L\|profitPercent\|currentProfit" src/` — где показывается user
- В `src/lib/user/active-challenge.ts` — формула `currentDrawdownPercent` для UI
- Сравнить: что UI показывает vs что DLL check сравнивает с limit

### Block D — Verify reproduction case
- Reconstruct из кода: при тех же trades что в smoke test (3 buys $2.09+$6.75 cost, sell +$8.48, attempted $49.47) — какое число должен дать DLL check?
- Подтвердить (или опровергнуть) что код математически даёт 5.83%

### Block E — Classification

По результатам Block A-D — classify:

**(i) Real bug:** формула неправильная, надо править. Что именно править — конкретно (file:line + new formula).

**(ii) Intentional design — "worst case simulation":** код намеренно считает наихудший сценарий "если бы все trades пошли против юзера". Нужно update documentation чтобы юзер понимал violation reason. Где обновить (BUSINESS_RULES.md, UI tooltip, error message).

**(iii) Edge case — hypothetical trade включается в расчёт несмотря на rejection:** если check делается ДО решения reject, но reject не откатывает расчёт — это исключаемая branch. Где fix.

### Block F — Affected users assessment (light)

- Проверить prod БД (read-only): сколько challenges failed по DLL за последние 30 дней
- Из них сколько с violation percent сильно превышающим final P&L (потенциально пострадавшие от bug, если это bug)
- Это даёт оценку impact (если bug — нужен ли refund/restore страдавшим challenges)

## Что НЕ входит

- Фикс DLL (если найдём bug) — отдельная фаза после investigation
- Изменения MLL — MLL отдельная rule, не touched
- Изменения других правил
- Schema changes
- UI changes сейчас

## Output

Один markdown файл `docs/TECH_DEBT_14_INVESTIGATION.md` со структурой:

```
# TECH-DEBT-14 Investigation Report

## Date / Phase / Branch / Methodology

## Reproduction case (recap)

## Findings
### Block A — DLL trigger sites
### Block B — Current formula
### Block C — UI vs DLL discrepancy
### Block D — Reproduction verification

## Classification
[Bug / Design / Edge case + полное обоснование]

## Recommendation
[Concrete next steps: либо fix scope, либо docs update scope]

## Affected users assessment
[Numbers from prod DB query, severity estimate]

## Open questions
[Если что-то осталось unclear]
```

Архитектор пишет финальный отчёт сам, Claude Code собирает raw findings.

## Пошаговый план

### Шаг 1 — Feature branch
```bash
cd ~/funded-app
git checkout develop && git pull
git checkout -b feature/tech-debt-14-dll-investigation
```

### Шаг 2 — Discovery через Claude Code
Claude Code собирает raw findings из Block A-E в `/tmp/dll-investigation-raw.md`.

### Шаг 3 — Архитектор reviews raw + классифицирует
Архитектор читает raw findings, делает Block F (prod query через Claude Code или SQL Алексею), формирует Classification + Recommendation.

### Шаг 4 — Финальный отчёт
Architect пишет `docs/TECH_DEBT_14_INVESTIGATION.md`, commit + push + PR.

### Шаг 5 — Алексей review + решение
По итогам investigation:
- Если bug → отдельная PHASE_DLL_FIX
- Если design → отдельная маленькая PHASE_DLL_DOCS
- Если edge case → fix через mini-фазу

## Закрытие фазы

После merge investigation отчёта:
- TECH-DEBT-14 в BACKLOG mark как INVESTIGATED (не CLOSED — нужен ещё fix или docs)
- SESSION_LOG entry с classification + recommendation
- Next phase brief формируется на основе recommendation

## Контрольные точки

### После Block A-D
- Все DLL trigger sites найдены
- Текущая формула explicit зафиксирована (file:line)
- Reproduction case математически верифицирован

### После Block E
- Classification (i/ii/iii) с обоснованием
- Concrete recommendation

### После Block F
- Numbers about affected users
- Severity estimate

### После Шага 4
- Investigation отчёт в develop через PR
- Next phase scope ясен
```