const should = require('should');
const sinon = require('sinon');
const Promise = require('bluebird');
const errors = require('@tryghost/errors');
const models = require('../../../../core/server/models');
const reservationsController = require('../../../../core/server/api/canary/vehicle-reservations');

describe('Vehicle Reservations API (Canary)', function () {
    before(function () {
        models.init();
    });

    afterEach(function () {
        sinon.restore();
    });

    describe('browse', function () {
        it('should call VehicleReservation.findPage', function () {
            const findPageStub = sinon.stub(models.VehicleReservation, 'findPage')
                .resolves({data: [], meta: {pagination: {}}});

            const frame = {
                options: {}
            };

            return reservationsController.browse.query(frame).then(function (result) {
                findPageStub.calledOnce.should.be.true();
                result.should.have.property('data');
                result.should.have.property('meta');
            });
        });

        it('should pass filter and pagination options correctly', function () {
            const findPageStub = sinon.stub(models.VehicleReservation, 'findPage')
                .resolves({data: [], meta: {pagination: {}}});

            const frame = {
                options: {
                    filter: 'status:confirmed',
                    limit: 10,
                    page: 1,
                    order: 'pickup_date desc',
                    include: 'vehicle'
                }
            };

            return reservationsController.browse.query(frame).then(function () {
                findPageStub.calledOnce.should.be.true();
                const passedOptions = findPageStub.firstCall.args[0];
                passedOptions.should.have.property('filter', 'status:confirmed');
                passedOptions.should.have.property('limit', 10);
                passedOptions.should.have.property('include', 'vehicle');
            });
        });
    });

    describe('add', function () {
        let findOneVehicleStub;
        let findPageReservationStub;
        let addReservationStub;

        const fakeVehicle = {
            id: 'vehicle-id-1',
            get: function (attr) {
                const data = {
                    status: 'available',
                    daily_rate: 5000
                };
                return data[attr];
            }
        };

        const baseReservationData = {
            vehicle_id: 'vehicle-id-1',
            member_id: 'member-id-1',
            pickup_date: '2026-05-01',
            return_date: '2026-05-05'
        };

        beforeEach(function () {
            findOneVehicleStub = sinon.stub(models.Vehicle, 'findOne');
            findPageReservationStub = sinon.stub(models.VehicleReservation, 'findPage');
            addReservationStub = sinon.stub(models.VehicleReservation, 'add');
        });

        it('should validate vehicle exists', function () {
            findOneVehicleStub.resolves(null);

            const frame = {
                data: {
                    vehicle_reservations: [Object.assign({}, baseReservationData)]
                },
                options: {}
            };

            return reservationsController.add.query(frame).then(function () {
                should.fail('add.query should have thrown');
            }).catch(function (err) {
                (err instanceof errors.NotFoundError).should.be.true();
                findOneVehicleStub.calledOnce.should.be.true();
                findOneVehicleStub.firstCall.args[0].should.eql({id: 'vehicle-id-1'});
            });
        });

        it('should validate vehicle is available', function () {
            const unavailableVehicle = {
                id: 'vehicle-id-1',
                get: function (attr) {
                    if (attr === 'status') return 'maintenance';
                    if (attr === 'daily_rate') return 5000;
                }
            };
            findOneVehicleStub.resolves(unavailableVehicle);

            const frame = {
                data: {
                    vehicle_reservations: [Object.assign({}, baseReservationData)]
                },
                options: {}
            };

            return reservationsController.add.query(frame).then(function () {
                should.fail('add.query should have thrown');
            }).catch(function (err) {
                (err instanceof errors.ValidationError).should.be.true();
                err.message.should.match(/not available/i);
            });
        });

        it('should validate dates are present', function () {
            findOneVehicleStub.resolves(fakeVehicle);

            const frame = {
                data: {
                    vehicle_reservations: [{
                        vehicle_id: 'vehicle-id-1',
                        member_id: 'member-id-1'
                        // missing pickup_date and return_date
                    }]
                },
                options: {}
            };

            return reservationsController.add.query(frame).then(function () {
                should.fail('add.query should have thrown');
            }).catch(function (err) {
                (err instanceof errors.ValidationError).should.be.true();
            });
        });

        it('should validate pickup_date only is not sufficient', function () {
            findOneVehicleStub.resolves(fakeVehicle);

            const frame = {
                data: {
                    vehicle_reservations: [{
                        vehicle_id: 'vehicle-id-1',
                        member_id: 'member-id-1',
                        pickup_date: '2026-05-01'
                        // missing return_date
                    }]
                },
                options: {}
            };

            return reservationsController.add.query(frame).then(function () {
                should.fail('add.query should have thrown');
            }).catch(function (err) {
                (err instanceof errors.ValidationError).should.be.true();
            });
        });

        it('should validate return_date > pickup_date', function () {
            findOneVehicleStub.resolves(fakeVehicle);

            const frame = {
                data: {
                    vehicle_reservations: [{
                        vehicle_id: 'vehicle-id-1',
                        member_id: 'member-id-1',
                        pickup_date: '2026-05-05',
                        return_date: '2026-05-01' // return before pickup
                    }]
                },
                options: {}
            };

            return reservationsController.add.query(frame).then(function () {
                should.fail('add.query should have thrown');
            }).catch(function (err) {
                (err instanceof errors.ValidationError).should.be.true();
            });
        });

        it('should reject when pickup_date equals return_date', function () {
            findOneVehicleStub.resolves(fakeVehicle);

            const frame = {
                data: {
                    vehicle_reservations: [{
                        vehicle_id: 'vehicle-id-1',
                        member_id: 'member-id-1',
                        pickup_date: '2026-05-01',
                        return_date: '2026-05-01'
                    }]
                },
                options: {}
            };

            return reservationsController.add.query(frame).then(function () {
                should.fail('add.query should have thrown');
            }).catch(function (err) {
                (err instanceof errors.ValidationError).should.be.true();
            });
        });

        it('should check for overlapping reservations', function () {
            findOneVehicleStub.resolves(fakeVehicle);
            findPageReservationStub.resolves({
                data: [{id: 'existing-reservation'}],
                meta: {pagination: {}}
            });

            const frame = {
                data: {
                    vehicle_reservations: [Object.assign({}, baseReservationData)]
                },
                options: {}
            };

            return reservationsController.add.query(frame).then(function () {
                should.fail('add.query should have thrown');
            }).catch(function (err) {
                (err instanceof errors.ValidationError).should.be.true();
                findPageReservationStub.calledOnce.should.be.true();
                const filterArg = findPageReservationStub.firstCall.args[0].filter;
                filterArg.should.containEql('vehicle_id:vehicle-id-1');
                filterArg.should.containEql('status:-cancelled');
            });
        });

        it('should calculate pricing based on daily rate and duration', function () {
            findOneVehicleStub.resolves(fakeVehicle);
            findPageReservationStub.resolves({data: [], meta: {pagination: {}}});

            const fakeResult = {id: 'new-reservation-id'};
            addReservationStub.resolves(fakeResult);

            const frame = {
                data: {
                    vehicle_reservations: [Object.assign({}, baseReservationData)]
                },
                options: {}
            };

            return reservationsController.add.query(frame).then(function (result) {
                addReservationStub.calledOnce.should.be.true();
                const addedData = addReservationStub.firstCall.args[0];
                addedData.daily_rate.should.equal(5000);
                // 4 days from May 1 to May 5
                addedData.total_amount.should.equal(20000);
                addedData.status.should.equal('pending');
                result.should.eql(fakeResult);
            });
        });

        it('should not override total_amount if explicitly provided', function () {
            findOneVehicleStub.resolves(fakeVehicle);
            findPageReservationStub.resolves({data: [], meta: {pagination: {}}});

            const fakeResult = {id: 'new-reservation-id'};
            addReservationStub.resolves(fakeResult);

            const frame = {
                data: {
                    vehicle_reservations: [Object.assign({}, baseReservationData, {
                        total_amount: 15000
                    })]
                },
                options: {}
            };

            return reservationsController.add.query(frame).then(function () {
                const addedData = addReservationStub.firstCall.args[0];
                addedData.total_amount.should.equal(15000);
            });
        });

        it('should set default status to pending', function () {
            findOneVehicleStub.resolves(fakeVehicle);
            findPageReservationStub.resolves({data: [], meta: {pagination: {}}});
            addReservationStub.resolves({id: 'new-id'});

            const frame = {
                data: {
                    vehicle_reservations: [Object.assign({}, baseReservationData)]
                },
                options: {}
            };

            return reservationsController.add.query(frame).then(function () {
                const addedData = addReservationStub.firstCall.args[0];
                addedData.status.should.equal('pending');
            });
        });

        it('should handle unique constraint errors on add', function () {
            findOneVehicleStub.resolves(fakeVehicle);
            findPageReservationStub.resolves({data: [], meta: {pagination: {}}});

            const uniqueError = new Error('Column `id` is not unique');
            uniqueError.code = 'SQLITE_CONSTRAINT';
            addReservationStub.rejects(uniqueError);

            const frame = {
                data: {
                    vehicle_reservations: [Object.assign({}, baseReservationData)]
                },
                options: {}
            };

            return reservationsController.add.query(frame).then(function () {
                should.fail('add.query should have thrown');
            }).catch(function (err) {
                (err instanceof errors.ValidationError).should.be.true();
            });
        });
    });

    describe('read', function () {
        it('should call VehicleReservation.findOne', function () {
            const fakeModel = {id: 'reservation-id-1', get: sinon.stub()};
            sinon.stub(models.VehicleReservation, 'findOne').resolves(fakeModel);

            const frame = {
                data: {id: 'reservation-id-1'},
                options: {}
            };

            return reservationsController.read.query(frame).then(function (result) {
                result.should.eql(fakeModel);
            });
        });

        it('should throw NotFoundError when reservation not found', function () {
            sinon.stub(models.VehicleReservation, 'findOne').resolves(null);

            const frame = {
                data: {id: 'nonexistent-id'},
                options: {}
            };

            return reservationsController.read.query(frame).then(function () {
                should.fail('read.query should have thrown');
            }).catch(function (err) {
                (err instanceof errors.NotFoundError).should.be.true();
            });
        });
    });

    describe('edit', function () {
        it('should call VehicleReservation.edit', function () {
            const fakeModel = {
                id: 'reservation-id-1',
                wasChanged: sinon.stub().returns(true)
            };
            sinon.stub(models.VehicleReservation, 'edit').resolves(fakeModel);

            const frame = {
                data: {
                    vehicle_reservations: [{status: 'confirmed'}]
                },
                options: {id: 'reservation-id-1'}
            };

            const context = {headers: {}};
            return reservationsController.edit.query.call(context, frame).then(function (result) {
                result.should.eql(fakeModel);
                context.headers.cacheInvalidate.should.be.true();
            });
        });
    });

    describe('destroy', function () {
        it('should call VehicleReservation.destroy', function () {
            const destroyStub = sinon.stub(models.VehicleReservation, 'destroy')
                .resolves();

            const frame = {
                options: {id: 'reservation-id-1'}
            };

            return reservationsController.destroy.query(frame).then(function (result) {
                destroyStub.calledOnce.should.be.true();
                destroyStub.firstCall.args[0].should.have.property('id', 'reservation-id-1');
                should.equal(result, null);
            });
        });
    });

    describe('stats', function () {
        it('should return correct stats structure', function () {
            const fakeKnex = sinon.stub();

            const countChain = {
                count: sinon.stub().returnsThis(),
                first: sinon.stub(),
                whereIn: sinon.stub().returnsThis(),
                where: sinon.stub().returnsThis(),
                sum: sinon.stub().returnsThis()
            };

            // Total reservations query
            const totalChain = Object.create(countChain);
            totalChain.count = sinon.stub().returns(totalChain);
            totalChain.first = sinon.stub().resolves({count: 42});

            // Active reservations query
            const activeChain = Object.create(countChain);
            activeChain.whereIn = sinon.stub().returns(activeChain);
            activeChain.where = sinon.stub().returns(activeChain);
            activeChain.count = sinon.stub().returns(activeChain);
            activeChain.first = sinon.stub().resolves({count: 5});

            // Revenue query
            const revenueChain = Object.create(countChain);
            revenueChain.where = sinon.stub().returns(revenueChain);
            revenueChain.sum = sinon.stub().returns(revenueChain);
            revenueChain.first = sinon.stub().resolves({total: 250000});

            let callCount = 0;
            fakeKnex.callsFake(function () {
                callCount++;
                if (callCount === 1) return totalChain;
                if (callCount === 2) return activeChain;
                if (callCount === 3) return revenueChain;
            });

            fakeKnex.fn = {now: sinon.stub().returns('2026-04-05')};

            const originalKnex = models.Base.knex;
            models.Base.knex = fakeKnex;

            return reservationsController.stats.query().then(function (result) {
                result.should.have.property('total_reservations', 42);
                result.should.have.property('active_reservations', 5);
                result.should.have.property('total_revenue', 250000);
            }).finally(function () {
                models.Base.knex = originalKnex;
            });
        });

        it('should return zero defaults when no data exists', function () {
            const fakeKnex = sinon.stub();

            const totalChain = {
                count: sinon.stub().returnsThis(),
                first: sinon.stub().resolves({count: 0})
            };

            const activeChain = {
                whereIn: sinon.stub().returnsThis(),
                where: sinon.stub().returnsThis(),
                count: sinon.stub().returnsThis(),
                first: sinon.stub().resolves({count: 0})
            };

            const revenueChain = {
                where: sinon.stub().returnsThis(),
                sum: sinon.stub().returnsThis(),
                first: sinon.stub().resolves({total: null})
            };

            let callCount = 0;
            fakeKnex.callsFake(function () {
                callCount++;
                if (callCount === 1) return totalChain;
                if (callCount === 2) return activeChain;
                if (callCount === 3) return revenueChain;
            });

            fakeKnex.fn = {now: sinon.stub().returns('2026-04-05')};

            const originalKnex = models.Base.knex;
            models.Base.knex = fakeKnex;

            return reservationsController.stats.query().then(function (result) {
                result.should.have.property('total_reservations', 0);
                result.should.have.property('active_reservations', 0);
                result.should.have.property('total_revenue', 0);
            }).finally(function () {
                models.Base.knex = originalKnex;
            });
        });

        it('should use browse permissions', function () {
            reservationsController.stats.permissions.method.should.equal('browse');
        });
    });
});
