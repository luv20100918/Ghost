const ghostBookshelf = require('./base');
const {i18n} = require('../lib/common');
const errors = require('@tryghost/errors');

let VehicleCategory;
let VehicleCategories;

VehicleCategory = ghostBookshelf.Model.extend({

    tableName: 'vehicle_categories',

    emitChange: function emitChange(event, options) {
        const eventToTrigger = 'vehicle_category' + '.' + event;
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

    onSaving: function onSaving(newVehicleCategory, attr, options) {
        const self = this;

        ghostBookshelf.Model.prototype.onSaving.apply(this, arguments);

        // Make sure name is trimmed of extra spaces
        let name = this.get('name') && this.get('name').trim();
        this.set('name', name);

        if (this.hasChanged('slug') || (!this.get('slug') && this.get('name'))) {
            // Pass the new slug through the generator to strip illegal characters, detect duplicates
            return ghostBookshelf.Model.generateSlug(VehicleCategory, this.get('slug') || this.get('name'),
                {transacting: options.transacting})
                .then(function then(slug) {
                    self.set({slug: slug});
                });
        }
    },

    vehicles: function vehicles() {
        return this.hasMany('Vehicle', 'category_id');
    },

    toJSON: function toJSON(unfilteredOptions) {
        const options = VehicleCategory.filterOptions(unfilteredOptions, 'toJSON');
        const attrs = ghostBookshelf.Model.prototype.toJSON.call(this, options);

        return attrs;
    },

    getAction(event, options) {
        const actor = this.getActor(options);

        // @NOTE: we ignore internal updates (`options.context.internal`) for now
        if (!actor) {
            return;
        }

        return {
            event: event,
            resource_id: this.id || this.previous('id'),
            resource_type: 'vehicle_category',
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

        const validOptions = {
            findAll: ['columns'],
            findOne: ['columns'],
            destroy: ['destroyAll']
        };

        if (validOptions[methodName]) {
            options = options.concat(validOptions[methodName]);
        }

        return options;
    },

    destroy: function destroy(unfilteredOptions) {
        const options = this.filterOptions(unfilteredOptions, 'destroy', {extraAllowedProperties: ['id']});
        options.withRelated = ['vehicles'];

        return this.forge({id: options.id})
            .fetch(options)
            .then(function destroyVehiclesAndCategory(vehicleCategory) {
                if (!vehicleCategory) {
                    return Promise.reject(new errors.NotFoundError({
                        message: i18n.t('errors.api.resource.resourceNotFound', {resource: 'VehicleCategory'})
                    }));
                }

                if (vehicleCategory.related('vehicles').length > 0) {
                    return Promise.reject(new errors.InternalServerError({
                        message: 'Cannot delete category with associated vehicles'
                    }));
                }

                return vehicleCategory.destroy(options);
            });
    }
});

VehicleCategories = ghostBookshelf.Collection.extend({
    model: VehicleCategory
});

module.exports = {
    VehicleCategory: ghostBookshelf.model('VehicleCategory', VehicleCategory),
    VehicleCategories: ghostBookshelf.collection('VehicleCategories', VehicleCategories)
};
