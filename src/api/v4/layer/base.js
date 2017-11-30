var _ = require('underscore');
var Backbone = require('backbone');

/**
 * Base layer object.
 *
 * @constructor
 * @abstract
 * @memberof carto.layer
 * @api
 */
function Base () {
  this._id = Base.$generateId();
}

_.extend(Base.prototype, Backbone.Events);

/**
 * Get the unique autogenerated id.
 * 
 * @return {string} Unique autogenerated id
 * 
 */
Base.prototype.getId = function () {
  return this._id;
};

/**
 * The instance id will be autogenerated by incrementing this variable.
 */
Base.$nextId = 0;

/**
 * Static funciton used internally to autogenerate source ids.
 */
Base.$generateId = function () {
  return 'L' + ++Base.$nextId;
};

/**
 * Return the real carto.js model used by the layer.
 */
Base.prototype.$getInternalModel = function () {
  return this._internalModel;
};

module.exports = Base;

function generateColors (buckets) {
  if (!buckets && _.isEmpty(buckets)) {
    return [];
  }
  if (buckets.length === 1) {
    var bucket = buckets[0];
    var labelStart = bucket.filter.start;
    var labelEnd = bucket.filter.end;
    return [{ value: bucket.value, label: labelStart.toString() }, { value: bucket.value, label: labelEnd.toString() }];
  }
  return _.map(buckets, function (bucket, i) {
    var label = '';
    if (i === 0) {
      label = bucket.filter.start;
    }
    if (i === buckets.length - 1) {
      label = bucket.filter.end;
    }
    return { value: bucket.value, label: label.toString() };
  });
}
