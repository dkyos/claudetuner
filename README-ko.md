<p align="center">
  <img src="chrome-extension/icons/icon128.png" alt="Claude Tuner" width="80" />
</p>

<h1 align="center">Claude Tuner</h1>

<p align="center">
  Claude 사용량 한도를 실시간으로 추적 — Chat, Code, Cowork, Design 모든 제품 지원
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/chaehyun2/claudetuner" alt="License" /></a>
  <a href="README.md"><img src="https://img.shields.io/badge/lang-English-blue" alt="English" /></a>
</p>

> **개인용 로컬 서버 포크.** 이 포크는 클라우드(`api.claudetuner.com`) 대신 저장소에 포함된 로컬
> 백엔드 [`server/`](server/)(`http://localhost:3000`)로 동작하며, **Claude Code(CLI) 사용 분석**을
> 추가했습니다. 아래에 언급되는 클라우드 전용 항목(Chrome Web Store, 라이브 데모, 호스팅 팀
> 대시보드)은 원본(upstream) 프로젝트의 기능입니다.

---

<p align="center">
  <img src="docs/screenshots/dashboard-top.png" alt="대시보드 — 사용률 게이지, 플랜 적합도, 주간 트렌드" width="720" />
</p>

## 왜 Claude Tuner?

Claude의 사용량 한도는 불투명합니다 — 얼마나 썼는지, 언제 리셋되는지, 내 플랜이 맞는지 알 수 없습니다. Claude Tuner가 해결합니다.

- **한도 확인** — 5시간 / 7일 사용률 게이지 + 리셋 카운트다운
- **리셋 예측** — 윈도우 종료 전에 한도에 도달할지 미리 확인
- **최적 플랜 찾기** — Pro, Max 5x, Max 20x "만약에" 시뮬레이션
- **팀 모니터링** — 멤버별 사용량 분석, 초과 추적, 그룹 비교 무료 대시보드

## 스크린샷

| 사용량 트렌드 | 팀 대시보드 |
|:-:|:-:|
| ![5h/7d 사용량 트렌드 차트](docs/screenshots/dashboard-charts.png) | ![팀 개요 — 레이스 및 통계](docs/screenshots/team-overview.png) |

| 인사이트 | 멤버 분석 |
|:-:|:-:|
| ![전체 인사이트 — 플랜 및 사용률 분포](docs/screenshots/insights.png) | ![멤버별 사용량 분석](docs/screenshots/members.png) |

## 주요 기능

<details open>
<summary><b>실시간 사용량 모니터링</b></summary>

- 5시간 / 7일 사용률 게이지
- 리셋 카운트다운 타이머
- 툴바 배지로 현재 사용량 표시
- 6단계 속도 표시기 (safe → critical)
- 스파크라인 차트로 추세 확인
- 멀티 조직 지원 (자동 감지 또는 고정)
- 6개월(180일) 로컬 사용 히스토리
</details>

<details open>
<summary><b>스마트 알림 & 예측</b></summary>

- 현재 소비 속도 기반 리셋 시점 사용량 예측
- 임계값 알림 (80%, 95%)
- 주간 사용 리포트 (이메일)
- 모델별 토큰 사용량 추정 (Opus / Sonnet / Haiku)
- 피크 시간 표시기 (평일 12:00–18:00 UTC)
- 429 제한 실시간 감지
</details>

<details>
<summary><b>플랜 시뮬레이션 & 최적화</b></summary>

- "만약에" 시뮬레이션 (Pro / Max 5x / Max 20x)
- 플랜별 초과일 수 비교
- 업그레이드 / 다운그레이드 추천
- 비용 효율성 분석
</details>

<details>
<summary><b>플랜 적합도 점수</b></summary>

- 현재 구독의 적합도 한눈에 확인
- Claude Tuner 사용자 중 백분위 순위
- 사용량 분포 히스토그램
</details>

<details open>
<summary><b>Claude Code 사용 분석</b> — 이 포크</summary>

- `~/.claude/projects` transcript 로컬 스캔 (업로드 없음)
- 프로젝트별 / 세션별 분석 + 내 요청 중심 대화 뷰
- 토큰·비용 추정 (ccusage 방식: Opus / Sonnet / Haiku, cache write/read 분리)
- 사용 리뷰: 로컬 서버가 `claude` CLI(구독, API key 불필요)를 호출해 개선점 도출
</details>

<details>
<summary><b>시간대별 활동 히트맵</b></summary>

- 24×7 사용 패턴 히트맵
- 피크 시간대와 여유 시간대 파악
- 평일 vs 주말 비교
</details>

<details>
<summary><b>팀 대시보드</b> — 모든 멤버 무료</summary>

