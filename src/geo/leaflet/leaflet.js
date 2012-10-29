/**
* leaflet implementation of a map
*/
(function() {

if(typeof(L) == "undefined") 
  return;

/**
 * leatlef impl
 */
cdb.geo.LeafletMapView = cdb.geo.MapView.extend({


  initialize: function() {

    _.bindAll(this, '_addLayer', '_removeLayer', '_setZoom', '_setCenter', '_setView');

    cdb.geo.MapView.prototype.initialize.call(this);

    var self = this;

    var center = this.map.get('center');

    var mapConfig = {
      zoomControl: false,
      center: new L.LatLng(center[0], center[1]),
      zoom: this.map.get('zoom'),
      minZoom: this.map.get('minZoom'),
      maxZoom: this.map.get('maxZoom')
    };
    if (this.map.get('bounding_box_ne')) {
      //mapConfig.maxBounds = [this.map.get('bounding_box_ne'), this.map.get('bounding_box_sw')];
    }

    if(!this.options.map_object) {
      this.map_leaflet = new L.Map(this.el, mapConfig);

      // remove the "powered by leaflet" 
      this.map_leaflet.attributionControl.setPrefix('');
    } else {
      this.map_leaflet = this.options.map_object;
      this.setElement(this.map_leaflet.getContainer());
      var c = self.map_leaflet.getCenter();
      self._setModelProperty({ center: [c.lat, c.lng] });
      self._setModelProperty({ zoom: self.map_leaflet.getZoom() });
    }

    // looks like leaflet dont like to change the bounds just after the inicialization
    var bounds = this.map.getViewBounds();
    if(bounds) {
      this.showBounds(bounds);
    }

    this.map.bind('set_view', this._setView, this);
    this.map.layers.bind('add', this._addLayer, this);
    this.map.layers.bind('remove', this._removeLayer, this);
    this.map.layers.bind('reset', this._addLayers, this);

    this.map.geometries.bind('add', this._addGeometry, this);
    this.map.geometries.bind('remove', this._removeGeometry, this);

    this._bindModel();

    this._addLayers();

    this.map_leaflet.on('layeradd', function(lyr) {
      this.trigger('layeradd', lyr, self);
    }, this);

    this.map_leaflet.on('zoomstart', function() {
      self.trigger('zoomstart');
    });

    this.map_leaflet.on('click', function(e) {
      self.trigger('click', e.originalEvent, [e.latlng.lat, e.latlng.lng]);
    });

    this.map_leaflet.on('dblclick', function(e) {
      self.trigger('dblclick', e.originalEvent);
    });

    this.map_leaflet.on('zoomend', function() {
      self._setModelProperty({
        zoom: self.map_leaflet.getZoom()
      });
      self.trigger('zoomend');
    }, this);

    this.map_leaflet.on('move', function() {
      var c = self.map_leaflet.getCenter();
      self._setModelProperty({ center: [c.lat, c.lng] });
    });

    this.map_leaflet.on('drag', function() {
      var c = self.map_leaflet.getCenter();
      self._setModelProperty({
        center: [c.lat, c.lng]
      });
      self.trigger('drag');
    }, this);

    this.map.bind('change:maxZoom', function() {
      L.Util.setOptions(self.map_leaflet, { maxZoom: self.map.get('maxZoom') });
    }, this);

    this.map.bind('change:minZoom', function() {
      L.Util.setOptions(self.map_leaflet, { minZoom: self.map.get('minZoom') });
    }, this);

    this.trigger('ready');

  },


  clean: function() {
    //see https://github.com/CloudMade/Leaflet/issues/1101
    L.DomEvent.off(window, 'resize', this.map_leaflet._onResize, this.map_leaflet);
    // do not change by elder
    cdb.core.View.prototype.clean.call(this);
  },

  _setZoom: function(model, z) {
    this._setView();
  },

  _setCenter: function(model, center) {
    this._setView();
  },

  _setView: function() {
    this.map_leaflet.setView(this.map.get("center"), this.map.get("zoom") || 0 );
  },

  _addGeomToMap: function(geom) {
    var geo = cdb.geo.LeafletMapView.createGeometry(geom);
    geo.geom.addTo(this.map_leaflet);
    return geo;
  },

  _removeGeomFromMap: function(geo) {
    this.map_leaflet.removeLayer(geo.geom);
  },

  createLayer: function(layer) {
    return cdb.geo.LeafletMapView.createLayer(layer, this.map_leaflet);
  },

  _addLayer: function(layer, layers, opts) {
    var self = this;
    var lyr, layer_view;

    layer_view = cdb.geo.LeafletMapView.createLayer(layer, this.map_leaflet);
    if(!layer_view) {
      return;
    }

    var appending = !opts || opts.index === undefined;
    // since leaflet does not support layer ordering 
    // add the layers should be removed and added again
    // if the layer is being appended do not clear
    if(!appending) {
      for(var i in this.layers) {
        this.map_leaflet.removeLayer(this.layers[i]);
      }
    }

    this.layers[layer.cid] = layer_view;

    // add them again, in correct order
    if(appending) {
      cdb.geo.LeafletMapView.addLayerToMap(layer_view, self.map_leaflet);
    } else {
      this.map.layers.each(function(layerModel) {
        var v = self.layers[layerModel.cid];
        if(v) {
          cdb.geo.LeafletMapView.addLayerToMap(v, self.map_leaflet);
        }
      });
    }
    /*
    var attr = layer.get('attribution');
    if(attr) {
      this.addAttribution(attr);
    }
    */

    this.trigger('newLayerView', layer_view, this);
  },

  latLonToPixel: function(latlon) {
    var point = this.map_leaflet.latLngToLayerPoint(new L.LatLng(latlon[0], latlon[1]));
    return this.map_leaflet.layerPointToContainerPoint(point);
  },

  // return the current bounds of the map view
  getBounds: function() {
    var b = this.map_leaflet.getBounds();
    var sw = b.getSouthWest();
    var ne = b.getNorthEast();
    return [
      [sw.lat, sw.lng],
      [ne.lat, ne.lng]
    ];
  },

  getSize: function() {
    return this.map_leaflet.getSize();
  },

  panBy: function(p) {
    this.map_leaflet.panBy(new L.Point(p.x, p.y));
  },

  setCursor: function(cursor) {
    $(this.map_leaflet.getContainer()).css('cursor', cursor);
  }

}, {

  layerTypeMap: {
    "tiled": cdb.geo.LeafLetTiledLayerView,
    "cartodb": cdb.geo.LeafLetLayerCartoDBView,
    "carto": cdb.geo.LeafLetLayerCartoDBView,
    "plain": cdb.geo.LeafLetPlainLayerView,
    // for google maps create a plain layer
    "gmapsbase": cdb.geo.LeafLetPlainLayerView
  },

  createLayer: function(layer, map) {
    var layer_view = null;
    var layerClass = this.layerTypeMap[layer.get('type').toLowerCase()];

    if (layerClass) {
      layer_view = new layerClass(layer, map);
    } else {
      cdb.log.error("MAP: " + layer.get('type') + " can't be created");
    }
    return layer_view;
  },

  addLayerToMap: function(layer_view, map) {
    map.addLayer(layer_view.leafletLayer);
  },

  /**
   * create the view for the geometry model
   */
  createGeometry: function(geometryModel) {
    if(geometryModel.isPoint()) {
      return new cdb.geo.leaflet.PointView(geometryModel);
    }
    return new cdb.geo.leaflet.PathView(geometryModel);
  }


});

})();
