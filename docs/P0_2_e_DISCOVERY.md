# P0.2.e Discovery — Stale market cleanup

Date: 2026-05-12
Status: DISCOVERY ONLY — no code written

---

## 1. Проблема

В БД 201 маркет со `status='live'` и `lastSyncedAt > 7 дней`.

**Причина**: sync-markets фетчит Polymarket feed с параметром `active=true&closed=false`.
Как только маркет на Polymarket переходит в `closed=true`, он выпадает из нашего sync —
и остаётся в БД навсегда со статусом `live`.

---

## 2. SQL для Алексея (запустить в Coolify DB Terminal)

### 2.1 Обзор stale маркетов

```sql
SELECT
  COUNT(*)                                                 AS total_live,
  COUNT(*) FILTER (WHERE "lastSyncedAt" < NOW() - INTERVAL '7 days')   AS stale_7d,
  COUNT(*) FILTER (WHERE "lastSyncedAt" < NOW() - INTERVAL '1 day')    AS stale_1d,
  COUNT(*) FILTER (WHERE "endDate" < NOW())                             AS overdue_enddate
FROM "Market"
WHERE status = 'live';
```

### 2.2 Stale маркеты с открытыми позициями — КРИТИЧНО

```sql
SELECT
  m.id,
  m.title,
  m."endDate",
  m."lastSyncedAt",
  COUNT(p.id)   AS open_positions,
  SUM(p.shares) AS total_shares
FROM "Market" m
JOIN "Position" p ON p."marketId" = m.id AND p.status = 'open'
WHERE m.status = 'live'
  AND m."lastSyncedAt" < NOW() - INTERVAL '7 days'
GROUP BY m.id, m.title, m."endDate", m."lastSyncedAt"
ORDER BY open_positions DESC;
```

**Если возвращает 0 строк** → нет open positions на stale маркетах →
политика для позиций не блокирует реализацию P0.2.e.

---

## 3. Polymarket API — как определить resolution state

### 3.1 Endpoint для individual market lookup

```
GET https://gamma-api.polymarket.com/markets/{id}
```

Работает для любого маркета (active, closed, resolved).

### 3.2 Ключевые поля (проверено на 6 маркетах)

| Поле | Тип | Значение | Интерпретация |
|---|---|---|---|
| `closed` | bool | `true` | Торговля остановлена |
| `active` | bool | `true` | Остаётся true даже после resolution |
| `outcomePrices` | JSON string | `["0","1"]` или `["1","0"]` | YES/NO winner определён |
| `umaResolutionStatus` | string | `"resolved"` | **АВТОРИТАТИВНОЕ ПОЛЕ** |
| `umaResolutionStatuses` | array | `["proposed"]` | ВСЕГДА `["proposed"]` у resolved маркетов — **ЛОЖНЫЙ сигнал, игнорировать** |
| `automaticallyResolved` | bool | `true` | Resolved автоматически (не вручную) |
| `closedTime` | datetime | `"2026-05-09 06:57:31+00"` | Когда именно закрылся |

### 3.3 Разница между singular и plural полями (ВАЖНО)

**`umaResolutionStatuses` (plural) = `["proposed"]`** — это НЕ значит "ещё не resolved".
У всех 6 проверенных resolved маркетов plural поле = `["proposed"]`.
Это лейбл UMA-механизма, не статус resolution.

**`umaResolutionStatus` (singular) = `"resolved"`** — вот это финальный статус.

### 3.4 Паттерн fully resolved маркета

```
closed: true
umaResolutionStatus: "resolved"          ← авторитативное поле
outcomePrices: ["0","1"] или ["1","0"]   ← prices converged to 0 or 1
automaticallyResolved: true
```

Выигравший:
```python
prices = json.loads(outcomePrices)
winner = "yes" if float(prices[0]) > 0.99 else "no"
```

### 3.5 Пример — маркет 2133404 (Iran airspace)

```
question:    "Iran closes its airspace by May 8?"
endDateIso:  2026-05-31
closedTime:  2026-05-09 06:57:31+00   ← закрылся РАНЬШЕ endDate (вопрос разрешился)
outcomePrices: ["0", "1"]             ← NO=1.0 → NO wins
umaResolutionStatus: "resolved"
automaticallyResolved: true
```

