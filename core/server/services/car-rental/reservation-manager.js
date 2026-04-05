/**
 * 예약 관리자
 * 예약 생명주기 관리: 생성 -> 확인 -> 진행 -> 반납 -> 완료
 */
const models = require('../../models');
const moment = require('moment-timezone');
const errors = require('@tryghost/errors');
const ObjectId = require('bson-objectid');
const uuid = require('uuid');
const availabilityEngine = require('./availability');
const pricingEngine = require('./pricing');

class ReservationManager {
    /**
     * 새 예약을 생성합니다
     * @param {Object} data - 예약 데이터
     * @param {Object} options - 옵션 (transacting 등)
     * @returns {Promise<Object>} 생성된 예약
     */
    async createReservation(data, options = {}) {
        const {vehicle_id, member_id, pickup_date, return_date, pickup_location, return_location, notes} = data;

        // 1. 가용성 확인
        const availability = await availabilityEngine.checkVehicleAvailability(
            vehicle_id, pickup_date, return_date
        );

        if (!availability.available) {
            throw new errors.ConflictError({
                message: availability.reason || '해당 기간에 차량을 이용할 수 없습니다.',
                context: JSON.stringify(availability.conflicts)
            });
        }

        // 2. 가격 계산
        const pricing = await pricingEngine.calculatePrice({
            vehicleId: vehicle_id,
            pickupDate: pickup_date,
            returnDate: return_date,
            memberId: member_id
        });

        // 3. 예약 생성
        const reservationData = {
            id: ObjectId.generate(),
            uuid: uuid.v4(),
            vehicle_id,
            member_id,
            status: 'pending',
            pickup_date: moment(pickup_date).toDate(),
            return_date: moment(return_date).toDate(),
            pickup_location: pickup_location || null,
            return_location: return_location || null,
            daily_rate: pricing.daily_rate,
            total_amount: pricing.total_amount,
            currency: pricing.currency,
            discount_amount: pricing.discount_amount,
            notes: notes || null
        };

        const reservation = await models.VehicleReservation.add(reservationData, options);

        // 4. 예약 이벤트 기록
        await this.recordEvent(reservation.get('id'), 'created', {
            pricing_details: pricing,
            created_by: member_id
        }, options);

        return {
            reservation,
            pricing
        };
    }

    /**
     * 예약 상태를 변경합니다
     */
    async updateStatus(reservationId, newStatus, details = {}, options = {}) {
        const validTransitions = {
            pending: ['confirmed', 'cancelled'],
            confirmed: ['active', 'cancelled'],
            active: ['returned', 'cancelled'],
            returned: ['completed'],
            completed: [],
            cancelled: []
        };

        const reservation = await models.VehicleReservation.findOne({id: reservationId});
        if (!reservation) {
            throw new errors.NotFoundError({
                message: '예약을 찾을 수 없습니다.'
            });
        }

        const currentStatus = reservation.get('status');
        if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
            throw new errors.ValidationError({
                message: `'${currentStatus}' 상태에서 '${newStatus}'(으)로 변경할 수 없습니다. 허용: ${validTransitions[currentStatus].join(', ')}`
            });
        }

        // 상태 업데이트
        const updateData = {status: newStatus};

        if (newStatus === 'returned' || newStatus === 'completed') {
            updateData.actual_return_date = moment().toDate();
        }

        await models.VehicleReservation.edit(updateData, {
            ...options,
            id: reservationId
        });

        // 이벤트 기록
        await this.recordEvent(reservationId, `status_changed_to_${newStatus}`, {
            from_status: currentStatus,
            to_status: newStatus,
            ...details
        }, options);

        // 차량 상태 업데이트
        const vehicleId = reservation.get('vehicle_id');
        if (newStatus === 'active') {
            await models.Vehicle.edit({status: 'rented'}, {...options, id: vehicleId});
        } else if (newStatus === 'returned' || newStatus === 'completed' || newStatus === 'cancelled') {
            await models.Vehicle.edit({status: 'available'}, {...options, id: vehicleId});
        }

        return models.VehicleReservation.findOne({id: reservationId});
    }

    /**
     * 예약 이벤트를 기록합니다
     */
    async recordEvent(reservationId, eventType, details = {}, options = {}) {
        return models.VehicleReservationEvent.add({
            id: ObjectId.generate(),
            reservation_id: reservationId,
            event_type: eventType,
            details: JSON.stringify(details)
        }, options);
    }

    /**
     * 회원의 예약 이력을 조회합니다
     */
    async getMemberReservations(memberId, options = {}) {
        return models.VehicleReservation.findPage({
            ...options,
            filter: `member_id:${memberId}`,
            withRelated: ['vehicle', 'events']
        });
    }

    /**
     * 예약 통계를 조회합니다
     */
    async getStats() {
        const knex = models.Base.knex;

        const [totalStats, statusBreakdown, revenueStats] = await Promise.all([
            knex('vehicle_reservations').count('id as total').first(),
            knex('vehicle_reservations')
                .select('status')
                .count('id as count')
                .groupBy('status'),
            knex('vehicle_reservations')
                .whereIn('status', ['confirmed', 'active', 'returned', 'completed'])
                .select(
                    knex.raw('SUM(total_amount) as total_revenue'),
                    knex.raw('AVG(total_amount) as avg_revenue'),
                    knex.raw('COUNT(id) as paid_count')
                )
                .first()
        ]);

        return {
            total_reservations: totalStats.total || 0,
            status_breakdown: statusBreakdown.reduce((acc, row) => {
                acc[row.status] = row.count;
                return acc;
            }, {}),
            revenue: {
                total: revenueStats.total_revenue || 0,
                average: Math.round(revenueStats.avg_revenue || 0),
                paid_count: revenueStats.paid_count || 0
            }
        };
    }
}

module.exports = new ReservationManager();
