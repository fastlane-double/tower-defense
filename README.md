# 🏰 타워 디펜스 게임

브라우저 기반 타워 디펜스 게임 - HTML5 Canvas + Node.js 백엔드

## 기능

- **3종 타워**: 화살(빠른 공격), 대포(범위 피해), 마법(속도 감소)
- **4종 적**: 기본, 빠른, 탱크, 보스
- **10 웨이브** 진행
- **리더보드**: 서버에 점수 저장 및 상위 랭킹 표시
- **오브젝트 풀링** 기반 파티클 효과

## 실행 방법

### 1. 서버 시작

```bash
cd server
npm install
npm start
# 서버: http://localhost:3000
```

### 2. 클라이언트 서빙

방법 A - npx serve 사용:
```bash
npx serve . -p 8080 -s
# 게임: http://localhost:8080
```

방법 B - Python 사용:
```bash
python3 -m http.server 8080
# 게임: http://localhost:8080
```

방법 C - VS Code Live Server 또는 브라우저에서 직접 `index.html` 열기 (서버 없이 오프라인 모드)

## 게임 방법

1. 플레이어 이름 입력 후 게임 시작
2. 사이드바에서 타워 선택 후 녹색 잔디 칸에 클릭하여 배치
3. **웨이브 시작** 버튼으로 적 등장
4. 적이 성(🏰)에 도달하면 HP 감소, HP 0이 되면 게임 오버
5. 10웨이브 클리어 시 승리

## 타워 정보

| 타워 | 비용 | 데미지 | 공격속도 | 특징 |
|------|------|--------|----------|------|
| 🏹 화살 | 50 | 15 | 빠름 | 기본 |
| 💣 대포 | 100 | 60 | 느림 | 범위 피해 |
| 🔮 마법 | 125 | 20 | 보통 | 속도 감소 |

## 프로젝트 구조

```
tower-defense/
├── index.html          # 게임 UI 및 사이드바
├── style.css           # 스타일
├── game.js             # 게임 로직 (Canvas 렌더링, 게임 루프)
├── package.json        # 클라이언트 스크립트
└── server/
    ├── src/
    │   ├── index.js    # Express 서버
    │   ├── db.js       # SQLite 데이터베이스
    │   └── routes/
    │       ├── scores.js    # 점수 API
    │       └── sessions.js  # 세션 API
    ├── package.json
    └── .env.example
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/scores | 리더보드 조회 |
| POST | /api/scores | 점수 제출 |
| GET | /api/scores/leaderboard | 상위 100명 조회 |
| POST | /api/sessions | 세션 기록 |
| GET | /health | 서버 상태 확인 |
