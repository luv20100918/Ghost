# 렌터카 프로덕트 - 아키텍처 설계 문서

## 설계 에이전트 팀

| 에이전트 | 역할 | 담당 영역 |
|----------|------|-----------|
| 설계 Agent 1 | DB 아키텍트 | 데이터베이스 스키마, 마이그레이션 |
| 설계 Agent 2 | API 아키텍트 | REST API 엔드포인트, 직렬화 |
| 설계 Agent 3 | 서비스 아키텍트 | 비즈니스 로직, 결제 통합 |

---

## 1. 데이터베이스 스키마 설계

### 신규 테이블

```
vehicles                    - 차량 정보
vehicle_categories          - 차량 카테고리 (세단, SUV, 전기차 등)
vehicle_reservations        - 예약 정보
vehicle_reservation_events  - 예약 이벤트 추적
vehicle_pricing_rules       - 동적 가격 규칙
vehicle_reviews             - 차량 리뷰
```

### ERD 관계도

```
members ──1:N──> vehicle_reservations ──N:1──> vehicles
vehicles ──N:1──> vehicle_categories
vehicles ──1:N──> vehicle_reviews
vehicle_reservations ──1:N──> vehicle_reservation_events
vehicle_categories ──1:N──> vehicle_pricing_rules
```

---

## 2. API 엔드포인트 설계

### 관리자 API (Admin)
```
GET    /api/canary/vehicles                    - 차량 목록 조회
POST   /api/canary/vehicles                    - 차량 등록
GET    /api/canary/vehicles/:id                - 차량 상세 조회
PUT    /api/canary/vehicles/:id                - 차량 정보 수정
DELETE /api/canary/vehicles/:id                - 차량 삭제

GET    /api/canary/vehicle-categories          - 카테고리 목록
POST   /api/canary/vehicle-categories          - 카테고리 추가
PUT    /api/canary/vehicle-categories/:id      - 카테고리 수정
DELETE /api/canary/vehicle-categories/:id      - 카테고리 삭제

GET    /api/canary/vehicle-reservations        - 전체 예약 목록
GET    /api/canary/vehicle-reservations/:id    - 예약 상세
PUT    /api/canary/vehicle-reservations/:id    - 예약 상태 변경

GET    /api/canary/vehicle-analytics/stats     - 렌탈 통계
GET    /api/canary/vehicle-analytics/revenue   - 수익 분석
```

### 공개 API (Content)
```
GET    /api/canary/content/vehicles            - 이용 가능 차량 목록
GET    /api/canary/content/vehicles/:slug      - 차량 상세 (콘텐츠)
POST   /api/canary/content/vehicle-reservations - 예약 생성
GET    /api/canary/content/vehicles/:id/availability - 가용성 확인
```

---

## 3. 파일 구조

```
core/server/
├── data/schema/schema.js                    (스키마 확장)
├── models/
│   ├── vehicle.js                           (차량 모델)
│   ├── vehicle-category.js                  (카테고리 모델)
│   ├── vehicle-reservation.js               (예약 모델)
│   ├── vehicle-reservation-event.js         (예약 이벤트 모델)
│   ├── vehicle-pricing-rule.js              (가격 규칙 모델)
│   └── vehicle-review.js                    (리뷰 모델)
├── api/canary/
│   ├── vehicles.js                          (차량 API 컨트롤러)
│   ├── vehicle-categories.js                (카테고리 API)
│   ├── vehicle-reservations.js              (예약 API)
│   ├── vehicle-analytics.js                 (분석 API)
│   └── vehicles-public.js                   (공개 차량 API)
├── services/
│   └── car-rental/
│       ├── index.js                         (서비스 진입점)
│       ├── availability.js                  (가용성 엔진)
│       ├── pricing.js                       (동적 가격 엔진)
│       └── reservation-manager.js           (예약 관리)
└── web/api/canary/admin/routes.js           (라우트 확장)

docs/
├── car-rental-brainstorming.md              (브레인스토밍 결과)
├── car-rental-architecture.md               (이 문서)
└── car-rental-api-reference.md              (API 레퍼런스)

test/
└── unit/server/
    ├── models/
    │   ├── vehicle_spec.js
    │   └── vehicle-reservation_spec.js
    ├── api/canary/
    │   ├── vehicles_spec.js
    │   └── vehicle-reservations_spec.js
    └── services/car-rental/
        ├── availability_spec.js
        └── pricing_spec.js
```

---

## 4. 핵심 비즈니스 로직

### 가용성 엔진
- 날짜 범위 기반 차량 가용성 확인
- 겹치는 예약 자동 감지
- 정비 기간 제외 처리

### 동적 가격 엔진
- 기본 일일 요금 (차량별)
- 시즌 가격 승수 (성수기/비수기)
- 멤버십 등급별 할인율
- 장기 렌탈 할인

### 예약 생명주기
```
생성(created) → 확인(confirmed) → 진행중(active) → 반납(returned) → 완료(completed)
                                                          ↓
                                                    취소(cancelled)
```

---

## 5. Ghost 기존 시스템 통합

| 기존 시스템 | 통합 방식 |
|------------|----------|
| Members | 예약자는 Ghost 회원으로 관리 |
| Stripe | 결제 처리 (payment_intent) |
| Labels | 차량 태그 분류 |
| Events | 예약 이벤트 추적 |
| Email | 예약 확인/알림 이메일 |
| Settings | 렌탈 기능 설정값 |

날짜: 2026-04-05
