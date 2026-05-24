#### A2. Прочитать целиком
- `src/app/api/trade/buy/route.ts` — найти все места rule #2, #3, #4 enforcement
- `src/lib/engine/spreads.ts` — helpers
- `src/lib/engine/constants.ts` — константы
- `src/app/api/cron/end-of-day-check/route.ts` — для понимания rule #4 alternative
- `src/app/markets/[id]/page.tsx` (TradeModal) — UI preview rows + handleTrade error handling
- `src/app/api/user/positions/route.ts` — что возвращается в response

#### A3. Зафиксировать
- Все error classes которые удаляются: MinPositionError, AggregatePositionExceededError, DailyVolumeExceededError
- Все catch handlers что нужно удалить
- Все UI references на error_codes этих правил
- Engine constants которые становятся unused
- Decision recommendation по rule #4 (a / b / c)

#### A4. Отчёт в основной чат
- Line numbers всех изменений
- Recommendation по rule #4 с обоснованием
- Что НЕ меняется (явно зафиксировать что оставляем in place)

**Контрольная точка:** A → ACK основного чата → план implementation.

### Шаг B — Implementation (по результатам A)

Конкретные шаги формируются после ACK на план из A. Ориентировочно:

- **B1.** Remove error classes + checks из trade/buy
- **B2.** Cleanup engine constants (unused)
- **B3.** Apply rule #4 alternative (если выбран вариант b — добавить в end-of-day-check)
- **B4.** UI: переименовать preview rows на "Recommended", убрать error_code handlers
- **B5.** Update BUSINESS_RULES.md секции #2/#3/#4
- **B6.** tsc + build clean

### Шаг C — Smoke test (Алексей)

- Coolify deploy на feature branch
- Test cases:
  - Buy $5 (раньше reject Min position) → должен пройти
  - Buy all-in $1000 на одном market (раньше reject Aggregate) → должен пройти (если balance позволяет)
  - Multi-trade за день суммарно >$200 (раньше reject Daily volume) → зависит от rule #4 decision
  - Insufficient balance → reject (infrastructure, должно работать)
  - Buy cap $0.85 → reject (infrastructure)
  - User blocked → reject (infrastructure)
- UI verify: preview rows показывают info, Buy button работает

### Шаг D — Documentation + wrap-up

- SESSION_LOG.md entry
- BACKLOG.md mark TASK-PHILO-1 as CLOSED
- BUSINESS_RULES.md updated
- Commits + push + PR + merge

### Шаг E — Production release decision

После merge в develop — отдельно решить:
- Релизить TASK-PHILO-1 на prod сразу (small impact change) или ждать Phase 5 UI widgets package?
- По умолчанию: ждать, релизить пакетом для меньшего prod risk

## Контрольные точки

### После A
- [ ] Feature branch создана
- [ ] Все changes locations зафиксированы
- [ ] Rule #4 decision recommendation сформулирован

### После B
- [ ] Hard rejects удалены
- [ ] UI обновлён
- [ ] BUSINESS_RULES.md синхронизован
- [ ] tsc + build clean

### После C
- [ ] 6 test cases passed
- [ ] UI verify clean

### После D
- [ ] Commits + push
- [ ] PR + merge в develop
- [ ] Docs updated

## Closing checklist

Алексей возвращается с:
- Test results
- Hash коммитов
- Recommendation: release на prod сразу или ждать?

## Следующая фаза

Phase 5 (UI widgets) — параллельная или после TASK-PHILO-1, не конфликтует.

Если TASK-PHILO-1 на prod уйдёт без UI widgets — юзер увидит изменение поведения (reject больше не происходит) но UI всё ещё показывает старые preview rows. Не критично, но Phase 5 desync.