**Вывод**: маркеты часто закрываются до их формального `endDate`.
Проверять надо не `endDate < NOW()`, а факт `closed: true` на Polymarket.

---

## 4. Существующий resolve-markets endpoint

**Файл**: `src/app/api/admin/resolve-markets/route.ts`

### Что делает сейчас

1. Берёт все live маркеты из нашей БД
2. Запрашивает `GET /markets?closed=true&limit=100` у Polymarket
3. Фильтрует: маркет в нашей БД + `closed=true` + `yesPrice > 0.99 || noPrice > 0.99`
4. Для каждого подходящего: обновляет `status='resolved'`, вызывает `resolveMarketPositions()`
5. Создаёт AuditLog запись

### Проблема

Шаг 2 фетчит только **100 последних закрытых маркетов** Polymarket.
Наши 201 stale маркетов давно выпали из этой очереди — их там нет.

### Что переиспользуем

- `resolveMarketPositions(marketId, winningOutcome)` из `src/lib/marketResolve.ts` —
  готовый, протестированный, equity-aware (Wave C)
- AuditLog pattern
- negRisk skip логика

---

## 5. Предлагаемая архитектура P0.2.e

### Подход: индивидуальный lookup наших stale маркетов

```
cron trigger
  → GET /api/cron/cleanup-stale-markets
    → берём из БД: Market WHERE status='live' AND lastSyncedAt < NOW()-7days
    → для каждого: GET /markets/{id} от Polymarket
    → если closed=true AND yesPrice/noPrice > 0.99:
        → resolve (переиспользуем resolveMarketPositions)
    → если closed=true AND prices НЕ converged:
        → ???  ← ОТКРЫТЫЙ ВОПРОС (см. раздел 6)
    → если active=true (всё ещё live на Polymarket, просто low-volume):
        → обновить lastSyncedAt, оставить live
```

### Где разместить

**Вариант A**: Новый endpoint `src/app/api/cron/cleanup-stale-markets/route.ts`
- Плюс: изолированная логика, отдельное расписание (0 * * * *)
- Минус: ещё один Coolify Scheduled Task

**Вариант B**: Встроить в существующий `src/app/api/cron/sync/route.ts`
- Плюс: один запуск = sync + cleanup
- Минус: усложняет уже работающий endpoint

---

## 6. Открытые вопросы для Архитектора

### Q1 — SQL для Алексея (см. раздел 2.2)
Есть ли open positions на stale маркетах прямо сейчас?
Если 0 — политика для позиций не блокирует P0.2.e.

### Q2 — Closed but NOT resolved (prices НЕ converged)
Что делать с маркетом у которого `closed=true` но `outcomePrices` не 0/1?
Например, застрял на `["0.5", "0.5"]` — маркет формально закрыт, но winner не определён.

**Варианты:**
- A) Ждать: повторять lookup каждый cron, пока не resolved (может ждать вечно)
- B) Refund: после X дней mark `status='expired'`, return позиции по `avgPrice`
- C) Forfeit: mark `status='expired'`, позиции закрываются без выплаты

**Рекомендация для sandbox**: Вариант B (refund по avgPrice) — безопаснее для тест-юзеров.

### Q3 — Размещение cleanup логики
Новый endpoint (Вариант A) или встроить в sync (Вариант B)?

### Q4 — Расписание
Если новый endpoint — как часто? `0 * * * *` (каждый час) или реже?

### Q5 — Rate limit от Polymarket
201 маркет × 1 GET запрос = 201 последовательных запросов за один cron run.
Polymarket gamma-api публичный, без auth. Нужен ли sleep между запросами?
Или лучше батчить через `?id=x,y,z` если такой endpoint существует?

---

## 7. Batch lookup — существует ли?

```bash
# Проверить: можно ли получить несколько маркетов за один запрос
curl -s 'https://gamma-api.polymarket.com/markets?id=2133404,2216161' | \
  python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(type(d), len(d) if isinstance(d,list) else d)"
```

_(не выполнялось — проверить при старте Wave 2)_
