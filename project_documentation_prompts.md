# OneDM Studio 프로젝트 산출물 작성 AI 프롬프트 (최종 버전)

> **작성 기준일**: 2026-06-03  
> 현재 완성된 OneDM Studio 프로젝트의 실제 코드·아키텍처·DB 스키마를 100% 반영한 프롬프트입니다.  
> 각 프롬프트를 AI(ChatGPT, Claude 등)에 그대로 복사해서 붙여넣으면 됩니다.

---

## 1. 시스템 요구사항 정의서 (System Requirements Definition)

```text
당신은 IT 프로젝트의 전문 PM(Project Manager)입니다.
제가 개발을 완료한 'OneDM Studio' 프로젝트의 시스템 요구사항 정의서를 매우 상세하게 작성해 주세요.

[프로젝트 개요]
OneDM Studio는 사용자의 손글씨 사진 1장만으로 AI가 필체를 학습하여, 입력한 한글 텍스트를 해당 필체의 손글씨 이미지로 생성하는 웹 서비스입니다. 추가로 생성된 손글씨를 예쁜 엽서/편지지/청첩장 배경 위에 합성하여 '디지털 엽서(e-Card)'로 만들어 다운로드할 수 있습니다.

[기술 스택]
- Frontend: React 19, Vite 8, React Router v7
- Backend: FastAPI, Python 3.12, Uvicorn
- AI/ML: PyTorch, Diffusers (Stable Diffusion VAE), One-DM 모델 (UNet + Mix_TR 퓨전 인코더)
- Image Processing: OpenCV (cv2), Pillow (PIL), NumPy
- Database: SQLite + SQLAlchemy ORM
- Auth: JWT (python-jose), bcrypt

[기능적 요구사항 — 대분류/중분류/소분류로 세분화]

■ 대분류 1: 사용자 인증 및 관리
  - 중분류 1-1: 회원가입 (POST /api/register)
    - 소분류: username 중복 검증, bcrypt 비밀번호 해싱 후 DB 저장
  - 중분류 1-2: 로그인 (POST /api/login)
    - 소분류: OAuth2PasswordRequestForm 기반 인증, HS256 JWT 토큰 발급 (유효기간 7일)
  - 중분류 1-3: 인증 미들웨어
    - 소분류: Bearer 토큰 검증, 만료/위조 시 401 Unauthorized 반환

■ 대분류 2: 손글씨 이미지 생성 파이프라인
  - 중분류 2-1: 스타일 이미지 전처리 (OpenCV)
    - 소분류: Otsu Thresholding 이진화 (배경/그림자 제거)
    - 소분류: Laplacian 필터 엣지 추출 (ksize=3)
    - 소분류: 64xH 비율 유지 리사이징 + 64의 배수 패딩
  - 중분류 2-2: 텍스트 토큰화 (KoreanContentData)
    - 소분류: 한글 → 자모(Jamo) 분해 (초성/중성/종성), 자모 → Embedding Tensor 변환
  - 중분류 2-3: AI 모델 추론 (UNet + VAE)
    - 소분류: 스타일/라플라시안/자모 텐서를 조건으로 DDIM 50-step 샘플링
    - 소분류: Stable Diffusion VAE 디코딩 (잠재공간 → 픽셀)
    - 소분류: 서버 시작 시 최신 체크포인트 자동 감지 및 로드 (get_latest_checkpoint)
    - 소분류: 생성 요청 시 새 체크포인트 감지되면 모델 핫 리로드
  - 중분류 2-4: 이미지 포스트 프로세싱
    - 소분류: 단어별 이미지를 가로 병합 (띄어쓰기 16px 간격)
    - 소분류: MAX_WIDTH=800px 초과 시 자동 줄바꿈
    - 소분류: 세로 병합 (줄 간격 15px)
    - 소분류: Grayscale → RGBA 투명 배경 변환 (소프트 임계값 적용, 안티앨리어싱 보존)

■ 대분류 3: 디지털 엽서 (e-Card) 서비스
  - 중분류 3-1: 배경 템플릿 선택
    - 소분류: 3종 프리셋 제공 (빈티지 편지 / 청첩장 / 캐주얼 엽서) + '배경 없음' 옵션
  - 중분류 3-2: 엽서 미리보기
    - 소분류: 선택한 템플릿 위에 투명 손글씨 이미지를 CSS position overlay로 합성 프리뷰
  - 중분류 3-3: 엽서 다운로드
    - 소분류: Canvas API로 클라이언트 사이드 합성 (템플릿 + 손글씨 중앙 배치, 75%/70% 제한) → PNG 다운로드

■ 대분류 4: 갤러리 관리
  - 중분류 4-1: 생성 내역 조회 (GET /api/gallery)
    - 소분류: 사용자 ID 기반 최신순 정렬 조회, Base64 이미지 포함
  - 중분류 4-2: 갤러리 UI
    - 소분류: 투명 이미지 체크무늬(Checkered) 배경 표시, 클릭 시 모달 확대

[비기능적 요구사항]
- 성능: 단어 1개당 DDIM 50-step 생성 시간 ≤ 3초 (GPU 환경 기준)
- 보안: JWT 토큰 만료 검증, bcrypt 해싱, CORS 허용 설정
- 가용성: 서버 재시작 시 최신 체크포인트 자동 감지 및 모델 자동 로드
- 확장성: Vite 프록시 설정으로 프론트/백엔드 분리 운영 가능
- 사용성: 한국어 UI, 모바일 반응형 레이아웃

위 내용을 바탕으로 요구사항 ID(예: FR-01-01, NFR-01), 요구사항 명, 상세 설명, 입력/출력, 중요도(상/중/하)가 포함된 마크다운 표로 작성해 주세요.
기능적 요구사항은 대분류 > 중분류 > 소분류 체계로, 비기능적 요구사항은 별도 섹션으로 분리해 주세요.
```

