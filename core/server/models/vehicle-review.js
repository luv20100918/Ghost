const ghostBookshelf = require('./base');
const errors = require('@tryghost/errors');

const VehicleReview = ghostBookshelf.Model.extend({
    tableName: 'vehicle_reviews',

    vehicle: function vehicle() {
        return this.belongsTo('Vehicle', 'vehicle_id');
    },

    member: function member() {
        return this.belongsTo('Member', 'member_id');
    },

    reservation: function reservation() {
        return this.belongsTo('VehicleReservation', 'reservation_id');
    },

    emitChange: function emitChange(event, options) {
        const eventToTrigger = 'vehicle_review' + '.' + event;
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

    onSaving: function onSaving(model, attr, options) {
        ghostBookshelf.Model.prototype.onSaving.apply(this, arguments);

        const rating = this.get('rating');

        if (rating !== undefined && rating !== null) {
            const ratingNum = parseInt(rating, 10);
            if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
                throw new errors.ValidationError({
                    message: 'rating must be between 1 and 5'
                });
            }
        }
    },

    toJSON: function toJSON(unfilteredOptions) {
        const options = VehicleReview.filterOptions(unfilteredOptions, 'toJSON');
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

const VehicleReviews = ghostBookshelf.Collection.extend({
    model: VehicleReview
});

module.exports = {
    VehicleReview: ghostBookshelf.model('VehicleReview', VehicleReview),
    VehicleReviews: ghostBookshelf.collection('VehicleReviews', VehicleReviews)
};
