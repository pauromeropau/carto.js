/* global google */
var _ = require('underscore');
var log = require('cdb.log');
var MapView = require('../map-view');
var Projector = require('./projector');
var GMapsLayerViewFactory = require('./gmaps-layer-view-factory');

var GoogleMapsMapView = MapView.extend({
  initialize: function () {
    MapView.prototype.initialize.call(this);
    _.bindAll(this, '_ready');
    this._isReady = false;
  },

  _createNativeMap: function () {
    var self = this;
    var center = this.map.get('center');

    this._gmapsMap = new google.maps.Map(this.el, {
      center: new google.maps.LatLng(center[0], center[1]),
      zoom: this.map.get('zoom'),
      minZoom: this.map.get('minZoom'),
      maxZoom: this.map.get('maxZoom'),
      disableDefaultUI: true,
      scrollwheel: this.map.get('scrollwheel'),
      draggable: this.map.get('drag'),
      disableDoubleClickZoom: !this.map.get('drag'),
      mapTypeControl: false,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      backgroundColor: 'white',
      tilt: 0
    });

    this.map.bind('change:maxZoom', function () {
      self._gmapsMap.setOptions({ maxZoom: self.map.get('maxZoom') });
    }, this);

    this.map.bind('change:minZoom', function () {
      self._gmapsMap.setOptions({ minZoom: self.map.get('minZoom') });
    }, this);

    google.maps.event.addListener(this._gmapsMap, 'center_changed', function () {
      var c = self._gmapsMap.getCenter();
      self._setModelProperty({ center: [c.lat(), c.lng()] });
    });

    google.maps.event.addListener(this._gmapsMap, 'zoom_changed', function () {
      self._setModelProperty({
        zoom: self._gmapsMap.getZoom()
      });
      var c = self._gmapsMap.getCenter();
      self.map.trigger('moveend', [c.lat(), c.lng()]);
    });

    google.maps.event.addListener(this._gmapsMap, 'click', function (e) {
      self.trigger('click', e, [e.latLng.lat(), e.latLng.lng()]);
    });

    google.maps.event.addListener(this._gmapsMap, 'dragend', function (e) {
      var c = self._gmapsMap.getCenter();
      self.trigger('dragend', [c.lat(), c.lng()]);
      self.map.trigger('moveend', [c.lat(), c.lng()]);
    });

    google.maps.event.addListener(this._gmapsMap, 'dblclick', function (e) {
      self.trigger('dblclick', e);
    });

    this.projector = new Projector(this._gmapsMap);

    this.projector.draw = this._ready;
  },

  _getLayerViewFactory: function () {
    this._layerViewFactory = this._layerViewFactory || new GMapsLayerViewFactory({
      vector: this.map.get('vector')
    });

    return this._layerViewFactory;
  },

  _ready: function () {
    this.projector.draw = function () {};
    this.trigger('ready');
    this._isReady = true;
  },

  _setKeyboard: function (model, z) {
    this._gmapsMap.setOptions({ keyboardShortcuts: z });
  },

  _setScrollWheel: function (model, z) {
    this._gmapsMap.setOptions({ scrollwheel: z });
  },

  _setZoom: function (model, z) {
    z = z || 0;
    this._gmapsMap.setZoom(z);
  },

  _setCenter: function (model, center) {
    var c = new google.maps.LatLng(center[0], center[1]);
    this._gmapsMap.setCenter(c);
  },

  _getNativeMap: function () {
    return this._gmapsMap;
  },

  _addLayerToMap: function (layerView, layerModel, opts) {
    if (layerView) {
      var isBaseLayer = _.keys(this._layerViews).length === 1 || (opts && opts.index === 0) || layerModel.get('order') === 0;
      // set base layer
      if (isBaseLayer) {
        var m = layerView.model;
        if (m.get('type') !== 'GMapsBase') {
          layerView.isBase = true;
        }
      } else {
        // TODO: Make sure this order will be right
        var idx = layerModel.get('order');
        if (layerView.getTile) {
          if (!layerView.gmapsLayer) {
            log.error("gmaps layer can't be null");
          }
          this._gmapsMap.overlayMapTypes.setAt(idx, layerView.gmapsLayer);
        } else {
          layerView.gmapsLayer.setMap(this._gmapsMap);
        }
      }
      if (opts === undefined || !opts.silent) {
        this.trigger('newLayerView', layerView, layerModel, this);
      }
    } else {
      log.error('layer type not supported');
    }

    return layerView;
  },

  getSize: function () {
    return {
      x: this.$el.width(),
      y: this.$el.height()
    };
  },

  panBy: function (p) {
    var c = this.map.get('center');
    var pc = this.latLngToContainerPoint(c);
    p.x += pc.x;
    p.y += pc.y;
    var ll = this.containerPointToLatLng(p);
    this.map.setCenter([ll.lat, ll.lng]);
  },

  getBounds: function () {
    if (this._isReady) {
      var b = this._gmapsMap.getBounds();
      var sw = b.getSouthWest();
      var ne = b.getNorthEast();
      return [
        [sw.lat(), sw.lng()],
        [ne.lat(), ne.lng()]
      ];
    }
    return [ [0, 0], [0, 0] ];
  },

  _setAttribution: function () {
    // There is no control over Google Maps attribution component, so we can't add
    // any attribution text there (if Map is already created using createLayer for example)
    // and there is no CartoDB attribution component.
  },

  setCursor: function (cursor) {
    this._gmapsMap.setOptions({ draggableCursor: cursor });
  },

  getNativeMap: function () {
    return this._gmapsMap;
  },

  invalidateSize: function () {
    google.maps.event.trigger(this._gmapsMap, 'resize');
  },

  // GEOMETRY

  addMarker: function (marker) {
    marker.addToMap(this.getNativeMap());
  },

  removeMarker: function (marker) {
    marker.removeFromMap(this.getNativeMap());
  },

  hasMarker: function (marker) {
    return marker.isAddedToMap(this.getNativeMap());
  },

  addPath: function (path) {
    path.addToMap(this.getNativeMap());
  },

  removePath: function (path) {
    path.removeFromMap(this.getNativeMap());
  },

  latLngToContainerPoint: function (latlng) {
    var point = this.projector.latLngToPixel(new google.maps.LatLng(latlng[0], latlng[1]));
    return {
      x: point.x,
      y: point.y
    };
  },

  containerPointToLatLng: function (point) {
    var latlng = this.projector.pixelToLatLng(new google.maps.Point(point.x, point.y));
    return {
      lat: latlng.lat(),
      lng: latlng.lng()
    };
  }
});

module.exports = GoogleMapsMapView;
