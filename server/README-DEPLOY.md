# 백엔드 서버 프로덕션 배포 가이드

타워 디펜스 게임 백엔드를 Railway 또는 Render에 배포하는 방법입니다.

서버는 **정적 파일(index.html, game.js, style.css)과 API를 함께 서빙**하므로,
별도의 프론트엔드 호스팅 없이 단일 서비스로 완전한 게임을 배포할 수 있습니다.

---

## 1. 사전 준비

- GitHub 저장소에 코드 push 완료
- Railway 또는 Render 계정

### Docker 빌드 컨텍스트 주의사항

Dockerfile은 `server/` 디렉토리 안에 있지만,
**빌드 컨텍스트는 반드시 프로젝트 루트**(`_default/`)여야 합니다.
`index.html`, `game.js`, `style.css`를 컨테이너에 포함시키기 위해서입니다.

```
_default/               ← 빌드 컨텍스트(루트)
├── index.html
├── game.js
├── style.css
└── server/
    ├── Dockerfile      ← dockerfilePath: server/Dockerfile
    ├── render.yaml
    ├── railway.json
    └── src/
```

---

## 2. Railway 배포

### 2-1. Railway CLI로 배포

```bash
# Railway CLI 설치
npm install -g @railway/cli

# 로그인
railway login

# 프로젝트 루트(_default/)에서 실행
railway init
railway up

# 환경변수 설정
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set CORS_ORIGINS=https://your-app.up.railway.app

# Toss Payments 사용 시
railway variables set TOSS_SECRET_KEY=sk_live_YOUR_SECRET_KEY
```

### 2-2. Railway 웹 대시보드로 배포

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. 저장소 선택
3. Settings → Build:
   - **Dockerfile Path**: `server/Dockerfile`
   - **Build Context**: `/` (프로젝트 루트)
4. Settings → Variables 에서 환경변수 설정:
   ```
   NODE_ENV=production
   PORT=3000
   CORS_ORIGINS=https://your-app.up.railway.app
   TOSS_SECRET_KEY=sk_live_...   (결제 사용 시)
   ```
5. Volumes → Add Volume:
   - Mount Path: `/app/server/data`
   - (SQLite 데이터 영속성 — 없으면 재배포 시 리더보드 초기화)

### 2-3. 배포 확인

```bash
# 헬스체크
curl https://your-app.up.railway.app/health

# 리더보드 API
curl https://your-app.up.railway.app/api/scores/leaderboard
```

---

## 3. Render 배포

### 3-1. render.yaml 사용 (Blueprint)

1. GitHub 저장소 루트에 `render.yaml`이 있어야 합니다.
   현재 `server/render.yaml`을 **프로젝트 루트**로 복사하거나,
   아래 내용으로 루트에 `render.yaml` 생성:
   ```yaml
   services:
     - type: web
       name: tower-defense-backend
       runtime: docker
       dockerfilePath: server/Dockerfile
       plan: starter
       region: singapore
       envVars:
         - key: NODE_ENV
           value: production
         - key: PORT
           value: "3000"
         - key: CORS_ORIGINS
           sync: false
         - key: TOSS_SECRET_KEY
           sync: false
       disk:
         name: tower-defense-data
         mountPath: /app/server/data
         sizeGB: 1
   ```
2. [dashboard.render.com](https://dashboard.render.com) → New → Blueprint
3. 저장소 연결 → 자동 배포

### 3-2. 수동 배포

1. Render Dashboard → New → Web Service
2. GitHub 저장소 연결
3. 설정:
   - **Environment**: Docker
   - **Dockerfile Path**: `server/Dockerfile`
   - **Docker Context**: (비워두거나 `/`)
   - **Region**: Singapore
4. Environment Variables:
   ```
   NODE_ENV=production
   PORT=3000
   CORS_ORIGINS=https://tower-defense-backend.onrender.com
   TOSS_SECRET_KEY=sk_live_...   (결제 사용 시)
   ```
5. Disks → Add Disk:
   - **Mount Path**: `/app/server/data`
   - **Size**: 1 GB
   - (무료 플랜은 디스크 미지원 → 재배포 시 SQLite 데이터 초기화)

---

## 4. 환경변수 정리

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `NODE_ENV` | `development` | `production` 설정 필수 |
| `PORT` | `3000` | 서버 포트 |
| `CORS_ORIGINS` | localhost 목록 | 허용할 프론트엔드 Origin (콤마 구분) |
| `TOSS_SECRET_KEY` | _(없음)_ | 토스페이먼츠 시크릿 키. 미설정 시 테스트 모드(자동 승인) |

### CORS_ORIGINS 예시

```
# 단일 도메인
CORS_ORIGINS=https://tower-defense.up.railway.app

# 복수 도메인 (콤마 구분, 공백 허용)
CORS_ORIGINS=https://tower-defense.up.railway.app, https://yourdomain.com
```

---

## 5. SQLite 데이터 지속성

| 플랫폼 | 방법 | 비용 |
|--------|------|------|
| Railway | Volume mount `/app/server/data` | 유료 플랜 ($5/월~) |
| Render | Disk mount `/app/server/data` (1GB) | Starter 플랜 ($7/월~) |
| 무료 티어 | 지속성 없음 — 재배포 시 리더보드 초기화 | 무료 |

데이터 경로: `/app/server/data/tower_defense.db`

---

## 6. 배포 후 검증 체크리스트

```bash
BASE_URL=https://your-app.up.railway.app  # 실제 URL로 변경

# 1. 헬스체크
curl $BASE_URL/health
# 예상: {"status":"ok","timestamp":"..."}

# 2. 게임 정적 파일 서빙
curl -I $BASE_URL/
# 예상: 200 OK, content-type: text/html

# 3. 리더보드 조회
curl $BASE_URL/api/scores/leaderboard
# 예상: {"scores":[...]}

# 4. 점수 제출 테스트
curl -X POST $BASE_URL/api/scores \
  -H "Content-Type: application/json" \
  -d '{"player_name":"TestPlayer","score":1000,"wave":5,"duration_seconds":120}'
# 예상: {"id":"...","player_name":"TestPlayer",...}

# 5. Rate limit 확인 (10회 이상 연속 제출)
for i in {1..12}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE_URL/api/scores \
    -H "Content-Type: application/json" \
    -d '{"player_name":"RateLimitTest","score":100,"wave":1,"duration_seconds":10}'
done
# 예상: 처음 10개 201, 이후 429
```

---

## 7. 배포 후 프론트엔드팀 전달 사항

배포 완료 후 **[STE-74](../STE/issues/STE-74)** (프론트엔드 배포) 담당자에게 아래 URL 전달:

```
백엔드 API 베이스 URL: https://your-deployed-url.app
```

프론트엔드는 이 URL을 `VITE_API_BASE_URL` (또는 해당 환경변수)로 설정합니다.
