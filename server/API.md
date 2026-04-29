# Tower Defense Game - Backend API Documentation

Base URL: `http://localhost:3000`

## Health Check

### `GET /health`
Returns server status.

**Response:**
```json
{ "status": "ok", "timestamp": "2026-04-24T00:00:00.000Z" }
```

---

## Scores API

### `GET /api/scores`
Returns the leaderboard (top scores, sorted by score descending).

**Query Parameters:**
| Name     | Type   | Default | Description                  |
|----------|--------|---------|------------------------------|
| limit    | int    | 10      | Max results (max 100)        |
| offset   | int    | 0       | Pagination offset            |
| player   | string | -       | Filter by player name        |

**Response:**
```json
{
  "scores": [
    {
      "id": "uuid",
      "player_name": "Alice",
      "score": 3000,
      "wave": 10,
      "duration_seconds": 300,
      "created_at": "2026-04-24 00:00:00"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

---

### `GET /api/scores/player/:name`
Returns the best score for a specific player, including their global rank.

**Response:**
```json
{
  "id": "uuid",
  "player_name": "Alice",
  "score": 3000,
  "wave": 10,
  "duration_seconds": 300,
  "created_at": "2026-04-24 00:00:00",
  "rank": 1
}
```

**Errors:**
- `404` – Player not found

---

### `POST /api/scores`
Submit a new score entry.

**Request Body:**
```json
{
  "player_name": "Alice",     // required, max 32 chars
  "score": 3000,              // required, non-negative integer
  "wave": 10,                 // optional, defaults to 1
  "duration_seconds": 300     // optional, defaults to 0
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "player_name": "Alice",
  "score": 3000,
  "wave": 10,
  "duration_seconds": 300,
  "created_at": "2026-04-24 00:00:00",
  "rank": 1
}
```

**Errors:**
- `400` – Validation error (missing or invalid fields)

---

## Sessions API

### `GET /api/sessions`
Returns game session history (most recent first).

**Query Parameters:**
| Name   | Type   | Default | Description           |
|--------|--------|---------|-----------------------|
| limit  | int    | 20      | Max results (max 100) |
| offset | int    | 0       | Pagination offset     |
| player | string | -       | Filter by player name |

**Response:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "player_name": "Alice",
      "score": 3000,
      "wave_reached": 10,
      "duration_seconds": 300,
      "result": "victory",
      "started_at": "2026-04-24T00:00:00Z",
      "ended_at": "2026-04-24 00:05:00"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

### `GET /api/sessions/:id`
Returns a single game session by ID.

**Errors:**
- `404` – Session not found

---

### `POST /api/sessions`
Record a completed game session.

**Request Body:**
```json
{
  "player_name": "Alice",              // required, max 32 chars
  "score": 3000,                       // required, non-negative integer
  "wave_reached": 10,                  // optional, defaults to 1
  "duration_seconds": 300,             // optional, defaults to 0
  "result": "victory",                 // required: "victory" | "defeat" | "abandoned"
  "started_at": "2026-04-24T00:00:00Z" // required, ISO 8601
}
```

**Response (201):** Full session object.

**Errors:**
- `400` – Validation error

---

## Payments API

### `GET /api/payments/products`
Returns the list of purchasable products.

**Response:**
```json
{
  "products": [
    { "id": "tesla", "name": "테슬라 타워", "price": 1200, "type": "permanent" },
    { "id": "god", "name": "갓 타워", "price": 1000, "type": "consumable" },
    { "id": "nuke_bomb", "name": "핵폭탄 스킬", "price": 500, "type": "consumable" }
  ]
}
```

---

### `POST /api/payments/orders`
Create a payment order. Call this before initiating Toss Payments checkout.

**Request Body:**
```json
{
  "product_id": "tesla",       // required, must match a product ID
  "player_name": "Alice"       // required, max 32 chars
}
```

**Response (201):**
```json
{
  "orderId": "TD_abc123...",
  "amount": 1200,
  "orderName": "테슬라 타워",
  "productId": "tesla",
  "productType": "permanent"
}
```

**Errors:**
- `400` – Invalid product_id or missing player_name

---

### `POST /api/payments/confirm`
Confirm a payment after Toss Payments checkout completes. In test mode (no `TOSS_SECRET_KEY`), payments are auto-approved.

**Request Body:**
```json
{
  "paymentKey": "toss_payment_key",   // required, from Toss redirect
  "orderId": "TD_abc123...",          // required, from order creation
  "amount": 1200                      // required, must match order amount
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "TD_abc123...",
  "productId": "tesla",
  "productType": "permanent",
  "testMode": true
}
```

**Errors:**
- `400` – Missing fields or amount mismatch
- `404` – Order not found
- `409` – Order already confirmed

---

### `GET /api/payments/purchases/:playerName`
Returns a player's purchase history with aggregated unlock/consumable state.

**Response:**
```json
{
  "unlocked": ["tesla", "frost"],
  "consumables": { "god": 2, "nuke_bomb": 1 },
  "purchases": [
    { "product_id": "tesla", "product_type": "permanent", "quantity": 1, "purchased_at": "..." }
  ]
}
```

---

### `GET /api/payments/orders/:orderId`
Check the status of a specific order.

**Response:**
```json
{
  "orderId": "TD_abc123...",
  "productId": "tesla",
  "amount": 1200,
  "status": "paid",
  "playerName": "Alice"
}
```

**Errors:**
- `404` – Order not found

---

## Database Schema

### `scores` table
Stores every score submission. Multiple entries per player are allowed (for leaderboard history).

| Column           | Type    | Description              |
|-----------------|---------|--------------------------|
| id               | TEXT PK | UUID                     |
| player_name      | TEXT    | Player display name      |
| score            | INTEGER | Final score              |
| wave             | INTEGER | Wave reached             |
| duration_seconds | INTEGER | Session duration         |
| created_at       | TEXT    | Submission timestamp     |

### `game_sessions` table
Records full game session details.

| Column           | Type    | Description                        |
|-----------------|---------|------------------------------------|
| id               | TEXT PK | UUID                               |
| player_name      | TEXT    | Player display name                |
| score            | INTEGER | Final score                        |
| wave_reached     | INTEGER | Last wave completed                |
| duration_seconds | INTEGER | Total session duration in seconds  |
| result           | TEXT    | `victory`, `defeat`, or `abandoned`|
| started_at       | TEXT    | Session start (ISO 8601)           |
| ended_at         | TEXT    | Session end (auto-set by server)   |

### `payment_orders` table
Tracks payment order lifecycle.

| Column       | Type    | Description                                     |
|-------------|---------|-------------------------------------------------|
| id           | TEXT PK | UUID                                            |
| order_id     | TEXT    | Unique order ID (e.g. `TD_abc123...`)           |
| product_id   | TEXT    | Product identifier                              |
| product_name | TEXT    | Product display name                            |
| amount       | INTEGER | Price in KRW                                    |
| player_name  | TEXT    | Buyer player name                               |
| status       | TEXT    | `pending`, `paid`, `failed`, or `cancelled`     |
| payment_key  | TEXT    | Toss Payments payment key (after confirmation)  |
| created_at   | TEXT    | Order creation timestamp                        |
| updated_at   | TEXT    | Last update timestamp                           |

### `purchases` table
Records completed purchases (one row per successful payment).

| Column       | Type    | Description                              |
|-------------|---------|------------------------------------------|
| id           | TEXT PK | UUID                                     |
| order_id     | TEXT    | References payment_orders.order_id       |
| player_name  | TEXT    | Buyer player name                        |
| product_id   | TEXT    | Product identifier                       |
| product_type | TEXT    | `permanent` or `consumable`              |
| quantity     | INTEGER | Number of uses granted (1 for permanent) |
| purchased_at | TEXT    | Purchase timestamp                       |

---

## Running the Server

```bash
cd server
npm install
npm start          # production
npm run dev        # development with auto-reload (Node.js 18+)
```

Default port: `3000`. Override with `PORT` environment variable.

```bash
PORT=8080 npm start
```

### Payment Configuration

Without `TOSS_SECRET_KEY`, the server runs in **test mode** — all payments are auto-approved without calling the Toss Payments API. Set the keys in `.env` for production:

```bash
TOSS_SECRET_KEY=live_sk_xxxxxxxx
TOSS_CLIENT_KEY=live_ck_xxxxxxxx
```

On the client side, set `window.TOSS_CLIENT_KEY` before `game.js` loads to enable the Toss Payments checkout widget.
