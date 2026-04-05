const should = require('should');
const sinon = require('sinon');
const models = require('../../../../core/server/models');
const errors = require('@tryghost/errors');

describe('Unit: models/vehicle', function () {
    before(function () {
        models.init();
    });

    afterEach(function () {
        sinon.restore();
    });

    // -------------------------------------------------------
    // Vehicle
    // -------------------------------------------------------
    describe('Vehicle', function () {
        it('should have correct tableName', function () {
            const vehicle = models.Vehicle.forge({});
            vehicle.tableName.should.eql('vehicles');
        });

        it('should have correct defaults', function () {
            const vehicle = models.Vehicle.forge({});
            const defaults = vehicle.defaults();

            should.exist(defaults.uuid);
            defaults.uuid.should.be.a.String();
            defaults.status.should.eql('available');
            defaults.mileage.should.eql(0);
            defaults.fuel_type.should.eql('gasoline');
            defaults.seats.should.eql(5);
            defaults.transmission.should.eql('automatic');
        });

        describe('onSaving - slug generation', function () {
            it('should generate slug from name on saving when slug is not set', function () {
                const vehicle = models.Vehicle.forge({name: 'Toyota Camry 2024'});

                const generateSlugStub = sinon.stub(models.Base.Model, 'generateSlug')
                    .resolves('toyota-camry-2024');

                // Stub the parent onSaving to avoid DB calls
                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                return vehicle.onSaving(vehicle, {}, {}).then(function () {
                    generateSlugStub.calledOnce.should.be.true();
                    generateSlugStub.args[0][1].should.eql('Toyota Camry 2024');
                    vehicle.get('slug').should.eql('toyota-camry-2024');
                });
            });

            it('should trim the name before saving', function () {
                const vehicle = models.Vehicle.forge({name: '  Toyota Camry  ', slug: 'existing-slug'});

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                vehicle.onSaving(vehicle, {}, {});
                vehicle.get('name').should.eql('Toyota Camry');
            });
        });

        describe('onSaving - daily_rate validation', function () {
            it('should throw ValidationError when daily_rate is 0', function () {
                const vehicle = models.Vehicle.forge({name: 'Test Car', daily_rate: 0, slug: 'test'});

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                (function () {
                    vehicle.onSaving(vehicle, {}, {});
                }).should.throw(/daily_rate must be greater than 0/);
            });

            it('should throw ValidationError when daily_rate is negative', function () {
                const vehicle = models.Vehicle.forge({name: 'Test Car', daily_rate: -50, slug: 'test'});

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                (function () {
                    vehicle.onSaving(vehicle, {}, {});
                }).should.throw(/daily_rate must be greater than 0/);
            });

            it('should not throw when daily_rate is positive', function () {
                const vehicle = models.Vehicle.forge({name: 'Test Car', daily_rate: 50, slug: 'existing-slug'});

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                (function () {
                    vehicle.onSaving(vehicle, {}, {});
                }).should.not.throw();
            });

            it('should not throw when daily_rate is null', function () {
                const vehicle = models.Vehicle.forge({name: 'Test Car', daily_rate: null, slug: 'existing-slug'});

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                (function () {
                    vehicle.onSaving(vehicle, {}, {});
                }).should.not.throw();
            });
        });

        describe('relationships', function () {
            it('should set up category as belongsTo VehicleCategory', function () {
                const model = models.Vehicle.forge({});
                const belongsToSpy = sinon.spy(model, 'belongsTo');
                model.category();

                should.equal(belongsToSpy.args[0][0], 'VehicleCategory');
                should.equal(belongsToSpy.args[0][1], 'category_id');
            });

            it('should set up reservations as hasMany VehicleReservation', function () {
                const model = models.Vehicle.forge({});
                const hasManySpy = sinon.spy(model, 'hasMany');
                model.reservations();

                should.equal(hasManySpy.args[0][0], 'VehicleReservation');
                should.equal(hasManySpy.args[0][1], 'vehicle_id');
            });

            it('should set up reviews as hasMany VehicleReview', function () {
                const model = models.Vehicle.forge({});
                const hasManySpy = sinon.spy(model, 'hasMany');
                model.reviews();

                should.equal(hasManySpy.args[0][0], 'VehicleReview');
                should.equal(hasManySpy.args[0][1], 'vehicle_id');
            });

            it('should list category in relationships array', function () {
                const model = models.Vehicle.forge({});
                model.relationships.should.containEql('category');
            });
        });

        describe('permittedAttributes', function () {
            it('should include relationship keys in permitted attributes', function () {
                const model = models.Vehicle.forge({});
                const attrs = model.permittedAttributes();
                attrs.should.containEql('category');
            });
        });

        describe('orderDefaultOptions', function () {
            it('should order by name ASC and created_at DESC', function () {
                const orderDefaults = models.Vehicle.orderDefaultOptions();
                orderDefaults.name.should.eql('ASC');
                orderDefaults.created_at.should.eql('DESC');
            });
        });
    });

    // -------------------------------------------------------
    // VehicleCategory
    // -------------------------------------------------------
    describe('VehicleCategory', function () {
        it('should have correct tableName', function () {
            const category = models.VehicleCategory.forge({});
            category.tableName.should.eql('vehicle_categories');
        });

        describe('onSaving - slug generation', function () {
            it('should generate slug from name on saving', function () {
                const category = models.VehicleCategory.forge({name: 'Luxury SUV'});

                const generateSlugStub = sinon.stub(models.Base.Model, 'generateSlug')
                    .resolves('luxury-suv');

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                return category.onSaving(category, {}, {}).then(function () {
                    generateSlugStub.calledOnce.should.be.true();
                    generateSlugStub.args[0][1].should.eql('Luxury SUV');
                    category.get('slug').should.eql('luxury-suv');
                });
            });

            it('should trim name before saving', function () {
                const category = models.VehicleCategory.forge({name: '  Economy  ', slug: 'existing'});

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                category.onSaving(category, {}, {});
                category.get('name').should.eql('Economy');
            });
        });

        describe('relationships', function () {
            it('should set up vehicles as hasMany Vehicle', function () {
                const model = models.VehicleCategory.forge({});
                const hasManySpy = sinon.spy(model, 'hasMany');
                model.vehicles();

                should.equal(hasManySpy.args[0][0], 'Vehicle');
                should.equal(hasManySpy.args[0][1], 'category_id');
            });
        });

        describe('orderDefaultOptions', function () {
            it('should order by name ASC and created_at DESC', function () {
                const orderDefaults = models.VehicleCategory.orderDefaultOptions();
                orderDefaults.name.should.eql('ASC');
                orderDefaults.created_at.should.eql('DESC');
            });
        });
    });

    // -------------------------------------------------------
    // VehicleReservation
    // -------------------------------------------------------
    describe('VehicleReservation', function () {
        it('should have correct tableName', function () {
            const reservation = models.VehicleReservation.forge({});
            reservation.tableName.should.eql('vehicle_reservations');
        });

        it('should have correct defaults', function () {
            const reservation = models.VehicleReservation.forge({});
            const defaults = reservation.defaults();

            should.exist(defaults.uuid);
            defaults.uuid.should.be.a.String();
            defaults.status.should.eql('pending');
            defaults.currency.should.eql('usd');
            defaults.discount_amount.should.eql(0);
        });

        describe('onSaving - date validation', function () {
            it('should throw ValidationError when pickup_date is after return_date', function () {
                const reservation = models.VehicleReservation.forge({
                    pickup_date: '2026-05-15',
                    return_date: '2026-05-10'
                });

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                (function () {
                    reservation.onSaving(reservation, {}, {});
                }).should.throw(/pickup_date must be before return_date/);
            });

            it('should throw ValidationError when pickup_date equals return_date', function () {
                const reservation = models.VehicleReservation.forge({
                    pickup_date: '2026-05-15',
                    return_date: '2026-05-15'
                });

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                (function () {
                    reservation.onSaving(reservation, {}, {});
                }).should.throw(/pickup_date must be before return_date/);
            });

            it('should not throw when pickup_date is before return_date', function () {
                const reservation = models.VehicleReservation.forge({
                    pickup_date: '2026-05-10',
                    return_date: '2026-05-15'
                });

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                (function () {
                    reservation.onSaving(reservation, {}, {});
                }).should.not.throw();
            });
        });

        describe('onSaving - total_amount auto-calculation', function () {
            it('should auto-calculate total_amount from daily_rate and dates', function () {
                const reservation = models.VehicleReservation.forge({
                    pickup_date: '2026-05-10',
                    return_date: '2026-05-15',
                    daily_rate: 100,
                    discount_amount: 0
                });

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                reservation.onSaving(reservation, {}, {});

                // 5 days * 100 = 500
                const totalAmount = reservation.get('total_amount');
                totalAmount.should.eql(500);
            });

            it('should subtract discount_amount from total', function () {
                const reservation = models.VehicleReservation.forge({
                    pickup_date: '2026-05-10',
                    return_date: '2026-05-15',
                    daily_rate: 100,
                    discount_amount: 50
                });

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                reservation.onSaving(reservation, {}, {});

                // 5 days * 100 - 50 = 450
                const totalAmount = reservation.get('total_amount');
                totalAmount.should.eql(450);
            });

            it('should not set total_amount below 0', function () {
                const reservation = models.VehicleReservation.forge({
                    pickup_date: '2026-05-10',
                    return_date: '2026-05-11',
                    daily_rate: 10,
                    discount_amount: 500
                });

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                reservation.onSaving(reservation, {}, {});

                const totalAmount = reservation.get('total_amount');
                totalAmount.should.eql(0);
            });

            it('should not overwrite total_amount if already set', function () {
                const reservation = models.VehicleReservation.forge({
                    pickup_date: '2026-05-10',
                    return_date: '2026-05-15',
                    daily_rate: 100,
                    total_amount: 999
                });

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                reservation.onSaving(reservation, {}, {});

                reservation.get('total_amount').should.eql(999);
            });
        });

        describe('relationships', function () {
            it('should set up vehicle as belongsTo Vehicle', function () {
                const model = models.VehicleReservation.forge({});
                const belongsToSpy = sinon.spy(model, 'belongsTo');
                model.vehicle();

                should.equal(belongsToSpy.args[0][0], 'Vehicle');
                should.equal(belongsToSpy.args[0][1], 'vehicle_id');
            });

            it('should set up member as belongsTo Member', function () {
                const model = models.VehicleReservation.forge({});
                const belongsToSpy = sinon.spy(model, 'belongsTo');
                model.member();

                should.equal(belongsToSpy.args[0][0], 'Member');
                should.equal(belongsToSpy.args[0][1], 'member_id');
            });

            it('should set up events as hasMany VehicleReservationEvent', function () {
                const model = models.VehicleReservation.forge({});
                const hasManySpy = sinon.spy(model, 'hasMany');
                model.events();

                should.equal(hasManySpy.args[0][0], 'VehicleReservationEvent');
                should.equal(hasManySpy.args[0][1], 'reservation_id');
            });

            it('should set up reviews as hasMany VehicleReview', function () {
                const model = models.VehicleReservation.forge({});
                const hasManySpy = sinon.spy(model, 'hasMany');
                model.reviews();

                should.equal(hasManySpy.args[0][0], 'VehicleReview');
                should.equal(hasManySpy.args[0][1], 'reservation_id');
            });

            it('should list vehicle, member, and events in relationships array', function () {
                const model = models.VehicleReservation.forge({});
                model.relationships.should.containEql('vehicle');
                model.relationships.should.containEql('member');
                model.relationships.should.containEql('events');
            });
        });

        describe('permittedAttributes', function () {
            it('should include relationship keys in permitted attributes', function () {
                const model = models.VehicleReservation.forge({});
                const attrs = model.permittedAttributes();
                attrs.should.containEql('vehicle');
                attrs.should.containEql('member');
                attrs.should.containEql('events');
            });
        });
    });

    // -------------------------------------------------------
    // VehiclePricingRule
    // -------------------------------------------------------
    describe('VehiclePricingRule', function () {
        it('should have correct tableName', function () {
            const rule = models.VehiclePricingRule.forge({});
            rule.tableName.should.eql('vehicle_pricing_rules');
        });

        it('should have correct defaults', function () {
            const rule = models.VehiclePricingRule.forge({});
            const defaults = rule.defaults();

            defaults.multiplier.should.eql('1.0000');
            defaults.discount_percent.should.eql(0);
            defaults.is_active.should.eql(true);
            defaults.priority.should.eql(0);
        });

        describe('relationships', function () {
            it('should set up category as belongsTo VehicleCategory', function () {
                const model = models.VehiclePricingRule.forge({});
                const belongsToSpy = sinon.spy(model, 'belongsTo');
                model.category();

                should.equal(belongsToSpy.args[0][0], 'VehicleCategory');
                should.equal(belongsToSpy.args[0][1], 'category_id');
            });

            it('should set up vehicle as belongsTo Vehicle', function () {
                const model = models.VehiclePricingRule.forge({});
                const belongsToSpy = sinon.spy(model, 'belongsTo');
                model.vehicle();

                should.equal(belongsToSpy.args[0][0], 'Vehicle');
                should.equal(belongsToSpy.args[0][1], 'vehicle_id');
            });
        });
    });

    // -------------------------------------------------------
    // VehicleReview
    // -------------------------------------------------------
    describe('VehicleReview', function () {
        it('should have correct tableName', function () {
            const review = models.VehicleReview.forge({});
            review.tableName.should.eql('vehicle_reviews');
        });

        describe('onSaving - rating validation', function () {
            it('should throw ValidationError when rating is less than 1', function () {
                const review = models.VehicleReview.forge({rating: 0});

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                (function () {
                    review.onSaving(review, {}, {});
                }).should.throw(/rating must be between 1 and 5/);
            });

            it('should throw ValidationError when rating is greater than 5', function () {
                const review = models.VehicleReview.forge({rating: 6});

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                (function () {
                    review.onSaving(review, {}, {});
                }).should.throw(/rating must be between 1 and 5/);
            });

            it('should throw ValidationError when rating is not a number', function () {
                const review = models.VehicleReview.forge({rating: 'abc'});

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                (function () {
                    review.onSaving(review, {}, {});
                }).should.throw(/rating must be between 1 and 5/);
            });

            it('should not throw when rating is 1', function () {
                const review = models.VehicleReview.forge({rating: 1});

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                (function () {
                    review.onSaving(review, {}, {});
                }).should.not.throw();
            });

            it('should not throw when rating is 5', function () {
                const review = models.VehicleReview.forge({rating: 5});

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                (function () {
                    review.onSaving(review, {}, {});
                }).should.not.throw();
            });

            it('should not throw when rating is 3', function () {
                const review = models.VehicleReview.forge({rating: 3});

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                (function () {
                    review.onSaving(review, {}, {});
                }).should.not.throw();
            });

            it('should not throw when rating is null', function () {
                const review = models.VehicleReview.forge({rating: null});

                sinon.stub(models.Base.Model.prototype, 'onSaving').returns(undefined);

                (function () {
                    review.onSaving(review, {}, {});
                }).should.not.throw();
            });
        });

        describe('relationships', function () {
            it('should set up vehicle as belongsTo Vehicle', function () {
                const model = models.VehicleReview.forge({});
                const belongsToSpy = sinon.spy(model, 'belongsTo');
                model.vehicle();

                should.equal(belongsToSpy.args[0][0], 'Vehicle');
                should.equal(belongsToSpy.args[0][1], 'vehicle_id');
            });

            it('should set up member as belongsTo Member', function () {
                const model = models.VehicleReview.forge({});
                const belongsToSpy = sinon.spy(model, 'belongsTo');
                model.member();

                should.equal(belongsToSpy.args[0][0], 'Member');
                should.equal(belongsToSpy.args[0][1], 'member_id');
            });

            it('should set up reservation as belongsTo VehicleReservation', function () {
                const model = models.VehicleReview.forge({});
                const belongsToSpy = sinon.spy(model, 'belongsTo');
                model.reservation();

                should.equal(belongsToSpy.args[0][0], 'VehicleReservation');
                should.equal(belongsToSpy.args[0][1], 'reservation_id');
            });
        });
    });

    // -------------------------------------------------------
    // VehicleReservationEvent
    // -------------------------------------------------------
    describe('VehicleReservationEvent', function () {
        it('should have correct tableName', function () {
            const event = models.VehicleReservationEvent.forge({});
            event.tableName.should.eql('vehicle_reservation_events');
        });

        describe('relationships', function () {
            it('should set up reservation as belongsTo VehicleReservation', function () {
                const model = models.VehicleReservationEvent.forge({});
                const belongsToSpy = sinon.spy(model, 'belongsTo');
                model.reservation();

                should.equal(belongsToSpy.args[0][0], 'VehicleReservation');
                should.equal(belongsToSpy.args[0][1], 'reservation_id');
            });
        });
    });
});