- 멤버별 사용량 분석 및 한도 초과 추적
- 토큰 사용량 리더보드 및 비용 분석
- 초과 추적 및 플랜 업/다운그레이드 추천
- 그룹별 사용량 비교 분석
- 일일 팀 리포트 및 주간 개인 리포트
- 학습 데이터 정책 모니터링
- 도메인 기반 자동 초대 및 그룹 관리 (관리자)
- CSV / Excel 내보내기
</details>

## 지원 플랜

| 플랜 | 5h 한도 | 7d 한도 | 추가 |
|------|---------|---------|------|
| Pro (1x) | ● | ● | — |
| Max 5x | ● | ● | — |
| Max 20x | ● | ● | — |
| Team Standard | ● | ● | — |
| Team Premium | ● | ● | — |
| Enterprise (seat-based) | ● | ● | Spending cap |
| Enterprise (usage-based) | — | — | Spending cap |

## 설치

### Chrome Web Store (권장)

<a href="https://chromewebstore.google.com/detail/claude-tuner/ajnnckikagphjbgpicpoffockabnhond">
  <img src="https://img.shields.io/badge/설치-Chrome_Web_Store-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Web Store에서 설치" />
</a>

### 수동 설치 (개발자 모드)

```bash
git clone https://github.com/chaehyun2/claudetuner.git
```

1. `chrome://extensions/` 열기
2. **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭 후 **`chrome-extension/`** 폴더 선택

## 작동 방식

```
사용자 ──→ Claude.ai ──→ Claude Tuner 확장 ──→ 로컬 서버 (server/)
                          (사용량 데이터 읽기)    localhost:3000 (히스토리 & 분석)
                                │
                                ▼
                          확장 팝업              로컬 대시보드
                        (게이지 & 알림)     (추세, 요금제 리뷰, Claude Code 분석)
```

1. **수집** — 확장이 Claude.ai에서 사용량 데이터를 읽습니다 (대화 내용은 절대 수집하지 않음)
2. **분석** — 스냅샷을 로컬 서버(`server/`)로 전송, 히스토리 저장 및 분석 수행
3. **표시** — 팝업에서 실시간 게이지를 보거나, [로컬 대시보드](http://localhost:3000/dashboard)에서 상세 분석 (먼저 `server/` 실행)

## 셀프 호스팅

이 포크는 이미 `http://localhost:3000`을 사용합니다. 포함된 서버를 실행하세요:

```bash
cd server && npm install && npm run dev
```

다른 호스트를 쓰려면 `chrome-extension/config.js`를 수정하세요(`chrome-extension/bg/constants.js`도 함께):

```js
const CT_CONFIG = {
  DEFAULT_SERVER_URL: 'http://localhost:3000',
  DEFAULT_API_KEY: 'your-api-key',
  SITE_URL: 'http://localhost:3000',
};
```

서버 API 명세는 [docs/API.md](docs/API.md)를 참조하세요.

## 개인정보 보호

- 대화 내용은 **절대 수집하지 않습니다** — 메시지, 파일, 프롬프트 없음
- 사용률, 리셋 시각, 플랜 정보, 조직 멤버십만 수집
- 이 포크에서는 모든 데이터가 내 컴퓨터에만 저장됩니다 — 로컬 서버(`server/data.sqlite`)와 브라우저 저장소. 저장을 위해 외부 서비스를 호출하지 않습니다.

<details>
<summary><b>아키텍처</b></summary>

```
chrome-extension/      MV3 확장 — chrome://extensions 에서 이 폴더를 로드
  popup.html/js        팝업 UI (사용량 게이지, 차트, 추천)
  options.html/js      설정 페이지 (주기, 알림, 조직 선택)
  background.js        Service worker (알람 스케줄링, 메시지 라우팅)
  bg/collect.js        메인 수집 엔진 (Claude.ai API -> 서버)
  bg/plan.js           플랜 감지, 변경 실행, 추천
  bg/api.js            Claude.ai API 래퍼 (듀얼 인증 fallback)
  bg/storage.js        Chrome storage 헬퍼
  bg/constants.js      설정 상수 (서버 URL, 180일 보존)
  config.js / i18n.js  중앙 설정 + 다국어
  page-script.js       Claude.ai에 주입 (페이지 인증으로 fetch)
  _locales/            영어 및 한국어 번역
server/                로컬 Next.js 백엔드 — API, 대시보드, Claude Code 분석
docs/                  docs/API.md (서버 명세) + 스크린샷
```

**빌드 스텝 없음** — 확장 파일은 번들러/트랜스파일 없는 순수 JS/HTML/CSS입니다.

</details>

## 기여

[CONTRIBUTING.md](CONTRIBUTING.md)를 참조하세요.

## 보안

[SECURITY.md](SECURITY.md)를 참조하세요.

## 라이선스

[MIT](LICENSE)

---

<sub>Claude Tuner는 Anthropic과 제휴하거나 보증받지 않습니다. 토큰 한도는 커뮤니티에서 관찰한 추정치이며 공식 수치가 아닙니다.</sub>
