const ghostBookshelf = require('./base');

const VehiclePricingRule = ghostBookshelf.Model.extend({
    tableName: 'vehicle_pricing_rules',

    defaults() {
        return {
            multiplier: '1.0000',
            discount_percent: 0,
            is_active: true,
            priority: 0
        };
    },

    category: function category() {
        return this.belongsTo('VehicleCategory', 'category_id');
    },

    vehicle: function vehicle() {
        return this.belongsTo('Vehicle', 'vehicle_id');
    },

    emitChange: function emitChange(event, options) {
        const eventToTrigger = 'vehicle_pricing_rule' + '.' + event;
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

    toJSON: function toJSON(unfilteredOptions) {
        const options = VehiclePricingRule.filterOptions(unfilteredOptions, 'toJSON');
        const attrs = ghostBookshelf.Model.prototype.toJSON.call(this, options);

        return attrs;
    }
}, {
    permittedOptions: function permittedOptions(methodName) {
        let options = ghostBookshelf.Model.permittedOptions.call(this, methodName);

        const validOptions = {
            findAll: ['columns'],
            findOne: ['columns']
        };

        if (validOptions[methodName]) {
            options = options.concat(validOptions[methodName]);
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

const VehiclePricingRules = ghostBookshelf.Collection.extend({
    model: VehiclePricingRule
});

module.exports = {
    VehiclePricingRule: ghostBookshelf.model('VehiclePricingRule', VehiclePricingRule),
    VehiclePricingRules: ghostBookshelf.collection('VehiclePricingRules', VehiclePricingRules)
};
