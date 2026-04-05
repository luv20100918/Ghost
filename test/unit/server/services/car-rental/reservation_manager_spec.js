const should = require('should');
const sinon = require('sinon');
const models = require('../../../../../core/server/models');
const errors = require('@tryghost/errors');

const reservationManager = require('../../../../../core/server/services/car-rental/reservation-manager');
const availabilityEngine = require('../../../../../core/server/services/car-rental/availability');
const pricingEngine = require('../../../../../core/server/services/car-rental/pricing');

describe('Car Rental - ReservationManager', function () {
    afterEach(function () {
        sinon.restore();
    });

    describe('createReservation', function () {
        const baseData = {
            vehicle_id: 'v-1',
            member_id: 'member-1',
            pickup_date: '2026-05-10',
            return_date: '2026-05-15',
            pickup_location: 'Airport',
            return_location: 'Downtown',
            notes: 'Test reservation'
        };

        const mockPricing = {
            daily_rate: 100,
            total_amount: 500,
            currency: 'usd',
            discount_amount: 0,
            rental_days: 5,
            base_amount: 500
        };

        it('Should check availability before creating', async function () {
            const availabilityStub = sinon.stub(availabilityEngine, 'checkVehicleAvailability').resolves({
                available: false,
                reason: '해당 기간에 이미 예약이 있습니다.',
                conflicts: []
            });

            try {
                await reservationManager.createReservation(baseData);
                should.fail('Should have thrown a ConflictError');
            } catch (err) {
                err.should.be.instanceOf(errors.ConflictError);
            }

            availabilityStub.calledOnce.should.be.true();
            availabilityStub.calledWith('v-1', '2026-05-10', '2026-05-15').should.be.true();
        });

        it('Should calculate pricing', async function () {
            sinon.stub(availabilityEngine, 'checkVehicleAvailability').resolves({
                available: true,
                reason: null,
                conflicts: []
            });

            const pricingStub = sinon.stub(pricingEngine, 'calculatePrice').resolves(mockPricing);

            const mockReservation = {
                get: sinon.stub().returns('new-res-id')
            };
            sinon.stub(models.VehicleReservation, 'add').resolves(mockReservation);
            sinon.stub(reservationManager, 'recordEvent').resolves();

            const result = await reservationManager.createReservation(baseData);

            pricingStub.calledOnce.should.be.true();
            pricingStub.firstCall.args[0].should.have.property('vehicleId', 'v-1');
            pricingStub.firstCall.args[0].should.have.property('memberId', 'member-1');
            result.pricing.should.deepEqual(mockPricing);
        });

        it('Should record creation event', async function () {
            sinon.stub(availabilityEngine, 'checkVehicleAvailability').resolves({
                available: true,
                reason: null,
                conflicts: []
            });

            sinon.stub(pricingEngine, 'calculatePrice').resolves(mockPricing);

            const mockReservation = {
                get: sinon.stub().returns('new-res-id')
            };
            sinon.stub(models.VehicleReservation, 'add').resolves(mockReservation);

            const recordEventStub = sinon.stub(reservationManager, 'recordEvent').resolves();

            await reservationManager.createReservation(baseData);

            recordEventStub.calledOnce.should.be.true();
            recordEventStub.firstCall.args[0].should.equal('new-res-id');
            recordEventStub.firstCall.args[1].should.equal('created');
            recordEventStub.firstCall.args[2].should.have.property('pricing_details');
            recordEventStub.firstCall.args[2].should.have.property('created_by', 'member-1');
        });
    });

    describe('updateStatus', function () {
        function makeMockReservation(status, vehicleId) {
            return {
                get: sinon.stub().callsFake(function (key) {
                    const data = {
                        id: 'res-1',
                        status: status,
                        vehicle_id: vehicleId || 'v-1'
                    };
                    return data[key];
                })
            };
        }

        it('Should enforce valid state transitions', async function () {
            sinon.stub(models.VehicleReservation, 'findOne')
                .onFirstCall().resolves(makeMockReservation('pending'))
                .onSecondCall().resolves(makeMockReservation('confirmed', 'v-1'));

            sinon.stub(models.VehicleReservation, 'edit').resolves();
            sinon.stub(reservationManager, 'recordEvent').resolves();
            sinon.stub(models.Vehicle, 'edit').resolves();

            // pending -> confirmed: valid
            const result = await reservationManager.updateStatus('res-1', 'confirmed');
            // Should not throw - just verify findOne was called
            models.VehicleReservation.findOne.calledOnce.should.be.true();
        });

        it('Should reject invalid transitions', async function () {
            sinon.stub(models.VehicleReservation, 'findOne').resolves(
                makeMockReservation('completed')
            );

            try {
                await reservationManager.updateStatus('res-1', 'active');
                should.fail('Should have thrown a ValidationError');
            } catch (err) {
                err.should.be.instanceOf(errors.ValidationError);
                err.message.should.containEql('completed');
            }
        });

        it('Should update vehicle status on transition', async function () {
            // Test active transition sets vehicle to 'rented'
            sinon.stub(models.VehicleReservation, 'findOne')
                .onFirstCall().resolves(makeMockReservation('confirmed', 'v-1'))
                .onSecondCall().resolves(makeMockReservation('active', 'v-1'));

            sinon.stub(models.VehicleReservation, 'edit').resolves();
            sinon.stub(reservationManager, 'recordEvent').resolves();

            const vehicleEditStub = sinon.stub(models.Vehicle, 'edit').resolves();

            await reservationManager.updateStatus('res-1', 'active');

            vehicleEditStub.calledOnce.should.be.true();
            vehicleEditStub.firstCall.args[0].should.deepEqual({status: 'rented'});
        });

        it('Should record status change event', async function () {
            sinon.stub(models.VehicleReservation, 'findOne')
                .onFirstCall().resolves(makeMockReservation('pending', 'v-1'))
                .onSecondCall().resolves(makeMockReservation('cancelled', 'v-1'));

            sinon.stub(models.VehicleReservation, 'edit').resolves();
            sinon.stub(models.Vehicle, 'edit').resolves();

            const recordEventStub = sinon.stub(reservationManager, 'recordEvent').resolves();

            await reservationManager.updateStatus('res-1', 'cancelled', {reason: 'customer request'});

            recordEventStub.calledOnce.should.be.true();
            recordEventStub.firstCall.args[0].should.equal('res-1');
            recordEventStub.firstCall.args[1].should.equal('status_changed_to_cancelled');
            recordEventStub.firstCall.args[2].from_status.should.equal('pending');
            recordEventStub.firstCall.args[2].to_status.should.equal('cancelled');
            recordEventStub.firstCall.args[2].reason.should.equal('customer request');
        });
    });

    describe('getStats', function () {
        it('Should return correct aggregated statistics', async function () {
            const countStub = {
                count: sinon.stub().returnsThis(),
                first: sinon.stub().resolves({total: 42})
            };

            const groupByStub = {
                select: sinon.stub().returnsThis(),
                count: sinon.stub().returnsThis(),
                groupBy: sinon.stub().resolves([
                    {status: 'pending', count: 5},
                    {status: 'confirmed', count: 10},
                    {status: 'active', count: 7},
                    {status: 'completed', count: 15},
                    {status: 'cancelled', count: 5}
                ])
            };

            const revenueStub = {
                whereIn: sinon.stub().returnsThis(),
                select: sinon.stub().returnsThis(),
                first: sinon.stub().resolves({
                    total_revenue: 25000,
                    avg_revenue: 781.25,
                    paid_count: 32
                })
            };

            let callCount = 0;
            const knexStub = sinon.stub().callsFake(function () {
                callCount++;
                if (callCount === 1) {
                    return countStub;
                }
                if (callCount === 2) {
                    return groupByStub;
                }
                return revenueStub;
            });
            knexStub.raw = sinon.stub().returnsArg(0);

            sinon.stub(models.Base, 'knex').value(knexStub);

            const result = await reservationManager.getStats();

            result.total_reservations.should.equal(42);
            result.status_breakdown.should.have.property('pending', 5);
            result.status_breakdown.should.have.property('confirmed', 10);
            result.status_breakdown.should.have.property('active', 7);
            result.status_breakdown.should.have.property('completed', 15);
            result.status_breakdown.should.have.property('cancelled', 5);
            result.revenue.total.should.equal(25000);
            result.revenue.average.should.equal(781);
            result.revenue.paid_count.should.equal(32);
        });
    });
});
