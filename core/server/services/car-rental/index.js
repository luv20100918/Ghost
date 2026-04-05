/**
 * 렌터카 서비스 진입점
 * 모든 렌터카 관련 서비스를 통합 제공합니다
 */
const availability = require('./availability');
const pricing = require('./pricing');
const reservationManager = require('./reservation-manager');

module.exports = {
    availability,
    pricing,
    reservationManager
};