---

## 2. 유즈케이스 다이어그램 (Use Case Diagram)

```text
당신은 시스템 아키텍트입니다.
'OneDM Studio' 프로젝트의 유즈케이스 다이어그램을 **Mermaid.js 문법 (graph TD 형식)**으로 작성해 주세요.

[액터(Actor)]
- User (일반 사용자 — 프론트엔드 접속)
- System (FastAPI 백엔드 — 내부 자동 처리)

[유즈케이스 세분화]

★ 사용자 관리 영역
  - UC-01: 회원가입 (username, password 입력 → bcrypt 해싱 → DB 저장)
  - UC-02: 로그인 (OAuth2 인증 → JWT 토큰 발급)
  - UC-03: 로그아웃 (클라이언트 토큰 삭제)

★ 손글씨 생성 영역 (핵심)
  - UC-04: 텍스트 입력 (여러 줄 한글 문장 입력)
  - UC-05: 스타일 이미지 업로드 (사용자 손글씨 사진)
  - UC-06: 엽서 배경 템플릿 선택 (빈티지/청첩장/캐주얼/없음 — <<extend>>)
  - UC-07: 생성 요청 (UC-04, UC-05 완료 후 실행 — UC-04, UC-05를 <<include>>)
  - UC-08: 이미지 전처리 (Otsu 이진화 + Laplacian 엣지 — UC-07에 <<include>>)
  - UC-09: 자모 토큰화 (한글 → Jamo 분해 — UC-07에 <<include>>)
  - UC-10: DDIM 모델 추론 (단어 단위 생성 — UC-07에 <<include>>)
  - UC-11: 이미지 병합 및 투명 배경 변환 (가로/세로 Stitching + RGBA 변환 — UC-07에 <<include>>)

★ e-Card 영역
  - UC-12: 엽서 미리보기 (템플릿 + 투명 손글씨 오버레이 — UC-06 선택 시 <<extend>>)
  - UC-13: 엽서/이미지 다운로드 (Canvas 합성 → PNG 저장)

★ 갤러리 영역
  - UC-14: 생성 내역 조회 (사용자별 이미지 히스토리 최신순)
  - UC-15: 이미지 확대 보기 (모달 팝업)

[관계 정리]
- User → UC-01, UC-02, UC-04, UC-05, UC-06, UC-07, UC-13, UC-14, UC-15
- UC-07 --<<include>>--> UC-04, UC-05, UC-08, UC-09, UC-10, UC-11
- UC-07 --<<extend>>--> UC-06
- UC-06 --<<extend>>--> UC-12
- System → UC-08, UC-09, UC-10, UC-11

위 구조를 Mermaid graph TD 문법으로 작성해 주세요.
- 액터는 별도 스타일(🧑 User, ⚙️ System)로 표시
- <<include>>와 <<extend>> 관계가 화살표 라벨로 명확히 보여야 합니다.
- 영역별로 subgraph로 묶어 주세요.
```

---

## 3. 시스템 아키텍처 (DA / BA / TA 분리)

