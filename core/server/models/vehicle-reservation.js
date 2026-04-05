const ghostBookshelf = require('./base');
const uuid = require('uuid');
const _ = require('lodash');
const errors = require('@tryghost/errors');

const VehicleReservation = ghostBookshelf.Model.extend({
    tableName: 'vehicle_reservations',

    defaults() {
        return {
            uuid: uuid.v4(),
            status: 'pending',
            currency: 'usd',
            discount_amount: 0
        };
    },

    relationships: ['vehicle', 'member', 'events'],

    relationshipBelongsTo: {
        vehicle: 'vehicles',
        member: 'members'
    },

    vehicle: function vehicle() {
        return this.belongsTo('Vehicle', 'vehicle_id');
    },

    member: function member() {
        return this.belongsTo('Member', 'member_id');
    },

    events: function events() {
        return this.hasMany('VehicleReservationEvent', 'reservation_id');
    },

    reviews: function reviews() {
        return this.hasMany('VehicleReview', 'reservation_id');
    },

    emitChange: function emitChange(event, options) {
        const eventToTrigger = 'vehicle_reservation' + '.' + event;
        ghostBookshelf.Model.prototype.emitChange.bind(this)(this, eventToTrigger, options);
    },

    onCreated: function onCreated(model, attrs, options) {
        ghostBookshelf.Model.prototype.onCreated.apply(this, arguments);

        model.emitChange('added', options);
    },

    onUpdated: function onUpdated(model, attrs, options) {
        ghostBookshelf.Model.prototype.onUpdated.apply(this, arguments);

        model.emitChange('edited', options);
    },

    onDestroyed: function onDestroyed(model, options) {
        ghostBookshelf.Model.prototype.onDestroyed.apply(this, arguments);

        model.emitChange('deleted', options);
    },

    onDestroying: function onDestroying(model) {
        ghostBookshelf.Model.prototype.onDestroying.apply(this, arguments);
    },

    onSaving: function onSaving(model, attr, options) {
        ghostBookshelf.Model.prototype.onSaving.apply(this, arguments);

        const pickupDate = this.get('pickup_date');
        const returnDate = this.get('return_date');

        // Validate pickup_date < return_date
        if (pickupDate && returnDate) {
            const pickup = new Date(pickupDate);
            const returnD = new Date(returnDate);

            if (pickup >= returnD) {
                throw new errors.ValidationError({
                    message: 'pickup_date must be before return_date'
                });
            }

            // Calculate total_amount if not set
            if (!this.get('total_amount') && this.get('daily_rate')) {
                const diffTime = Math.abs(returnD - pickup);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const dailyRate = parseFloat(this.get('daily_rate'));
                const discountAmount = parseFloat(this.get('discount_amount') || 0);
                const totalAmount = (diffDays * dailyRate) - discountAmount;
                this.set('total_amount', Math.max(0, totalAmount));
            }
        }
    },

    permittedAttributes: function permittedAttributes() {
        let filteredKeys = ghostBookshelf.Model.prototype.permittedAttributes.apply(this, arguments);

        this.relationships.forEach((key) => {
            filteredKeys.push(key);
        });

        return filteredKeys;
    },

    defaultRelations: function defaultRelations(methodName, options) {
        if (['edit', 'add', 'destroy'].indexOf(methodName) !== -1) {
            options.withRelated = _.union(['vehicle', 'member'], options.withRelated || []);
        }

        return options;
    },

    toJSON: function toJSON(unfilteredOptions) {
        const options = VehicleReservation.filterOptions(unfilteredOptions, 'toJSON');
        const attrs = ghostBookshelf.Model.prototype.toJSON.call(this, options);

        return attrs;
    },

    getAction(event, options) {
        const actor = this.getActor(options);

        if (!actor) {
            return;
        }

        return {
            event: event,
            resource_id: this.id || this.previous('id'),
            resource_type: 'vehicle_reservation',
            actor_id: actor.id,
            actor_type: actor.type
        };
    }
}, {
    permittedOptions: function permittedOptions(methodName) {
        let options = ghostBookshelf.Model.permittedOptions.call(this, methodName);

        if (['findPage', 'findAll'].includes(methodName)) {
            options = options.concat(['search']);
        }

        return options;
    },

    add(data, unfilteredOptions = {}) {
        if (!unfilteredOptions.transacting) {
            return ghostBookshelf.transaction((transacting) => {
                return this.add(data, Object.assign({transacting}, unfilteredOptions));
            });
        }
        return ghostBookshelf.Model.add.call(this, data, unfilteredOptions);
    },

    edit(data, unfilteredOptions = {}) {
        if (!unfilteredOptions.transacting) {
            return ghostBookshelf.transaction((transacting) => {
                return this.edit(data, Object.assign({transacting}, unfilteredOptions));
            });
        }
        return ghostBookshelf.Model.edit.call(this, data, unfilteredOptions);
    },

    destroy(unfilteredOptions = {}) {
        if (!unfilteredOptions.transacting) {
            return ghostBookshelf.transaction((transacting) => {
                return this.destroy(Object.assign({transacting}, unfilteredOptions));
            });
        }
        return ghostBookshelf.Model.destroy.call(this, unfilteredOptions);
    }
});

const VehicleReservations = ghostBookshelf.Collection.extend({
    model: VehicleReservation
});

module.exports = {
    VehicleReservation: ghostBookshelf.model('VehicleReservation', VehicleReservation),
    VehicleReservations: ghostBookshelf.collection('VehicleReservations', VehicleReservations)
};
