var s;

window.lazyLoadCesium = function() {
    if (!s) {
        s = document.createElement("script");
        s.type = "text/javascript";
        s.src = '../' + cs;
        console.log('loading Cesium...');
        document.body.appendChild(s);
    }
    return s;
};

var tile_layer = new ol.layer.Tile({
    source: new ol.source.XYZ({
        attributions: [new ol.Attribution({
            html: '© <a href="http://cartodb.com/attributions">CartoDB</a> ' + '© <a href="http://www.openstreetmap.org/copyright">' + 'OpenStreetMap contributors</a>'
        })],
        url:'https://cartocdn_{a-d}.global.ssl.fastly.net/base-antique/{z}/{x}/{y}.png'
    })
});

var map2d = new ol.Map({
    layers: [
        tile_layer
    ], 
    controls: [
        new ol.control.Zoom({
        }),
        new ol.control.Attribution({
            collapsible: false
        })
    ],
    target: 'map',
    view: new ol.View({
        center: ol.proj.transform([25, 20], 'EPSG:4326', 'EPSG:3857'),
        zoom: 2
    })
});

var map3d;

function _doToggle() {
    map3d.setEnabled(!map3d.getEnabled());
}

function toggle3D() {
    if (!map3d) {
        var s = window.lazyLoadCesium();
        s.onload = function() {
            init3D();
            _doToggle();
        };
    } else {
        _doToggle();
    }
}

function init3D() {
    map3d = new olcs.OLCesium({map: map2d});
    var scene = map3d.getCesiumScene();
    var terrainProvider = new Cesium.CesiumTerrainProvider({
        url : '//assets.agi.com/stk-terrain/world'
    });
    scene.terrainProvider = terrainProvider;
}

