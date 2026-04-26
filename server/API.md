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
