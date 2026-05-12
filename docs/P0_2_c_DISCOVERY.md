# P0.2.c Discovery — Equity-aware MLL upgrade

Date: 2026-05-12  
Status: DISCOVERY ONLY — no code written

---

## 1. Текущий Wave A код — 3 точки вставки

### 1.1 `src/app/api/trade/buy/route.ts` (~line 199)

```ts
// === Drawdown checks (challenge mode only) ===
if (activeChallenge && challengeId) {
  const newRealizedBalance = parseFloat((activeChallenge.realizedBalance - cost).toFixed(2));
  const newPeakBalance = Math.max(activeChallenge.peakBalance, newRealizedBalance);  // ← REPLACE with equity

  const maxLossAmount = activeChallenge.startBalance * (activeChallenge.maxTotalDdPct / 100);
  const mll = newPeakBalance - maxLossAmount;
  const isFailed = newRealizedBalance < mll;  // ← REPLACE with equity check

  if (isFailed) {
    throw new DrawdownViolatedError(challengeId, `Max Loss hit: ...`);
  }
  // ... daily DLL check (unchanged) ...
  await tx.challenge.update({
    where: { id: challengeId },
    data: { realizedBalance: newRealizedBalance, peakBalance: newPeakBalance },  // ← newPeakBalance = equity peak
  });
}
```

**Что в scope на момент MLL check:**
- `activeChallenge` — challenge row (realizedBalance, peakBalance, startBalance, maxTotalDdPct)
- `cost` — стоимость текущей покупки
- `marketId`, `side`, `amount` — параметры текущего трейда
- `market` — строка Market (yesPrice, noPrice) текущего маркета
- `existingPosition` / `position` — позиция уже upsert'нута к этому моменту
- `challengeId` — ID challenge
- `tx` — Prisma transaction client

**Что НЕ в scope:**
- Другие open positions (нет запроса)
- Цены других маркетов

---

### 1.2 `src/app/api/trade/sell/route.ts` (~line 181)

```ts
if (activeChallenge && challengeId) {
  const newRealizedBalance = parseFloat((activeChallenge.realizedBalance + proceeds).toFixed(2));
  const newPeakBalance = Math.max(activeChallenge.peakBalance, newRealizedBalance);  // ← REPLACE

  const maxLossAmount = activeChallenge.startBalance * (activeChallenge.maxTotalDdPct / 100);
  const mll = newPeakBalance - maxLossAmount;
  const isFailed = newRealizedBalance < mll;  // ← REPLACE

  if (isFailed) {
    throw new DrawdownViolatedError(challengeId, `Max Loss hit: ...`);
  }
  // ... daily DLL check (unchanged) ...
  await tx.challenge.update({
    where: { id: challengeId },
    data: { realizedBalance: newRealizedBalance, peakBalance: newPeakBalance, profitTargetMet },
  });
}
```

**Что в scope на момент MLL check:**
- `position` — продаваемая позиция (shares, avgPrice, id) — уже обновлена в tx
  - `newShares = position.shares - amount` (остаток после продажи)
  - `newCostBasis` — тоже обновлён
- `updatedPosition` — уже update'нута в tx (`shares = newShares`)
- `market` — строка Market текущего маркета (yesPrice, noPrice)
- `proceeds` — выручка от продажи
- `challengeId`, `activeChallenge`, `tx`

**Что НЕ в scope:**
- Другие open positions кроме продаваемой

---

### 1.3 `src/lib/marketResolve.ts` (~line 100)

```ts
if (challenge && challenge.status === "active") {
  const newRealizedBalance = parseFloat((challenge.realizedBalance + payout).toFixed(2));
  const newPeakBalance = Math.max(challenge.peakBalance, newRealizedBalance);  // ← REPLACE

  const maxLossAmount = challenge.startBalance * (challenge.maxTotalDdPct / 100);
  const mll = newPeakBalance - maxLossAmount;
  const drawdownViolated = newRealizedBalance < mll;  // ← REPLACE

  await tx.challenge.update({ ..., drawdownViolated ? { status: "failed", ... } });
}
```

**Что в scope:**
- `fresh` — позиция которая только что зарезолвилась (shares уже = 0 после update выше)
- `challenge` — строка Challenge
- `payout` — выплата за резолв ($1/share для winners, $0 для losers)
- `tx` — transaction client (каждая позиция в отдельной транзакции)

**Что НЕ в scope:**
- Другие open positions этого challenge

---

