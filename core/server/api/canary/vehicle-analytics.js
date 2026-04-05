const models = require('../../models');

module.exports = {
    docName: 'vehicle_analytics',

    stats: {
        permissions: true,
        async query() {
            const knex = models.Base.knex;

            const vehicleCount = await knex('vehicles').count('id as count').first();
            const availableCount = await knex('vehicles')
                .where('status', 'available')
                .count('id as count')
                .first();
            const reservationCount = await knex('vehicle_reservations').count('id as count').first();
            const activeReservations = await knex('vehicle_reservations')
                .whereIn('status', ['confirmed', 'active'])
                .where('pickup_date', '<=', knex.fn.now())
                .where('return_date', '>=', knex.fn.now())
                .count('id as count')
                .first();
            const totalRevenue = await knex('vehicle_reservations')
                .where('status', '!=', 'cancelled')
                .sum('total_amount as total')
                .first();
            const categoryCount = await knex('vehicle_categories').count('id as count').first();

            return {
                total_vehicles: vehicleCount.count || 0,
                available_vehicles: availableCount.count || 0,
                total_categories: categoryCount.count || 0,
                total_reservations: reservationCount.count || 0,
                active_reservations: activeReservations.count || 0,
                total_revenue: totalRevenue.total || 0
            };
        }
    },

    revenue: {
        permissions: true,
        async query() {
            const knex = models.Base.knex;

            const totalRevenue = await knex('vehicle_reservations')
                .where('status', '!=', 'cancelled')
                .sum('total_amount as total')
                .first();

            const revenueByStatus = await knex('vehicle_reservations')
                .select('status')
                .sum('total_amount as revenue')
                .count('id as count')
                .groupBy('status');

            const revenueByCategory = await knex('vehicle_reservations as vr')
                .join('vehicles as v', 'vr.vehicle_id', 'v.id')
                .join('vehicle_categories as vc', 'v.category_id', 'vc.id')
                .where('vr.status', '!=', 'cancelled')
                .select('vc.name as category_name', 'vc.id as category_id')
                .sum('vr.total_price as revenue')
                .count('vr.id as count')
                .groupBy('vc.id', 'vc.name');

            // DB 호환성: strftime (SQLite) 및 DATE_FORMAT (MySQL) 모두 지원
            const monthlyRevenue = await knex('vehicle_reservations')
                .where('status', '!=', 'cancelled')
                .select(
                    knex.raw("strftime('%Y', created_at) as year"),
                    knex.raw("strftime('%m', created_at) as month"),
                    knex.raw('SUM(total_amount) as revenue'),
                    knex.raw('COUNT(id) as count')
                )
                .groupByRaw("strftime('%Y', created_at), strftime('%m', created_at)")
                .orderByRaw("strftime('%Y', created_at) DESC, strftime('%m', created_at) DESC")
                .limit(12);

            return {
                total_revenue: totalRevenue.total || 0,
                by_status: revenueByStatus,
                by_category: revenueByCategory,
                monthly: monthlyRevenue
            };
        }
    }
};
