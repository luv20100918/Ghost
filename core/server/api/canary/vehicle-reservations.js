const Promise = require('bluebird');
const {i18n} = require('../../lib/common');
const errors = require('@tryghost/errors');
const models = require('../../models');

const ALLOWED_INCLUDES = ['vehicle', 'member', 'events'];

module.exports = {
    docName: 'vehicle_reservations',

    browse: {
        options: [
            'include',
            'filter',
            'fields',
            'limit',
            'order',
            'page'
        ],
        validation: {
            options: {
                include: {
                    values: ALLOWED_INCLUDES
                }
            }
        },
        permissions: true,
        query(frame) {
            return models.VehicleReservation.findPage(frame.options);
        }
    },

    read: {
        options: [
            'include',
            'filter',
            'fields'
        ],
        data: [
            'id'
        ],
        validation: {
            options: {
                include: {
                    values: ALLOWED_INCLUDES
                }
            }
        },
        permissions: true,
        query(frame) {
            return models.VehicleReservation.findOne(frame.data, frame.options)
                .then((model) => {
                    if (!model) {
                        return Promise.reject(new errors.NotFoundError({
                            message: i18n.t('errors.api.resource.resourceNotFound', {resource: 'VehicleReservation'})
                        }));
                    }

                    return model;
                });
        }
    },

    add: {
        statusCode: 201,
        headers: {},
        options: [
            'include'
        ],
        validation: {
            options: {
                include: {
                    values: ALLOWED_INCLUDES
                }
            }
        },
        permissions: true,
        async query(frame) {
            const reservationData = frame.data.vehicle_reservations[0];

            // Validate that the vehicle exists and is available
            const vehicle = await models.Vehicle.findOne({id: reservationData.vehicle_id});

            if (!vehicle) {
                throw new errors.NotFoundError({
                    message: i18n.t('errors.api.resource.resourceNotFound', {resource: 'Vehicle'})
                });
            }

            if (vehicle.get('status') !== 'available') {
                throw new errors.ValidationError({
                    message: 'Vehicle is not available for reservation'
                });
            }

            // 겹치는 예약 확인
            const pickupDate = reservationData.pickup_date;
            const returnDate = reservationData.return_date;

            if (!pickupDate || !returnDate) {
                throw new errors.ValidationError({
                    message: '인수일(pickup_date)과 반납일(return_date)은 필수입니다.'
                });
            }

            if (new Date(pickupDate) >= new Date(returnDate)) {
                throw new errors.ValidationError({
                    message: '반납일은 인수일보다 이후여야 합니다.'
                });
            }

            const overlapping = await models.VehicleReservation.findPage({
                filter: `vehicle_id:${reservationData.vehicle_id}+status:-cancelled+pickup_date:<='${returnDate}'+return_date:>='${pickupDate}'`,
                limit: 1
            });

            if (overlapping.data && overlapping.data.length > 0) {
                throw new errors.ValidationError({
                    message: '해당 기간에 이미 예약이 존재합니다.'
                });
            }

            // 일일 요금 기반 가격 계산
            const dailyRate = vehicle.get('daily_rate') || 0;
            const days = Math.ceil((new Date(returnDate) - new Date(pickupDate)) / (1000 * 60 * 60 * 24));
            reservationData.daily_rate = dailyRate;
            reservationData.total_amount = reservationData.total_amount || (dailyRate * days);
            reservationData.status = reservationData.status || 'pending';

            try {
                return await models.VehicleReservation.add(reservationData, frame.options);
            } catch (error) {
                if (error.code && error.message.toLowerCase().indexOf('unique') !== -1) {
                    throw new errors.ValidationError({
                        message: i18n.t('errors.api.resource.resourceAlreadyExists', {resource: 'VehicleReservation'})
                    });
                }

                throw error;
            }
        }
    },

    edit: {
        headers: {},
        options: [
            'id',
            'include'
        ],
        validation: {
            options: {
                include: {
                    values: ALLOWED_INCLUDES
                },
                id: {
                    required: true
                }
            }
        },
        permissions: true,
        query(frame) {
            return models.VehicleReservation.edit(frame.data.vehicle_reservations[0], frame.options)
                .then((model) => {
                    if (!model) {
                        return Promise.reject(new errors.NotFoundError({
                            message: i18n.t('errors.api.resource.resourceNotFound', {resource: 'VehicleReservation'})
                        }));
                    }

                    if (model.wasChanged()) {
                        this.headers.cacheInvalidate = true;
                    } else {
                        this.headers.cacheInvalidate = false;
                    }

                    return model;
                });
        }
    },

    destroy: {
        statusCode: 204,
        headers: {
            cacheInvalidate: true
        },
        options: [
            'id'
        ],
        validation: {
            options: {
                id: {
                    required: true
                }
            }
        },
        permissions: true,
        query(frame) {
            return models.VehicleReservation.destroy(frame.options)
                .then(() => null);
        }
    },

    stats: {
        permissions: {
            method: 'browse'
        },
        async query() {
            const knex = models.Base.knex;

            const totalResult = await knex('vehicle_reservations').count('id as count').first();
            const activeResult = await knex('vehicle_reservations')
                .whereIn('status', ['confirmed', 'active'])
                .where('pickup_date', '<=', knex.fn.now())
                .where('return_date', '>=', knex.fn.now())
                .count('id as count')
                .first();
            const revenueResult = await knex('vehicle_reservations')
                .where('status', '!=', 'cancelled')
                .sum('total_amount as total')
                .first();

            return {
                total_reservations: totalResult.count || 0,
                active_reservations: activeResult.count || 0,
                total_revenue: revenueResult.total || 0
            };
        }
    }
};