```text
당신은 시니어 시스템 아키텍트입니다.
'OneDM Studio' 프로젝트의 시스템 아키텍처를 **DA(Data Architecture)**, **BA(Business Architecture)**, **TA(Technical Architecture)** 세 가지 관점으로 나누어 작성해 주세요. 각 아키텍처는 **Mermaid.js 다이어그램 코드**와 함께 **표(Table) 형태의 설명**을 포함해야 합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[프로젝트 실제 구조 정보]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 파일 구조:
OneDM_Web/
├── backend/
│   ├── main.py          ← FastAPI 앱 (모든 API 엔드포인트 + AI 추론 로직)
│   ├── auth.py          ← JWT 인증 (bcrypt 해싱, OAuth2, 토큰 검증)
│   ├── database.py      ← SQLAlchemy 엔진/세션 설정 (SQLite)
│   ├── db_models.py     ← ORM 모델 (User, ImageRecord)
│   ├── schemas.py       ← Pydantic 스키마 (UserCreate, Token, ImageRecordResponse)
│   └── onedm.db         ← SQLite 데이터베이스 파일
├── frontend/
│   ├── src/
│   │   ├── App.jsx      ← React SPA (AuthProvider, Login, Register, Generator, Gallery, Layout)
│   │   ├── index.css    ← 전체 스타일시트 (glassmorphism 디자인)
│   │   └── main.jsx     ← React DOM 엔트리포인트
│   ├── public/templates/ ← 엽서 배경 이미지 (vintage.png, wedding.png, cute.png)
│   └── vite.config.js   ← Vite 설정 + /api 프록시 → localhost:8000
└── One_DM/              ← AI 모델 코어 (별도 디렉토리)
    ├── models/           ← UNet, Diffusion, Mix_TR 퓨전 인코더
    ├── data_loader/      ← KoreanDataset, KoreanContentData
    ├── configs/          ← Korean64.yml (모델 하이퍼파라미터)
    └── Saved/Korean64/   ← 학습 체크포인트 저장소

■ DB 테이블:
1. users: id(PK, INTEGER), username(UNIQUE, VARCHAR), password_hash(VARCHAR)
2. images: id(PK, INTEGER), word(VARCHAR), image_base64(TEXT), created_at(DATETIME), user_id(FK → users.id)

■ API 엔드포인트:
POST /api/register   → 회원가입 (UserCreate → UserResponse)
POST /api/login      → 로그인 (OAuth2Form → Token)
GET  /api/gallery    → 갤러리 조회 (JWT 필수 → ImageRecordResponse[])
POST /api/generate   → 손글씨 생성 (word + style_image → {image_base64, word})

■ AI 모델 파이프라인:
입력: (텍스트, 스타일 이미지) 
→ OpenCV 전처리 (Otsu 이진화 + Laplacian 엣지 + 64xH 리사이징)
→ 자모 분해 토큰화 (KoreanContentData)
→ 단어별 루프: DDIM 50-step 샘플링 + VAE 디코딩
→ 이미지 병합 (자동 줄바꿈) + RGBA 투명 배경 변환
→ Base64 인코딩 → DB 저장 + 클라이언트 응답

■ 프론트엔드 컴포넌트:
AuthProvider (전역 토큰 상태) → Login / Register / Generator / Gallery
Generator: 텍스트 입력 + 스타일 업로드 + 템플릿 선택 → 생성 요청 → 결과 모달(오버레이 프리뷰 + Canvas 다운로드)
Gallery: 이미지 그리드 + 모달 확대

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[요청 산출물 형식]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### DA (Data Architecture)
- **ERD**: users ↔ images 관계를 Mermaid erDiagram으로 작성 (컬럼명, 타입, PK/FK 모두 포함)
- **데이터 흐름도**: 사용자 입력 → 전처리 → 모델 → 후처리 → 저장 경로를 Mermaid flowchart로
- **데이터 사전 표**: 각 테이블의 컬럼명, 데이터 타입, 제약조건, 설명을 마크다운 표로

### BA (Business Architecture)
- **비즈니스 프로세스 흐름도**: 사용자 관점에서 회원가입 → 로그인 → 생성 → 엽서 만들기 → 갤러리 확인까지의 End-to-End 프로세스를 Mermaid flowchart로
- **비즈니스 규칙 표**: 각 프로세스 단계별 비즈니스 규칙(예: "username은 고유해야 함", "JWT 만료 시 401 반환", "MAX_WIDTH 800px 초과 시 줄바꿈" 등)을 마크다운 표로

### TA (Technical Architecture)
- **시스템 구성도**: Frontend(React/Vite) ↔ Proxy ↔ Backend(FastAPI) ↔ DB(SQLite), AI Model(PyTorch/CUDA) 간의 관계를 Mermaid 아키텍처 다이어그램으로
- **기술 스택 표**: 계층(Presentation/Application/Data/AI), 기술명, 버전, 역할을 마크다운 표로
- **배포 구성도**: 개발 환경 기준으로 Vite dev server(:5173) → proxy → Uvicorn(:8000) → SQLite 파일, GPU 서버 → 체크포인트 로드 구조를 Mermaid로

각 섹션(DA/BA/TA)마다 Mermaid 다이어그램 코드 + 설명 표를 함께 제공해 주세요.
```

