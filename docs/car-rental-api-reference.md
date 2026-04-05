# 렌터카 API 레퍼런스

## 개요

Ghost CMS 렌터카 프로덕트의 REST API 레퍼런스 문서입니다.
모든 관리자 API는 인증이 필요하며, `/api/canary/` 접두사를 사용합니다.

---

## 차량 관리 API

### 차량 목록 조회
```
GET /api/canary/vehicles
```

**매개변수:**
| 이름 | 타입 | 설명 |
|------|------|------|
| include | string | 포함할 관계: `category`, `count.reservations`, `count.reviews` |
| filter | string | 필터 조건 (예: `status:available+fuel_type:electric`) |
| limit | number | 페이지당 결과 수 (기본: 15) |
| page | number | 페이지 번호 |
| order | string | 정렬 (예: `daily_rate asc`) |
| search | string | 이름, 제조사, 모델, 번호판 검색 |

**응답 예시:**
```json
{
  "vehicles": [
    {
      "id": "60d5f9a12345678901234567",
      "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "테슬라 모델 3",
      "slug": "tesla-model-3",
      "description": "전기 세단, 오토파일럿 포함",
      "category_id": "60d5f9a12345678901234568",
      "make": "Tesla",
      "model": "Model 3",
      "year": 2024,
      "color": "화이트",
      "license_plate": "12가3456",
      "fuel_type": "electric",
      "seats": 5,
      "transmission": "automatic",
      "daily_rate": 8900,
      "status": "available",
      "location": "서울 강남 지점",
      "feature_image": "/content/images/vehicles/tesla-model3.jpg"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 15,
      "pages": 3,
      "total": 42
    }
  }
}
```

### 차량 등록
```
POST /api/canary/vehicles
```

**요청 본문:**
```json
{
  "vehicles": [{
    "name": "현대 아이오닉 6",
    "category_id": "카테고리ID",
    "make": "Hyundai",
    "model": "Ioniq 6",
    "year": 2025,
    "color": "네이비",
    "license_plate": "23나5678",
    "fuel_type": "electric",
    "seats": 5,
    "transmission": "automatic",
    "daily_rate": 7500,
    "location": "서울 서초 지점",
    "description": "장거리 전기 세단"
  }]
}
```

### 차량 상세 조회
```
GET /api/canary/vehicles/:id
GET /api/canary/vehicles/slug/:slug
```

### 차량 수정
```
PUT /api/canary/vehicles/:id
```

### 차량 삭제
```
DELETE /api/canary/vehicles/:id
```

---

## 차량 카테고리 API

### 카테고리 목록
```
GET /api/canary/vehicle-categories
```

### 카테고리 추가
```
POST /api/canary/vehicle-categories
```

**요청 본문:**
```json
{
  "vehicle_categories": [{
    "name": "전기차",
    "description": "환경 친화적 전기 차량",
    "image": "/content/images/categories/electric.jpg"
  }]
}
```

### 카테고리 수정 / 삭제
```
PUT /api/canary/vehicle-categories/:id
DELETE /api/canary/vehicle-categories/:id
```

---

## 예약 API

### 예약 목록 조회
```
GET /api/canary/vehicle-reservations
```

**매개변수:**
| 이름 | 타입 | 설명 |
|------|------|------|
| include | string | `vehicle`, `member`, `events` |
| filter | string | 예: `status:confirmed+member_id:xxx` |

### 예약 생성
```
POST /api/canary/vehicle-reservations
```

**요청 본문:**
```json
{
  "vehicle_reservations": [{
    "vehicle_id": "차량ID",
    "member_id": "회원ID",
    "pickup_date": "2026-05-01T10:00:00.000Z",
    "return_date": "2026-05-05T10:00:00.000Z",
    "pickup_location": "서울 강남 지점",
    "return_location": "서울 강남 지점",
    "notes": "차량 시트 클리닝 요청"
  }]
}
```

**응답 예시:**
```json
{
  "vehicle_reservations": [{
    "id": "예약ID",
    "uuid": "uuid-value",
    "vehicle_id": "차량ID",
    "member_id": "회원ID",
    "status": "pending",
    "pickup_date": "2026-05-01T10:00:00.000Z",
    "return_date": "2026-05-05T10:00:00.000Z",
    "daily_rate": 8900,
    "total_amount": 35600,
    "currency": "usd",
    "discount_amount": 0,
    "stripe_payment_intent_id": null
  }]
}
```

### 예약 상태 변경
```
PUT /api/canary/vehicle-reservations/:id
```

**상태 전이 규칙:**
```
pending    → confirmed, cancelled
confirmed  → active, cancelled
active     → returned, cancelled
returned   → completed
completed  → (최종 상태)
cancelled  → (최종 상태)
```

### 예약 통계
```
GET /api/canary/vehicle-reservations/stats
```

---

## 분석 API

### 전체 통계
```
GET /api/canary/vehicle-analytics/stats
```

**응답 예시:**
```json
{
  "stats": {
    "vehicles": {
      "total": 42,
      "available": 35,
      "rented": 5,
      "maintenance": 2
    },
    "reservations": {
      "total": 156,
      "active": 5,
      "completed": 120,
      "cancelled": 15
    },
    "revenue": {
      "total": 4850000,
      "average_per_reservation": 32333,
      "currency": "usd"
    }
  }
}
```

### 수익 분석
```
GET /api/canary/vehicle-analytics/revenue
```

---

## 공개 API (Content API)

인증 없이 접근 가능한 차량 목록 API입니다.

### 이용 가능 차량 목록
```
GET /api/canary/content/vehicles?key=CONTENT_API_KEY
```

### 차량 상세 (슬러그)
```
GET /api/canary/content/vehicles/slug/:slug?key=CONTENT_API_KEY
```

---

## 서비스 레이어

### 가용성 엔진 (`car-rental/availability`)
- `checkVehicleAvailability(vehicleId, pickupDate, returnDate)` - 차량 가용성 확인
- `findAvailableVehicles(pickupDate, returnDate, options)` - 이용 가능 차량 검색
- `getVehicleCalendar(vehicleId, startDate, endDate)` - 예약 캘린더 조회

### 가격 엔진 (`car-rental/pricing`)
- `calculatePrice({vehicleId, pickupDate, returnDate, memberId})` - 가격 계산
- `getPriceRange(categoryId)` - 카테고리별 가격 범위

### 예약 관리자 (`car-rental/reservation-manager`)
- `createReservation(data, options)` - 예약 생성 (가용성 확인 + 가격 계산 통합)
- `updateStatus(reservationId, newStatus, details)` - 상태 전이
- `getMemberReservations(memberId, options)` - 회원 예약 이력
- `getStats()` - 통계 조회

---

## 오류 코드

| HTTP 코드 | 의미 | 예시 |
|-----------|------|------|
| 400 | 잘못된 요청 | 유효하지 않은 날짜, 필수 필드 누락 |
| 401 | 인증 필요 | API 키 누락 |
| 404 | 리소스 없음 | 존재하지 않는 차량/예약 |
| 409 | 충돌 | 예약 기간 겹침 |
| 422 | 검증 실패 | 잘못된 상태 전이, 중복 번호판 |

---

날짜: 2026-04-05
