# 블럭 스케줄러 (Block Scheduler)

개인용 시간 블록 스케줄러 PWA 앱입니다. 수직 타임라인 위에서 할 일을 관리하고, 시간 기록(time log)과 일정(calendar event)을 시각적으로 확인할 수 있습니다.

---

## 주요 기능

- 📅 **수직 타임라인**: 과거 30일 ~ 미래 30일을 한눈에 볼 수 있는 스크롤형 타임라인
- ✅ **할 일 풀(Task Pool)**: 미완료 할 일 목록, 마감일(D-Day) 표시, 예상 소요 시간 합계
- ⏱ **시간 기록(Time Log)**: 할 일 시작/중지 또는 직접 시간 입력
- 📌 **일정(Event)**: 타임라인에 일정 블록 추가
- 👻 **Ghost Block**: 마감일 있는 할 일의 예상 배치 미리보기
- 🔒 **비밀번호 인증**: 단일 사용자 비밀번호 보호
- 🏷️ **카테고리**: 색상 지정 카테고리로 분류
- ⚙️ **수면 시간 설정**: 수면 구간은 타임라인에서 어둡게 표시
- 📱 **PWA 지원**: 홈 화면 추가, 오프라인 동작

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React 18, TypeScript, Vite, vite-plugin-pwa |
| 백엔드 | Node.js, Express, better-sqlite3 |
| 인증 | JWT (jsonwebtoken), bcryptjs |
| 배포 | Docker, docker-compose, Nginx |
| DB | SQLite (파일 기반) |

---

## 빠른 시작

### Docker Compose (권장)

```bash
# 1. 저장소 클론
git clone <repo-url>
cd block-scheduler

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일에서 JWT_SECRET 변경

# 3. 실행
docker-compose up -d
```

- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:3001

### 로컬 개발

```bash
# 백엔드
cd backend
npm install
npm run dev

# 프론트엔드 (새 터미널)
cd frontend
npm install
npm run dev
```

---

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `JWT_SECRET` | `changeme` | JWT 서명 비밀키 (반드시 변경) |
| `PORT` | `3001` | 백엔드 포트 |
| `FRONTEND_PORT` | `3000` | 프론트엔드 포트 |
| `TZ` | `Asia/Seoul` | 타임존 |
| `DB_PATH` | `./data/db.sqlite` | SQLite DB 경로 |

---

## API 엔드포인트

### 인증
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/auth/status` | 설정 여부 확인 |
| POST | `/api/auth/setup` | 초기 비밀번호 설정 |
| POST | `/api/auth/login` | 로그인 |

### 카테고리 / 할 일 / 일정 / 시간 기록 / 설정
모두 `Authorization: Bearer <token>` 헤더 필요.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET/POST | `/api/categories` | 카테고리 목록/생성 |
| GET/PUT/DELETE | `/api/categories/:id` | 카테고리 조회/수정/삭제 |
| GET/POST | `/api/tasks` | 할 일 목록/생성 |
| GET/PUT/DELETE | `/api/tasks/:id` | 할 일 조회/수정/삭제 |
| POST | `/api/tasks/:id/complete` | 할 일 완료 처리 |
| GET/POST | `/api/events` | 일정 목록/생성 |
| GET/PUT/DELETE | `/api/events/:id` | 일정 조회/수정/삭제 |
| GET/POST | `/api/timelogs` | 시간 기록 목록/생성 |
| GET/PUT/DELETE | `/api/timelogs/:id` | 시간 기록 조회/수정/삭제 |
| POST | `/api/timelogs/:id/stop` | 진행 중인 시간 기록 중지 |
| GET/PUT | `/api/settings` | 설정 조회/수정 |

---

## 사용 방법

1. 처음 실행 시 비밀번호 설정 화면이 표시됩니다
2. 비밀번호 설정 후 메인 화면으로 이동
3. **할 일 추가**: 하단 패널의 "＋ 할 일 추가" 버튼
4. **시간 기록 시작**: 할 일 탭에서 항목을 탭하고 "▶ 지금 시작"
5. **타임라인 클릭**: 빈 공간을 탭하면 시간 기록 또는 일정 추가 가능
6. **패널 크기 조절**: 하단 패널 상단의 핸들을 드래그
7. **설정**: 우측 상단 ⚙️ 버튼으로 수면 시간 설정

---

## 프로젝트 구조

```
├── backend/
│   ├── src/
│   │   ├── index.js          # Express 앱 진입점
│   │   ├── db.js             # SQLite DB 초기화
│   │   ├── routes/           # API 라우터
│   │   └── middleware/       # 인증 미들웨어
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # 메인 앱 컴포넌트
│   │   ├── api.ts            # API 클라이언트
│   │   ├── types.ts          # TypeScript 타입 정의
│   │   └── components/
│   │       ├── Timeline/     # 타임라인 컴포넌트
│   │       └── TaskPool/     # 할 일 풀 컴포넌트
│   ├── public/
│   │   ├── manifest.json     # PWA 매니페스트
│   │   └── sw.js             # 서비스 워커
│   └── Dockerfile
├── nginx/
│   └── nginx.conf.example    # Nginx 리버스 프록시 예시
├── docker-compose.yml
└── .env.example
```

---

## Nginx 리버스 프록시

`nginx/nginx.conf.example` 파일을 참고하여 HTTPS와 리버스 프록시를 설정할 수 있습니다.