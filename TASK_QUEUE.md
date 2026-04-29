# TASK QUEUE

## Current priority
1. Проверить текущую backend-логику проекта
2. Найти незавершённые части платформы
3. Составить список задач без изменения кода

## Rules
- Сначала анализ
- Потом один файл / одна задача
- Без UI
- Без массового рефакторинга

## Backend gaps found
1. Поддержка negRisk рынков: сейчас торговля блокируется (NEG_RISK_NOT_SUPPORTED) в src/app/api/trade/buy/route.ts и src/app/api/trade/sell/route.ts.
2. Daily drawdown / дневные лимиты: в торговых роутингах есть maxDailyDdPct в Challenge, но проверок дневной просадки в buy/sell и при резолве рынков не видно (есть в основном total drawdown / profit target).
3. Trading days (minTradingDays / tradingDaysCount): в модели есть minTradingDays и tradingDaysCount, но логики увеличения торговых дней/перехода статусов по этому критерию не видно.
4. Безопасность sync-markets: src/app/api/admin/sync-markets/route.ts не проверяет x-admin-key (в отличие от sync-prices/resolve-markets), т.е. эндпоинт выглядит открытым.
5. Резолв рынков и audit log: в src/app/api/admin/resolve-markets/route.ts AuditLog.targetId — Int, но туда пишется polyMarket.id (строка) через каст — это выглядит как незавершённая/ломающаяся часть аудита.
6. Идемпотентность вебхука оплат: src/app/api/payments/webhook/route.ts обновляет Payment и может создавать Challenge; отдельная таблица ProcessedStripeEvent есть в Prisma, но в логике вебхука не используется для дедупликации событий (риск повторной обработки).
7. Валидация payout-заявок: src/app/api/user/payout/route.ts не видно строгой валидации amount (тип/положительность/округление) и привязки к состоянию баланса/правилам плана кроме “не больше профита”.
8. Force resolve без сеттла позиций: src/app/api/admin/markets/[id]/action/route.ts при force_resolve просто меняет Market.status/winningOutcome, но не видно расчёта выплат/закрытия позиций как в admin/resolve-markets.

## Current execution order
1. Fix auth redirect bug: planId must return user to /checkout after login
2. Add reset password flow
3. Audit PnL calculations
4. Add error boundaries and loading states
5. Add /about and /how-it-works pages
6. Configure email after domain
7. Add affiliate system