---

## 4. DB 생성 스크립트 (DDL)

```text
당신은 DBA(Database Administrator)입니다.
'OneDM Studio' 프로젝트의 데이터베이스 생성 스크립트(DDL)를 SQL 문법으로 작성해 주세요.
실제 운영 환경 수준의 완성도로 작성해야 하며, 테이블 생성문뿐만 아니라 인덱스, 제약조건, 초기 데이터(선택), 그리고 각 항목에 대한 한국어 주석을 포함해야 합니다.

[현재 구현된 실제 DB 스키마 — SQLAlchemy ORM 기반]

DBMS: SQLite 3
파일: onedm.db
ORM: SQLAlchemy (declarative_base)

■ 테이블 1: users (사용자)
| 컬럼명         | 타입     | 제약조건                  | 설명 |
|----------------|----------|--------------------------|------|
| id             | INTEGER  | PRIMARY KEY, AUTOINCREMENT | 사용자 고유 ID |
| username       | VARCHAR  | UNIQUE, NOT NULL, INDEX   | 로그인 아이디 |
| password_hash  | VARCHAR  | NOT NULL                  | bcrypt 해싱된 비밀번호 |

■ 테이블 2: images (생성된 손글씨 이미지 기록)
| 컬럼명         | 타입     | 제약조건                        | 설명 |
|----------------|----------|--------------------------------|------|
| id             | INTEGER  | PRIMARY KEY, AUTOINCREMENT      | 이미지 고유 ID |
| word           | VARCHAR  | NOT NULL, INDEX                 | 생성 요청 텍스트 |
| image_base64   | TEXT     | NOT NULL                        | 생성된 이미지 (Base64 PNG, RGBA 투명 배경) |
| created_at     | DATETIME | DEFAULT CURRENT_TIMESTAMP       | 생성 일시 (UTC) |
| user_id        | INTEGER  | FOREIGN KEY → users(id), NOT NULL | 생성 요청 사용자 |

■ 관계: users 1:N images (한 사용자가 여러 이미지를 생성)

[요청 산출물]

1. **CREATE TABLE 문** (SQLite 문법 기준)
   - 각 컬럼에 한국어 주석(-- 설명) 포함
   - PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL, DEFAULT 제약조건 모두 명시
   - ON DELETE CASCADE 적용 여부를 판단하여 적용

2. **CREATE INDEX 문**
   - username 검색 인덱스 (로그인 시 사용)
   - word 검색 인덱스 (갤러리 필터링용)
   - user_id + created_at 복합 인덱스 (사용자별 최신순 조회 최적화)

3. **INSERT 샘플 데이터** (테스트용 2명의 사용자, 각 1건의 이미지 기록 — image_base64는 '[PLACEHOLDER]'로 대체)

4. **주요 조회 쿼리 예시**
   - 로그인 시 사용자 조회
   - 특정 사용자의 생성 기록 최신순 조회
   - 전체 사용자 수 및 총 생성 이미지 수 통계 조회

5. **테이블 DROP 문** (재생성 시 사용)

위 내용을 하나의 완성된 SQL 스크립트 파일(.sql)로 작성해 주세요. 각 섹션은 주석 블록(/* */)으로 구분하고, 실행 순서에 맞게 정렬해 주세요.
```

---

## 💡 사용 가이드

### 프롬프트 사용 순서
1. **시스템 요구사항 정의서** → 프로젝트의 기능 명세를 확정
2. **유즈케이스 다이어그램** → 사용자-시스템 상호작용을 시각화
3. **시스템 아키텍처 (DA/BA/TA)** → 기술적 구조를 체계적으로 문서화
4. **DB 생성 스크립트** → 데이터 계층의 구현 명세를 확정

### Mermaid 코드 → 이미지 변환
1. AI가 생성한 ````mermaid ... ```` 코드를 복사
2. [Mermaid Live Editor](https://mermaid.live/) 접속
3. 좌측에 붙여넣기 → 우측에 다이어그램 즉시 렌더링
4. PNG/SVG 다운로드 → 보고서에 삽입
