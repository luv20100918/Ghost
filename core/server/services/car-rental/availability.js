/**
 * 차량 가용성 엔진
 * 날짜 범위 기반 차량 가용성 확인 및 충돌 검사
 */
const models = require('../../models');
const moment = require('moment-timezone');
const errors = require('@tryghost/errors');

class AvailabilityEngine {
    /**
     * 특정 차량의 가용성을 확인합니다
     * @param {string} vehicleId - 차량 ID
     * @param {Date} pickupDate - 인수 희망일
     * @param {Date} returnDate - 반납 희망일
     * @param {string} [excludeReservationId] - 제외할 예약 ID (수정 시)
     * @returns {Promise<{available: boolean, conflicts: Array}>}
     */
    async checkVehicleAvailability(vehicleId, pickupDate, returnDate, excludeReservationId = null) {
        const pickup = moment(pickupDate);
        const returnD = moment(returnDate);

        if (!pickup.isValid() || !returnD.isValid()) {
            throw new errors.ValidationError({
                message: '유효하지 않은 날짜 형식입니다.'
            });
        }

        if (pickup.isSameOrAfter(returnD)) {
            throw new errors.ValidationError({
                message: '인수일은 반납일보다 이전이어야 합니다.'
            });
        }

        // 차량 상태 확인
        const vehicle = await models.Vehicle.findOne({id: vehicleId});
        if (!vehicle) {
            throw new errors.NotFoundError({
                message: '차량을 찾을 수 없습니다.'
            });
        }

        if (vehicle.get('status') !== 'available') {
            return {
                available: false,
                reason: `차량이 현재 '${vehicle.get('status')}' 상태입니다.`,
                conflicts: []
            };
        }

        // 겹치는 예약 확인
        const conflicts = await this.findConflictingReservations(
            vehicleId, pickup.toDate(), returnD.toDate(), excludeReservationId
        );

        return {
            available: conflicts.length === 0,
            reason: conflicts.length > 0 ? '해당 기간에 이미 예약이 있습니다.' : null,
            conflicts: conflicts.map(c => ({
                id: c.get('id'),
                pickup_date: c.get('pickup_date'),
                return_date: c.get('return_date'),
                status: c.get('status')
            }))
        };
    }

    /**
     * 충돌하는 예약을 찾습니다
     */
    async findConflictingReservations(vehicleId, pickupDate, returnDate, excludeReservationId) {
        const activeStatuses = ['pending', 'confirmed', 'active'];

        let query = models.Base.knex('vehicle_reservations')
            .where('vehicle_id', vehicleId)
            .whereIn('status', activeStatuses)
            .where(function () {
                this.where(function () {
                    this.where('pickup_date', '<', returnDate)
                        .where('return_date', '>', pickupDate);
                });
            });

        if (excludeReservationId) {
            query = query.whereNot('id', excludeReservationId);
        }

        return query;
    }

    /**
     * 특정 카테고리에서 이용 가능한 차량 목록을 반환합니다
     */
    async findAvailableVehicles(pickupDate, returnDate, options = {}) {
        const pickup = moment(pickupDate).toDate();
        const returnD = moment(returnDate).toDate();
        const activeStatuses = ['pending', 'confirmed', 'active'];

        const knex = models.Base.knex;

        let query = knex('vehicles')
            .where('vehicles.status', 'available')
            .whereNotIn('vehicles.id', function () {
                this.select('vehicle_id')
                    .from('vehicle_reservations')
                    .whereIn('status', activeStatuses)
                    .where('pickup_date', '<', returnD)
                    .where('return_date', '>', pickup);
            });

        if (options.categoryId) {
            query = query.where('vehicles.category_id', options.categoryId);
        }

        if (options.minSeats) {
            query = query.where('vehicles.seats', '>=', options.minSeats);
        }

        if (options.fuelType) {
            query = query.where('vehicles.fuel_type', options.fuelType);
        }

        if (options.transmission) {
            query = query.where('vehicles.transmission', options.transmission);
        }

        if (options.maxDailyRate) {
            query = query.where('vehicles.daily_rate', '<=', options.maxDailyRate);
        }

        return query;
    }

    /**
     * 차량의 예약 캘린더를 반환합니다
     */
    async getVehicleCalendar(vehicleId, startDate, endDate) {
        const activeStatuses = ['pending', 'confirmed', 'active'];

        const reservations = await models.Base.knex('vehicle_reservations')
            .where('vehicle_id', vehicleId)
            .whereIn('status', activeStatuses)
            .where('pickup_date', '<', moment(endDate).toDate())
            .where('return_date', '>', moment(startDate).toDate())
            .orderBy('pickup_date', 'asc');

        return reservations.map(r => ({
            reservation_id: r.id,
            pickup_date: r.pickup_date,
            return_date: r.return_date,
            status: r.status
        }));
    }
}

module.exports = new AvailabilityEngine();
