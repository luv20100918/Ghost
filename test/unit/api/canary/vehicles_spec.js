const should = require('should');
const sinon = require('sinon');
const Promise = require('bluebird');
const errors = require('@tryghost/errors');
const models = require('../../../../core/server/models');
const vehiclesController = require('../../../../core/server/api/canary/vehicles');

describe('Vehicles API (Canary)', function () {
    before(function () {
        models.init();
    });

    afterEach(function () {
        sinon.restore();
    });

    describe('browse', function () {
        it('should call Vehicle.findPage', function () {
            const findPageStub = sinon.stub(models.Vehicle, 'findPage')
                .resolves({data: [], meta: {pagination: {}}});

            const frame = {
                options: {}
            };

            return vehiclesController.browse.query(frame).then(function (result) {
                findPageStub.calledOnce.should.be.true();
                result.should.have.property('data');
                result.should.have.property('meta');
            });
        });

        it('should pass options correctly', function () {
            const findPageStub = sinon.stub(models.Vehicle, 'findPage')
                .resolves({data: [], meta: {pagination: {}}});

            const frame = {
                options: {
                    filter: 'status:available',
                    limit: 15,
                    page: 2,
                    order: 'created_at desc',
                    include: 'category'
                }
            };

            return vehiclesController.browse.query(frame).then(function () {
                findPageStub.calledOnce.should.be.true();
                const passedOptions = findPageStub.firstCall.args[0];
                passedOptions.should.have.property('filter', 'status:available');
                passedOptions.should.have.property('limit', 15);
                passedOptions.should.have.property('page', 2);
                passedOptions.should.have.property('order', 'created_at desc');
                passedOptions.should.have.property('include', 'category');
            });
        });
    });

    describe('read', function () {
        it('should call Vehicle.findOne', function () {
            const fakeModel = {id: 'vehicle-id-1', get: sinon.stub()};
            const findOneStub = sinon.stub(models.Vehicle, 'findOne')
                .resolves(fakeModel);

            const frame = {
                data: {id: 'vehicle-id-1'},
                options: {}
            };

            return vehiclesController.read.query(frame).then(function (result) {
                findOneStub.calledOnce.should.be.true();
                findOneStub.firstCall.args[0].should.eql({id: 'vehicle-id-1'});
                result.should.eql(fakeModel);
            });
        });

        it('should throw NotFoundError when vehicle not found', function () {
            sinon.stub(models.Vehicle, 'findOne').resolves(null);

            const frame = {
                data: {id: 'nonexistent-id'},
                options: {}
            };

            return vehiclesController.read.query(frame).then(function () {
                should.fail('read.query should have thrown');
            }).catch(function (err) {
                (err instanceof errors.NotFoundError).should.be.true();
            });
        });
    });

    describe('add', function () {
        it('should call Vehicle.add with correct data', function () {
            const vehicleData = {
                make: 'Toyota',
                model: 'Camry',
                year: 2024,
                status: 'available',
                daily_rate: 50
            };
            const fakeModel = Object.assign({id: 'new-id'}, vehicleData);
            const addStub = sinon.stub(models.Vehicle, 'add')
                .resolves(fakeModel);

            const frame = {
                data: {
                    vehicles: [vehicleData]
                },
                options: {include: 'category'}
            };

            return vehiclesController.add.query(frame).then(function (result) {
                addStub.calledOnce.should.be.true();
                addStub.firstCall.args[0].should.eql(vehicleData);
                addStub.firstCall.args[1].should.have.property('include', 'category');
                result.should.eql(fakeModel);
            });
        });

        it('should handle unique constraint errors', function () {
            const uniqueError = new Error('Column `slug` is not unique');
            uniqueError.code = 'SQLITE_CONSTRAINT';

            sinon.stub(models.Vehicle, 'add').rejects(uniqueError);

            const frame = {
                data: {
                    vehicles: [{make: 'Toyota', model: 'Camry'}]
                },
                options: {}
            };

            return vehiclesController.add.query(frame).then(function () {
                should.fail('add.query should have thrown');
            }).catch(function (err) {
                (err instanceof errors.ValidationError).should.be.true();
            });
        });

        it('should re-throw non-unique errors as-is', function () {
            const genericError = new Error('Something went wrong');

            sinon.stub(models.Vehicle, 'add').rejects(genericError);

            const frame = {
                data: {
                    vehicles: [{make: 'Toyota', model: 'Camry'}]
                },
                options: {}
            };

            return vehiclesController.add.query(frame).then(function () {
                should.fail('add.query should have thrown');
            }).catch(function (err) {
                err.message.should.eql('Something went wrong');
                (err instanceof errors.ValidationError).should.be.false();
            });
        });
    });

    describe('edit', function () {
        it('should call Vehicle.edit with correct data', function () {
            const fakeModel = {
                id: 'vehicle-id-1',
                wasChanged: sinon.stub().returns(false)
            };
            const editStub = sinon.stub(models.Vehicle, 'edit')
                .resolves(fakeModel);

            const updateData = {make: 'Honda', model: 'Civic'};
            const frame = {
                data: {
                    vehicles: [updateData]
                },
                options: {id: 'vehicle-id-1', include: 'category'}
            };

            // Bind the controller context to mimic Ghost pipeline behavior
            const context = {headers: {}};
            return vehiclesController.edit.query.call(context, frame).then(function (result) {
                editStub.calledOnce.should.be.true();
                editStub.firstCall.args[0].should.eql(updateData);
                editStub.firstCall.args[1].should.have.property('id', 'vehicle-id-1');
                result.should.eql(fakeModel);
            });
        });

        it('should set cacheInvalidate header when changed', function () {
            const fakeModel = {
                id: 'vehicle-id-1',
                wasChanged: sinon.stub().returns(true)
            };
            sinon.stub(models.Vehicle, 'edit').resolves(fakeModel);

            const frame = {
                data: {
                    vehicles: [{status: 'maintenance'}]
                },
                options: {id: 'vehicle-id-1'}
            };

            const context = {headers: {}};
            return vehiclesController.edit.query.call(context, frame).then(function () {
                context.headers.cacheInvalidate.should.be.true();
            });
        });

        it('should not set cacheInvalidate header when not changed', function () {
            const fakeModel = {
                id: 'vehicle-id-1',
                wasChanged: sinon.stub().returns(false)
            };
            sinon.stub(models.Vehicle, 'edit').resolves(fakeModel);

            const frame = {
                data: {
                    vehicles: [{status: 'available'}]
                },
                options: {id: 'vehicle-id-1'}
            };

            const context = {headers: {}};
            return vehiclesController.edit.query.call(context, frame).then(function () {
                context.headers.cacheInvalidate.should.be.false();
            });
        });

        it('should throw NotFoundError when vehicle not found', function () {
            sinon.stub(models.Vehicle, 'edit').resolves(null);

            const frame = {
                data: {
                    vehicles: [{status: 'available'}]
                },
                options: {id: 'nonexistent-id'}
            };

            const context = {headers: {}};
            return vehiclesController.edit.query.call(context, frame).then(function () {
                should.fail('edit.query should have thrown');
            }).catch(function (err) {
                (err instanceof errors.NotFoundError).should.be.true();
            });
        });
    });

    describe('destroy', function () {
        it('should call Vehicle.destroy', function () {
            const destroyStub = sinon.stub(models.Vehicle, 'destroy')
                .resolves();

            const frame = {
                options: {id: 'vehicle-id-1'}
            };

            return vehiclesController.destroy.query(frame).then(function (result) {
                destroyStub.calledOnce.should.be.true();
                destroyStub.firstCall.args[0].should.have.property('id', 'vehicle-id-1');
                should.equal(result, null);
            });
        });
    });
});
