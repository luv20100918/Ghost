const ghostBookshelf = require('./base');
const uuid = require('uuid');
const _ = require('lodash');
const errors = require('@tryghost/errors');

const Vehicle = ghostBookshelf.Model.extend({
    tableName: 'vehicles',

    defaults() {
        return {
            uuid: uuid.v4(),
            status: 'available',
            mileage: 0,
            fuel_type: 'gasoline',
            seats: 5,
            transmission: 'automatic'
        };
    },

    relationships: ['category'],

    relationshipBelongsTo: {
        category: 'vehicle_categories'
    },

    category: function category() {
        return this.belongsTo('VehicleCategory', 'category_id');
    },

    reservations: function reservations() {
        return this.hasMany('VehicleReservation', 'vehicle_id');
    },

    reviews: function reviews() {
        return this.hasMany('VehicleReview', 'vehicle_id');
    },

    emitChange: function emitChange(event, options) {
        const eventToTrigger = 'vehicle' + '.' + event;
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
        const self = this;

        ghostBookshelf.Model.prototype.onSaving.apply(this, arguments);

        // Make sure name is trimmed of extra spaces
        let name = this.get('name') && this.get('name').trim();
        this.set('name', name);

        // Validate daily_rate is positive
        const dailyRate = this.get('daily_rate');
        if (dailyRate !== undefined && dailyRate !== null && dailyRate <= 0) {
            throw new errors.ValidationError({
                message: 'daily_rate must be greater than 0'
            });
        }

        if (this.hasChanged('slug') || (!this.get('slug') && this.get('name'))) {
            return ghostBookshelf.Model.generateSlug(Vehicle, this.get('slug') || this.get('name'),
                {transacting: options.transacting})
                .then(function then(slug) {
                    self.set({slug: slug});
                });
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
            options.withRelated = _.union(['category'], options.withRelated || []);
        }

        return options;
    },

    searchQuery: function searchQuery(queryBuilder, query) {
        queryBuilder.where('vehicles.name', 'like', `%${query}%`);
        queryBuilder.orWhere('vehicles.make', 'like', `%${query}%`);
        queryBuilder.orWhere('vehicles.model', 'like', `%${query}%`);
        queryBuilder.orWhere('vehicles.license_plate', 'like', `%${query}%`);
    },

    toJSON: function toJSON(unfilteredOptions) {
        const options = Vehicle.filterOptions(unfilteredOptions, 'toJSON');
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
            resource_type: 'vehicle',
            actor_id: actor.id,
            actor_type: actor.type
        };
    }
}, {
    orderDefaultOptions: function orderDefaultOptions() {
        return {
            name: 'ASC',
            created_at: 'DESC'
        };
    },

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

const Vehicles = ghostBookshelf.Collection.extend({
    model: Vehicle
});

module.exports = {
    Vehicle: ghostBookshelf.model('Vehicle', Vehicle),
    Vehicles: ghostBookshelf.collection('Vehicles', Vehicles)
};
