/**
 * 동적 가격 엔진
 * 기본 요금, 시즌 가격, 멤버십 할인, 장기 렌탈 할인 적용
 */
const models = require('../../models');
const moment = require('moment-timezone');

class PricingEngine {
    /**
     * 렌탈 총 비용을 계산합니다
     * @param {Object} params
     * @param {string} params.vehicleId - 차량 ID
     * @param {Date} params.pickupDate - 인수일
     * @param {Date} params.returnDate - 반납일
     * @param {string} [params.memberId] - 회원 ID (멤버십 할인 적용)
     * @returns {Promise<Object>} 가격 상세 내역
     */
    async calculatePrice(params) {
        const {vehicleId, pickupDate, returnDate, memberId} = params;
        const pickup = moment(pickupDate);
        const returnD = moment(returnDate);
        const rentalDays = Math.max(1, returnD.diff(pickup, 'days'));

        // 차량 기본 요금 조회
        const vehicle = await models.Vehicle.findOne({id: vehicleId});
        if (!vehicle) {
            throw new Error('차량을 찾을 수 없습니다.');
        }

        const dailyRate = vehicle.get('daily_rate');
        const categoryId = vehicle.get('category_id');
        let baseAmount = dailyRate * rentalDays;

        // 적용 가능한 가격 규칙 조회
        const rules = await this.getApplicableRules(vehicleId, categoryId, pickupDate, returnDate, rentalDays, memberId);

        // 규칙 적용 (우선순위 순)
        let totalMultiplier = 1.0;
        let totalDiscountPercent = 0;
        const appliedRules = [];

        for (const rule of rules) {
            const multiplier = parseFloat(rule.multiplier) || 1.0;
            const discountPercent = rule.discount_percent || 0;

            totalMultiplier *= multiplier;
            totalDiscountPercent += discountPercent;

            appliedRules.push({
                rule_id: rule.id,
                name: rule.name,
                type: rule.rule_type,
                multiplier: multiplier,
                discount_percent: discountPercent
            });
        }

        // 최대 할인율 제한 (70%)
        totalDiscountPercent = Math.min(totalDiscountPercent, 70);

        // 최종 금액 계산
        let adjustedAmount = Math.round(baseAmount * totalMultiplier);
        const discountAmount = Math.round(adjustedAmount * (totalDiscountPercent / 100));
        const totalAmount = adjustedAmount - discountAmount;

        return {
            vehicle_id: vehicleId,
            daily_rate: dailyRate,
            rental_days: rentalDays,
            base_amount: baseAmount,
            multiplier: totalMultiplier,
            discount_percent: totalDiscountPercent,
            discount_amount: discountAmount,
            total_amount: Math.max(0, totalAmount),
            currency: 'usd',
            applied_rules: appliedRules,
            breakdown: {
                기본요금: `${dailyRate} x ${rentalDays}일 = ${baseAmount}`,
                시즌조정: `x${totalMultiplier.toFixed(2)} = ${adjustedAmount}`,
                할인: `-${totalDiscountPercent}% = -${discountAmount}`,
                최종금액: totalAmount
            }
        };
    }

    /**
     * 적용 가능한 가격 규칙을 조회합니다
     */
    async getApplicableRules(vehicleId, categoryId, pickupDate, returnDate, rentalDays, memberId) {
        const knex = models.Base.knex;
        const now = moment().toDate();

        let query = knex('vehicle_pricing_rules')
            .where('is_active', true)
            .where(function () {
                this.whereNull('start_date').orWhere('start_date', '<=', now);
            })
            .where(function () {
                this.whereNull('end_date').orWhere('end_date', '>=', now);
            })
            .where(function () {
                // 차량별 또는 카테고리별 또는 전체 적용 규칙
                this.where('vehicle_id', vehicleId)
                    .orWhere('category_id', categoryId)
                    .orWhere(function () {
                        this.whereNull('vehicle_id').whereNull('category_id');
                    });
            })
            .orderBy('priority', 'desc');

        const rules = await query;

        // 조건 필터링
        return rules.filter(rule => {
            // 기간 조건 확인
            if (rule.min_days && rentalDays < rule.min_days) return false;
            if (rule.max_days && rentalDays > rule.max_days) return false;

            // 멤버십 조건 확인
            if (rule.member_status && memberId) {
                // 멤버 상태 확인은 나중에 구현
                return true;
            }

            return true;
        });
    }

    /**
     * 차량 카테고리별 가격 범위를 반환합니다
     */
    async getPriceRange(categoryId) {
        const knex = models.Base.knex;

        const result = await knex('vehicles')
            .where('category_id', categoryId)
            .where('status', 'available')
            .select(
                knex.raw('MIN(daily_rate) as min_rate'),
                knex.raw('MAX(daily_rate) as max_rate'),
                knex.raw('AVG(daily_rate) as avg_rate'),
                knex.raw('COUNT(*) as vehicle_count')
            )
            .first();

        return {
            category_id: categoryId,
            min_daily_rate: result.min_rate || 0,
            max_daily_rate: result.max_rate || 0,
            avg_daily_rate: Math.round(result.avg_rate || 0),
            available_vehicles: result.vehicle_count || 0
        };
    }
}

module.exports = new PricingEngine();
