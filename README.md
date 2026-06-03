# OneDM Studio (손글씨 e-Card 생성기)

OneDM AI 모델을 활용하여 사용자의 손글씨 스타일을 모방하고, 입력한 텍스트로 커스텀 e-Card 엽서를 만들어주는 웹 서비스입니다.

## 🚀 시작하기 (Getting Started)

이 프로젝트는 Git에 업로드될 때 용량이 크거나 보안에 민감한 파일들(`node_modules`, 가상환경, DB 파일 등)을 제외(.gitignore)하고 올라갑니다. 
따라서 저장소(Repository)를 다운로드(Clone) 받은 후, 아래의 과정을 거쳐 실행 환경을 다시 세팅해야 합니다.

### 1. 프로젝트 다운로드
```bash
git clone https://github.com/gyoon0718-ui/unstructuredDataProject.git
cd unstructuredDataProject
```

### 2. 백엔드 (Backend) 세팅 및 실행
백엔드는 Python(FastAPI)으로 구성되어 있습니다. `requirements.txt`를 통해 필요한 라이브러리를 설치하고 DB를 자동 생성합니다.

```bash
# 백엔드 폴더로 이동
cd backend

# 1) 가상환경 생성 (선택사항이지만 권장)
python -m venv venv

# 2) 가상환경 활성화
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 3) 필수 라이브러리 설치 (가장 중요 ⭐)
pip install -r requirements.txt

# 4) 백엔드 서버 실행 (실행 시 onedm.db 파일이 자동으로 생성됩니다)
python main.py
# 또는
uvicorn main:app --reload
```

### 3. 프론트엔드 (Frontend) 세팅 및 실행
프론트엔드는 React(Vite)로 구성되어 있습니다. `package.json`을 통해 필요한 노드 모듈들을 다운로드합니다.

```bash
# (새로운 터미널 창을 열고) 프론트엔드 폴더로 이동
cd frontend

# 1) 필수 노드 패키지 다운로드 (이 명령어가 node_modules 폴더를 재생성합니다 ⭐)
npm install

# 2) 프론트엔드 개발 서버 실행
npm run dev
```

## 📝 파일 구조 설명
* `/backend/requirements.txt`: 백엔드 실행에 필요한 파이썬 패키지 목록 (가상환경 복구용)
* `/frontend/package.json`: 프론트엔드 실행에 필요한 라이브러리 목록 (node_modules 복구용)
* `/backend/main.py`: 최초 실행 시 `.gitignore`로 제외된 `onedm.db` 파일을 자동으로 초기화하고 생성하는 로직이 포함되어 있습니다.
