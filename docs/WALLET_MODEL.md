# Wallet Model

## Status
APPROVED — 2026-05-11 (помощник-аудитор + Алексей)  
TO BE IMPLEMENTED — после демо начальству, как [A1] production-blocker

## Goal
Чёткая логическая модель распределения балансов между sandbox 
и challenges. Каждый wallet — изолированный счёт. Балансы и 
позиции не смешиваются.

## Entities

### Sandbox Wallet
- Создаётся один раз при регистрации юзера
- Стартовый баланс: $10 (STARTING_BALANCE)
- `status`: всегда "active" (immutable как сущность)
- `challengeId`: null
- Хранит свои positions (paper trades для обучения)
- Существует навсегда

### Challenge Wallet
- Создаётся при успешной активации payment (cron activate-payments)
- Стартовый баланс: ChallengePlan.accountSize (например $1000)
- `status`: соответствует Challenge.status
  - "active" → юзер торгует
  - "passed" → challenge пройден, terminal
  - "failed" → drawdown нарушен, terminal
  - "expired" → срок истёк, terminal
- `challengeId`: ссылка на Challenge (1:1)
- Хранит свои positions (paper trades в challenge)

## Computed Rules

Active wallet определяется динамически (не хранится в БД):

```
getActiveWallet(userId):
  activeChallenge = Challenge WHERE userId=:userId AND status="active" LIMIT 1
  if activeChallenge exists:
    return activeChallenge.wallet
  else:
    return user.sandboxWallet
```

Tradability определяется динамически:

```
canTradeIn(wallet, userId):
  if wallet.type == "sandbox":
    return (no active challenge for userId)
  if wallet.type == "challenge":
    return (wallet.challenge.status == "active")
```

Покупка нового challenge:

```
canBuyNewChallenge(userId):
  return (no active challenge for userId)
```

## MVP Constraints

- N=1 active challenge per user (упрощение для запуска)
- Multiple active challenges — будущая paid/advanced feature, не сейчас
- При попытке купить второй active challenge:
  - API: 409 Conflict "Complete current challenge before starting new"
  - UI: на /account/plans показать banner "You have active challenge",
    кнопки Get Plan disabled

## State Transitions

```
SANDBOX WALLET:
   created (registration) → "active" forever
   status НИКОГДА не меняется

CHALLENGE WALLET:
   created (payment.activate) → status="active" (matches Challenge)
   active → passed (cron sees profit target reached in trading days)
   active → failed (cron sees drawdown violation)
   active → expired (cron sees deadline missed)
   passed/failed/expired → terminal (status never changes again)
```

## UI Behavior

### /dashboard
- Header BALANCE = activeWallet.balance
- "AVAILABLE BALANCE" card = activeWallet.balance
- "OPEN POSITIONS" card = count(positions WHERE walletId=activeWallet.id)
- "UNREALIZED PNL" = sum(pnl WHERE walletId=activeWallet.id)
- "PORTFOLIO VALUE" = activeWallet.balance + sum(position.currentValue)

Если active challenge exists:
  - Карточка "Evaluation Challenge ACTIVE" с прогрессом

Если нет active challenge:
  - Карточка "Sandbox Mode" с CTA "Get Funded →"

### Open Positions section
- Показывает positions ТОЛЬКО из activeWallet
- Sandbox позиции скрыты во время active challenge
- Challenge позиции скрыты после failed/passed
- Никаких смешений

### Past Challenges section
- Список closed challenges (passed/failed/expired)
- Read-only, кликабельные для деталей
- Не влияют на текущий баланс

### Sandbox secondary card (когда заморожен)
- Compact информационная карточка
- Показывает sandbox balance и positions count
- Не активно для торговли
- Текст: "Sandbox paused during active challenge"

## Data Model (Prisma)

```prisma
model Wallet {
  id              Int       @id @default(autoincrement())
  userId          Int
  type            String    // "sandbox" | "challenge"
  challengeId     Int?      @unique  // null if sandbox
  balance         Decimal   @default(0)
  startingBalance Decimal
  createdAt       DateTime  @default(now())

  user       User       @relation(fields: [userId], references: [id])
  challenge  Challenge? @relation(fields: [challengeId], references: [id])
  positions  Position[]
  trades     Trade[]
  balanceLog BalanceLog[]

  @@index([userId, type])
}
```

User получает sandbox wallet relation:
- `wallets Wallet[]`
- `sandboxWallet`: helper для query через `Wallet WHERE type="sandbox"`

Challenge получает связь 1:1 с Wallet:
- `wallet Wallet?`  // nullable до миграции

Position / Trade / BalanceLog добавляют `walletId NOT NULL`:
- `walletId Int`
- `wallet   Wallet @relation`

## Migration Strategy

1. Add `Wallet` model to schema
2. Create wallet records for existing data:
   - For each user without sandbox wallet: create one with current balance
   - For each Challenge: create corresponding wallet, link to challenge
3. Add `walletId` to Position, Trade, BalanceLog (nullable initially)
4. Backfill `walletId` based on `Position.userId + Position.challengeId`
5. Make `walletId NOT NULL` after backfill
6. Update all endpoints to use `walletId`
7. Remove deprecated `userId` direct relationship on Position/Trade/BalanceLog

## Test Cases

После реализации:

1. Регистрация → создан 1 sandbox wallet с balance=$10
2. Sandbox trade → trade.walletId = sandbox.id, balance меняется
3. Покупка challenge → новый challenge wallet с balance=$1000, sandbox остаётся
4. Trade в challenge → trade.walletId = challenge.id, sandbox не трогается
5. Failed challenge → Challenge.status=failed → canTradeIn(challenge)=false
6. После failed → попытка trade в sandbox → canTradeIn(sandbox)=true (нет active challenge)
7. Покупка нового challenge → ОК (нет active), создан второй challenge wallet
8. Попытка купить challenge когда активен → 409 Conflict
9. Просмотр dashboard → видны позиции только активного wallet
10. Просмотр past challenges → видны все closed challenges с историей

## Current State (2026-05-11)

❌ Wallet model не реализован  
❌ Position.userId — общий пул, не разделён по wallet  
❌ Trade.userId — то же самое  
❌ BalanceLog — единый pool юзера  
✅ Challenge.status работает корректно (active/failed/passed/expired)  
✅ Cron activate-payments создаёт Challenge при confirmed payment  

## Demo Costyls (временно до A1)

- D27: window.location.href в popup для refresh header после challenge purchase
- D28: Фильтр Open Positions через активный challenge на уровне API endpoint

Эти костыли НЕ блокируют будущее A1. После реализации wallet model
их можно удалить — нативная фильтрация по walletId покроет.
