const ghostBookshelf = require('./base');

const VehicleReservationEvent = ghostBookshelf.Model.extend({
    tableName: 'vehicle_reservation_events',

    reservation: function reservation() {
        return this.belongsTo('VehicleReservation', 'reservation_id');
    }
}, {
    permittedOptions: function permittedOptions(methodName) {
        let options = ghostBookshelf.Model.permittedOptions.call(this, methodName);

        const validOptions = {
            findAll: ['columns']
        };

        if (validOptions[methodName]) {
            options = options.concat(validOptions[methodName]);
        }

        return options;
    }
});

const VehicleReservationEvents = ghostBookshelf.Collection.extend({
    model: VehicleReservationEvent
});

module.exports = {
    VehicleReservationEvent: ghostBookshelf.model('VehicleReservationEvent', VehicleReservationEvent),
    VehicleReservationEvents: ghostBookshelf.collection('VehicleReservationEvents', VehicleReservationEvents)
};