## 2. Equity formula

```
equity = newRealizedBalance + Σ(openPosition.shares × marketPrice)
```

Где `marketPrice = position.side === "yes" ? market.yesPrice : market.noPrice`

Затем:
```
newPeakEquity = Math.max(challenge.peakBalance, equity)
mll = newPeakEquity - maxLossAmount
isFailed = equity < mll
```

---

## 3. Positions query — что нужно загрузить

### Для BUY

После upsert позиции — запрашиваем **все** open positions (включая только что купленную,
т.к. к этому моменту она уже в БД):

```ts
const openPositions = await tx.position.findMany({
  where: { challengeId, status: "open" },
  select: {
    shares: true,
    side: true,
    market: { select: { yesPrice: true, noPrice: true } },
  },
});
const openPositionsValue = openPositions.reduce((sum, p) => {
  const price = p.side === "yes" ? p.market.yesPrice : p.market.noPrice;
  return sum + p.shares * price;
}, 0);
const equity = parseFloat((newRealizedBalance + openPositionsValue).toFixed(2));
```

### Для SELL

После update позиции — запрашиваем **все** open positions (продаваемая уже имеет newShares):

```ts
// Аналогично BUY — та же query, тот же reduce
// updatedPosition уже в БД с newShares
```

### Для marketResolve

После update позиции (`shares = 0`) — запрашиваем оставшиеся open positions:

```ts
// Та же query — зарезолвленная позиция уже имеет shares=0 и status="resolved"
// Т.е. её не будет в WHERE status="open"
```

---

## 4. Проблема с peakBalance — нужно решение от Архитектора

### Текущее состояние

`peakBalance Float` в schema Challenge — сейчас хранит **пик realizedBalance (cash)**.

### Вариант A: Repurpose peakBalance = equity peak

- Изменить семантику поля
- Все существующие записи: `peakBalance = GREATEST(startBalance, realizedBalance)`
  (уже была миграция — значения консистентны с Wave A)
- После Wave C: `peakBalance` означает пик equity
- **Риск:** если Wave C откатывается, старые значения уже смешаны

### Вариант B: Добавить новое поле peakEquity

```prisma
peakEquity Float?  // null = не инициализировано, fallback на peakBalance
```

- Более безопасно, явная семантика
- Требует schema change + migration
- `peakBalance` остаётся для backward compat

**Рекомендация:** обсудить с Архитектором до старта Wave C.

---

## 5. Где НЕ нужно менять

| Файл | Причина |
|---|---|
| `src/app/api/admin/audit/challenges/route.ts:245` | Читает `drawdownViolated` boolean — не формулу |
| `src/app/api/admin/expire-challenges/route.ts` | Ликвидирует позиции при expire, не MLL check |
| Daily DLL check (`dayStart`) в buy/sell | Остаётся от `dayStartBalance` (cash-based) |

---

## 6. Нет существующего equity helper

- `src/lib/equity.ts` — **не существует**
- `computeEquity`, `portfolioValue` — **нет в src/lib/**
- `portfolioValue` есть только в `src/app/dashboard/page.tsx` (frontend, клиентский код)
- `src/app/api/user/positions/route.ts` — вычисляет `currentValue = shares × price` per position,
  но это GET endpoint, не helper

**Нужно создать `src/lib/equity.ts`** с функцией `computeOpenPositionsValue(tx, challengeId)`.

---

## 7. Дополнительный query overhead

На каждый trade (buy/sell) добавляется 1 дополнительный JOIN-запрос к Position + Market.

| Сценарий | Кол-во позиций | Оценка latency |
|---|---|---|
| Новый юзер | 0-5 positions | +1-2ms |
| Активный трейдер | 10-30 positions | +3-5ms |
| Максимум | ~50 positions | ~+10ms |

Всё внутри transaction — читается snapshot БД на момент транзакции.

---

## 8. Итог — что нужно для Wave C

1. **Решение от Архитектора:** repurpose `peakBalance` или добавить `peakEquity`
2. **Новый файл:** `src/lib/equity.ts` — helper `computeOpenPositionsValue(tx, challengeId)`
3. **3 правки в 3 файлах:** заменить `newRealizedBalance` на `equity` в peak и isFailed
4. **SQL миграция:** если новое поле — `ALTER TABLE`, если repurpose — `UPDATE` достаточно
5. **Coolify env:** `NEXT_PUBLIC_APP_URL` уже выставлен, цены уже синхронизируются (P0.2.b ✓)
