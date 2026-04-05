const Promise = require('bluebird');
const {i18n} = require('../../lib/common');
const errors = require('@tryghost/errors');
const models = require('../../models');

const ALLOWED_INCLUDES = ['category'];

module.exports = {
    docName: 'vehicles',

    browse: {
        options: [
            'include',
            'filter',
            'fields',
            'limit',
            'order',
            'page'
        ],
        validation: {
            options: {
                include: {
                    values: ALLOWED_INCLUDES
                }
            }
        },
        permissions: true,
        query(frame) {
            // Only return available vehicles for public API
            frame.options.filter = frame.options.filter
                ? `${frame.options.filter}+status:available`
                : 'status:available';

            return models.Vehicle.findPage(frame.options);
        }
    },

    read: {
        options: [
            'include',
            'filter',
            'fields'
        ],
        data: [
            'id',
            'slug'
        ],
        validation: {
            options: {
                include: {
                    values: ALLOWED_INCLUDES
                }
            }
        },
        permissions: true,
        query(frame) {
            return models.Vehicle.findOne(frame.data, frame.options)
                .then((model) => {
                    if (!model) {
                        return Promise.reject(new errors.NotFoundError({
                            message: i18n.t('errors.api.resource.resourceNotFound', {resource: 'Vehicle'})
                        }));
                    }

                    return model;
                });
        }
    }
};
