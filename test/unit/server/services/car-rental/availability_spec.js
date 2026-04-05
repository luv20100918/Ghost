const should = require('should');
const sinon = require('sinon');
const moment = require('moment-timezone');
const models = require('../../../../../core/server/models');
const errors = require('@tryghost/errors');

const availabilityEngine = require('../../../../../core/server/services/car-rental/availability');

describe('Car Rental - AvailabilityEngine', function () {
    afterEach(function () {
        sinon.restore();
    });

    describe('checkVehicleAvailability', function () {
        it('Should throw on invalid dates', async function () {
            try {
                await availabilityEngine.checkVehicleAvailability('vehicle-1', 'not-a-date', 'also-not-a-date');
                should.fail('Should have thrown a ValidationError');
            } catch (err) {
                err.should.be.instanceOf(errors.ValidationError);
            }
        });

        it('Should throw when pickup_date >= return_date', async function () {
            const sameDate = '2026-05-10';
            try {
                await availabilityEngine.checkVehicleAvailability('vehicle-1', sameDate, sameDate);
                should.fail('Should have thrown a ValidationError');
            } catch (err) {
                err.should.be.instanceOf(errors.ValidationError);
            }

            try {
                await availabilityEngine.checkVehicleAvailability('vehicle-1', '2026-05-12', '2026-05-10');
                should.fail('Should have thrown a ValidationError');
            } catch (err) {
                err.should.be.instanceOf(errors.ValidationError);
            }
        });

        it('Should return not available when vehicle status is not available', async function () {
            sinon.stub(models.Vehicle, 'findOne').resolves({
                get: sinon.stub().withArgs('status').returns('maintenance')
            });

            const result = await availabilityEngine.checkVehicleAvailability(
                'vehicle-1', '2026-05-10', '2026-05-15'
            );

            result.available.should.be.false();
            result.reason.should.containEql('maintenance');
            result.conflicts.should.be.an.Array().with.lengthOf(0);
        });

        it('Should return available when no conflicts', async function () {
            sinon.stub(models.Vehicle, 'findOne').resolves({
                get: sinon.stub().withArgs('status').returns('available')
            });

            sinon.stub(availabilityEngine, 'findConflictingReservations').resolves([]);

            const result = await availabilityEngine.checkVehicleAvailability(
                'vehicle-1', '2026-05-10', '2026-05-15'
            );

            result.available.should.be.true();
            should(result.reason).be.null();
            result.conflicts.should.be.an.Array().with.lengthOf(0);
        });

        it('Should return not available when overlapping reservation exists', async function () {
            sinon.stub(models.Vehicle, 'findOne').resolves({
                get: sinon.stub().withArgs('status').returns('available')
            });

            const conflicting = {
                get: sinon.stub().callsFake(function (key) {
                    const data = {
                        id: 'res-99',
                        pickup_date: '2026-05-12',
                        return_date: '2026-05-18',
                        status: 'confirmed'
                    };
                    return data[key];
                })
            };

            sinon.stub(availabilityEngine, 'findConflictingReservations').resolves([conflicting]);

            const result = await availabilityEngine.checkVehicleAvailability(
                'vehicle-1', '2026-05-10', '2026-05-15'
            );

            result.available.should.be.false();
            result.conflicts.should.be.an.Array().with.lengthOf(1);
            result.conflicts[0].id.should.equal('res-99');
            result.conflicts[0].status.should.equal('confirmed');
        });
    });

    describe('findAvailableVehicles', function () {
        let knexStub;
        let queryBuilder;

        beforeEach(function () {
            queryBuilder = {
                where: sinon.stub().returnsThis(),
                whereNotIn: sinon.stub().returnsThis()
            };

            knexStub = sinon.stub().returns(queryBuilder);
            sinon.stub(models.Base, 'knex').value(knexStub);
        });

        it('Should filter by category', async function () {
            await availabilityEngine.findAvailableVehicles(
                '2026-05-10', '2026-05-15', {categoryId: 'cat-suv'}
            );

            // The query builder should have been called with category filter
            const categoryCall = queryBuilder.where.getCalls().find(
                call => call.args[0] === 'vehicles.category_id' && call.args[1] === 'cat-suv'
            );
            should.exist(categoryCall);
        });

        it('Should filter by fuel type', async function () {
            await availabilityEngine.findAvailableVehicles(
                '2026-05-10', '2026-05-15', {fuelType: 'electric'}
            );

            const fuelCall = queryBuilder.where.getCalls().find(
                call => call.args[0] === 'vehicles.fuel_type' && call.args[1] === 'electric'
            );
            should.exist(fuelCall);
        });

        it('Should exclude vehicles with conflicting reservations', async function () {
            await availabilityEngine.findAvailableVehicles(
                '2026-05-10', '2026-05-15'
            );

            // The knex constructor should be called with 'vehicles'
            knexStub.calledWith('vehicles').should.be.true();

            // whereNotIn should be called to exclude reserved vehicles
            queryBuilder.whereNotIn.calledOnce.should.be.true();
            queryBuilder.whereNotIn.firstCall.args[0].should.equal('vehicles.id');
        });
    });

    describe('getVehicleCalendar', function () {
        it('Should return reservations within date range', async function () {
            const mockReservations = [
                {
                    id: 'res-1',
                    pickup_date: '2026-05-10',
                    return_date: '2026-05-15',
                    status: 'confirmed'
                },
                {
                    id: 'res-2',
                    pickup_date: '2026-05-20',
                    return_date: '2026-05-25',
                    status: 'pending'
                }
            ];

            const queryBuilder = {
                where: sinon.stub().returnsThis(),
                whereIn: sinon.stub().returnsThis(),
                orderBy: sinon.stub().resolves(mockReservations)
            };

            const knexStub = sinon.stub().returns(queryBuilder);
            sinon.stub(models.Base, 'knex').value(knexStub);

            const result = await availabilityEngine.getVehicleCalendar(
                'vehicle-1', '2026-05-01', '2026-05-31'
            );

            result.should.be.an.Array().with.lengthOf(2);
            result[0].reservation_id.should.equal('res-1');
            result[0].status.should.equal('confirmed');
            result[1].reservation_id.should.equal('res-2');
            result[1].status.should.equal('pending');

            knexStub.calledWith('vehicle_reservations').should.be.true();
        });
    });
});
