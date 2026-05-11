# Open Questions для заказчика — блокеры старта P0

## Status: BLOCKED waiting for заказчик answers
Created: 2026-05-11

---

## Вопросы

### 1. KYC Rejected Policy
Что делать с аккаунтом при rejected KYC от Sumsub?

Варианты:
- (a) Account frozen, payouts заблокированы, трейдинг разрешён, 30 дней на апелляцию через support, потом close + рефанд оставшегося баланса
- (b) Account immediately closed, оставшийся баланс forfeit (всё забирает платформа)
- (c) Account immediately closed, рефанд оставшегося баланса

Моё предложение: (a) — мягкий путь с апелляцией.

---

### 2. Email templates copywriting
Кто пишет финальные тексты для 6 emails?

Варианты:
- (a) Заказчик предоставляет тексты (legal/marketing review)
- (b) Я готовлю draft на основе TFP-style, заказчик ревьюит и правит
- (c) Внешний копирайтер

Моё предложение: (b) — быстрее, потом фидбек.

---

### 3. MaxMind GeoLite2-City verification
Тестовый запрос с VPS (Hetzner CX23) — работает ли subdivision detection
для UA-43 (Crimea) на бесплатной версии?

Action required: подготовить test script + запустить до Wave 1 (на этапе подготовки).
Если subdivision detection не работает в GeoLite2-City free tier → рассмотреть MaxMind GeoIP2-City (платная) или альтернативу.

---

### 4. Backup storage
Подтверждение что Backblaze B2 — финальный выбор для backups?

Альтернативы: AWS S3 Glacier, Hetzner Storage Box, self-hosted Minio.

Моё предложение: Backblaze B2 (уже частично настроено для FundedForecast).

---

## После получения ответов
- Старт Wave 1 (database foundation)
- Estimate начала работы: +1-2 дня после получения ответов
