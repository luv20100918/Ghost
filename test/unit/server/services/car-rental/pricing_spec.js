const should = require('should');
const sinon = require('sinon');
const models = require('../../../../../core/server/models');

const pricingEngine = require('../../../../../core/server/services/car-rental/pricing');

describe('Car Rental - PricingEngine', function () {
    afterEach(function () {
        sinon.restore();
    });

    describe('calculatePrice', function () {
        it('Should calculate base price as daily_rate * days', async function () {
            sinon.stub(models.Vehicle, 'findOne').resolves({
                get: sinon.stub().callsFake(function (key) {
                    const data = {daily_rate: 50, category_id: 'cat-1'};
                    return data[key];
                })
            });

            sinon.stub(pricingEngine, 'getApplicableRules').resolves([]);

            const result = await pricingEngine.calculatePrice({
                vehicleId: 'v-1',
                pickupDate: '2026-05-10',
                returnDate: '2026-05-13'
            });

            result.daily_rate.should.equal(50);
            result.rental_days.should.equal(3);
            result.base_amount.should.equal(150); // 50 * 3
            result.total_amount.should.equal(150);
        });

        it('Should apply pricing rules', async function () {
            sinon.stub(models.Vehicle, 'findOne').resolves({
                get: sinon.stub().callsFake(function (key) {
                    const data = {daily_rate: 100, category_id: 'cat-1'};
                    return data[key];
                })
            });

            sinon.stub(pricingEngine, 'getApplicableRules').resolves([
                {
                    id: 'rule-1',
                    name: 'Peak Season',
                    rule_type: 'season',
                    multiplier: '1.5',
                    discount_percent: 0
                },
                {
                    id: 'rule-2',
                    name: 'Long Rental Discount',
                    rule_type: 'duration',
                    multiplier: null,
                    discount_percent: 10
                }
            ]);

            const result = await pricingEngine.calculatePrice({
                vehicleId: 'v-1',
                pickupDate: '2026-05-10',
                returnDate: '2026-05-15'
            });

            result.rental_days.should.equal(5);
            result.base_amount.should.equal(500); // 100 * 5
            result.multiplier.should.equal(1.5);
            result.discount_percent.should.equal(10);

            // adjustedAmount = round(500 * 1.5) = 750
            // discountAmount = round(750 * 0.10) = 75
            // totalAmount = 750 - 75 = 675
            result.total_amount.should.equal(675);
            result.applied_rules.should.be.an.Array().with.lengthOf(2);
            result.applied_rules[0].name.should.equal('Peak Season');
        });

        it('Should cap discount at 70%', async function () {
            sinon.stub(models.Vehicle, 'findOne').resolves({
                get: sinon.stub().callsFake(function (key) {
                    const data = {daily_rate: 200, category_id: 'cat-1'};
                    return data[key];
                })
            });

            sinon.stub(pricingEngine, 'getApplicableRules').resolves([
                {
                    id: 'rule-1',
                    name: 'Mega Discount 1',
                    rule_type: 'promo',
                    multiplier: null,
                    discount_percent: 50
                },
                {
                    id: 'rule-2',
                    name: 'Mega Discount 2',
                    rule_type: 'promo',
                    multiplier: null,
                    discount_percent: 40
                }
            ]);

            const result = await pricingEngine.calculatePrice({
                vehicleId: 'v-1',
                pickupDate: '2026-05-10',
                returnDate: '2026-05-12'
            });

            // Combined discount would be 90%, but capped at 70%
            result.discount_percent.should.equal(70);
            result.base_amount.should.equal(400); // 200 * 2
            // adjustedAmount = 400, discountAmount = round(400 * 0.70) = 280
            // totalAmount = 400 - 280 = 120
            result.total_amount.should.equal(120);
        });

        it('Should return detailed breakdown', async function () {
            sinon.stub(models.Vehicle, 'findOne').resolves({
                get: sinon.stub().callsFake(function (key) {
                    const data = {daily_rate: 80, category_id: 'cat-1'};
                    return data[key];
                })
            });

            sinon.stub(pricingEngine, 'getApplicableRules').resolves([]);

            const result = await pricingEngine.calculatePrice({
                vehicleId: 'v-1',
                pickupDate: '2026-05-10',
                returnDate: '2026-05-14'
            });

            result.should.have.property('breakdown');
            result.should.have.property('vehicle_id', 'v-1');
            result.should.have.property('currency', 'usd');
            result.should.have.property('applied_rules');
            result.breakdown.should.have.properties('기본요금', '시즌조정', '할인', '최종금액');
        });
    });

    describe('getPriceRange', function () {
        it('Should return min/max/avg rates for category', async function () {
            const queryBuilder = {
                where: sinon.stub().returnsThis(),
                select: sinon.stub().returnsThis(),
                first: sinon.stub().resolves({
                    min_rate: 30,
                    max_rate: 120,
                    avg_rate: 65.5,
                    vehicle_count: 8
                })
            };

            const knexStub = sinon.stub().returns(queryBuilder);
            // Need to stub raw as well since it is called inside select
            knexStub.raw = sinon.stub().returnsArg(0);
            sinon.stub(models.Base, 'knex').value(knexStub);

            const result = await pricingEngine.getPriceRange('cat-suv');

            result.category_id.should.equal('cat-suv');
            result.min_daily_rate.should.equal(30);
            result.max_daily_rate.should.equal(120);
            result.avg_daily_rate.should.equal(66); // Math.round(65.5)
            result.available_vehicles.should.equal(8);

            knexStub.calledWith('vehicles').should.be.true();
            queryBuilder.where.calledWith('category_id', 'cat-suv').should.be.true();
            queryBuilder.where.calledWith('status', 'available').should.be.true();
        });
    });
});
