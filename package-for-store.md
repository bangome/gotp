# Chrome Web Store 업로드 가이드

## 1. 개발자 계정 준비
1. Google 계정 필요
2. Chrome Web Store 개발자 계정 등록 ($5 일회성 등록비)
3. 등록 링크: https://chrome.google.com/webstore/devconsole/

## 2. 확장 프로그램 패키징

### 패키징할 파일들:
```
gotp/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/
│   └── content.js
├── background/
│   └── background.js
├── lib/
│   └── totp.js
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── privacy-policy.md (선택사항)
```

### 제외할 파일들:
- .git/
- .gitignore
- README.md
- package-for-store.md
- store-listing.md
- icons/generate-icons.html

## 3. ZIP 파일 생성 명령어

현재 디렉토리에서 실행:
```bash
# Windows PowerShell
Compress-Archive -Path manifest.json,popup,content,background,lib,icons -DestinationPath chrome-extension.zip

# 또는 수동으로 선택하여 압축
```

## 4. 업로드 전 체크리스트

### 필수 요구사항:
- ✅ manifest.json 유효성 확인
- ✅ 모든 아이콘 크기 준비 (16, 32, 48, 128px)
- ✅ 권한 최소화 확인
- ✅ 개인정보 보호정책 준비
- ✅ 스토어 설명 작성

### 테스트 완료:
- ✅ 로컬에서 정상 작동 확인
- ✅ OTP 생성 기능 테스트
- ✅ 자동 입력 기능 테스트
- ✅ 모든 브라우저 권한 확인

## 5. 스토어 등록 정보

### 기본 정보:
- **이름**: Google Authenticator for Chrome
- **카테고리**: Productivity
- **가격**: 무료
- **언어**: English, Korean

### 필요한 자료:
1. **스크린샷** (1280x800 권장, 최대 5개)
2. **프로모션 이미지** (440x280, 선택사항)
3. **상세 설명** (store-listing.md 참고)
4. **개인정보 보호정책 URL** (GitHub Pages 사용 가능)

## 6. 심사 과정
- 업로드 후 보통 1-3일 심사 기간
- 정책 위반 시 거부될 수 있음
- 승인 후 즉시 스토어에 게시

## 7. 업데이트 방법
- manifest.json의 version 번호 증가
- 새 ZIP 파일 업로드
- 변경사항 설명 작성 