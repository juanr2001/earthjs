(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.earthjs = factory());
}(this, (function () { 'use strict';

var app$1 = function (options={}) {
    options = Object.assign({
        select: '#earth',
        height: 500,
        width:  700,
    }, options);
    var _ = {
        onResize: {},
        onResizeKeys: [],

        onRefresh: {},
        onRefreshKeys: [],

        onInterval: {},
        onIntervalKeys: [],

        svgCreateOrder: [
            'svgAddDropShadow',
            'svgAddCanvas',
            'canvasAddGraticule',
            'canvasAddWorldOrCountries',
            'svgAddOcean',
            'svgAddGlobeShading',
            'svgAddGraticule',
            'svgAddWorldOrCountries',
            'svgAddGlobeHilight',
            'svgAddPlaces',
            'svgAddBar',
        ],
        ready: null,
        loadingData: null
    };
    var drag = false;
    var width = options.width;
    var height = options.height;
    var ltScale = d3.scaleLinear().domain([0, width]).range([-180, 180]);
    var svg = d3.selectAll(options.select).attr("width", width).attr("height", height);
    var planet = {
        _: {
            svg,
            drag,
            options,
            ltScale,
        },
        ready: function(fn) {
            if (fn) {
                _.ready = fn;
            } else {
                return _.loadingData;
            }
        },
        register: function(obj) {
            var ar = {};
            planet[obj.name] = ar;
            Object.keys(obj).map(function(fn) {
                if ([
                    'urls',
                    'onReady',
                    'onInit',
                    'onResize',
                    'onRefresh',
                    'onInterval'].indexOf(fn)===-1) {
                    if (typeof(obj[fn])==='function') {
                        ar[fn] = function() {
                            return obj[fn].apply(planet, arguments);
                        };
                    }
                }
            });
            if (obj.onInit) {
                obj.onInit.call(planet);
            }
            qEvent(obj,'onResize');
            qEvent(obj,'onRefresh');
            qEvent(obj,'onInterval');
            if (obj.urls && obj.onReady) {
                _.loadingData = true;
                var q = d3.queue();
                obj.urls.forEach(function(url) {
                    var ext = url.split('.').pop();
                    q.defer(d3[ext], url);
                });
                q.await(function() {
                    obj.onReady.apply(planet, arguments);
                    _.loadingData = false;
                    _.ready.call(planet);
                });
            }
            return planet;
        }
    };

    planet._.defs = planet._.svg.append("defs");
    //----------------------------------------
    var earth = null;
    var ticker = null;
    planet._.ticker = function(interval) {
        interval = interval || 50;
        ticker = setInterval(function(){
            planet._.intervalRun.call(planet);
            earth && earth._.intervalRun.call(earth);
        }, interval);
        return planet;
    };

    planet.svgDraw = function(twinEarth) {
        _.svgCreateOrder.forEach(function(svgCreateKey) {
            planet[svgCreateKey] && planet[svgCreateKey].call(planet);
        });
        if (twinEarth) {
            twinEarth.svgDraw(null);
            earth = twinEarth;
        }
        if (ticker===null && twinEarth!==null) {
            planet._.ticker.call(planet);
        }
        return planet;
    };

    //----------------------------------------
    // Helper
    planet._.scale = function(y) {
        planet._.proj.scale(y);
        planet._.resize.call(planet);
        planet._.refresh.call(planet);
        return planet;
    };

    planet._.rotate = function(r) {
        planet._.proj.rotate(r);
        planet._.refresh.call(planet);
        return planet;
    };

    planet._.intervalRun = function() {
        if (_.onIntervalKeys.length>0) {
            _.onIntervalKeys.map(function(fn) {
                _.onInterval[fn].call(planet);
            });
        }
    };

    planet._.refresh = function() {
        if (_.onRefreshKeys.length>0) {
            _.onRefreshKeys.map(function(fn) {
                _.onRefresh[fn].call(planet);
            });
        }
        return planet;
    };

    planet._.resize = function() {
        if (_.onResizeKeys.length>0) {
            _.onResizeKeys.map(function(fn) {
                _.onResize[fn].call(planet);
            });
        }
        return planet;
    };

    planet._.orthoGraphic = function() {
        var width = planet._.options.width;
        var height= planet._.options.height;
        var ltRotate = planet._.ltScale(130);
        return d3.geoOrthographic()
            .scale(width / 3.5)
            .rotate([ltRotate, 0])
            .translate([width / 2, height / 2])
            .clipAngle(90);
    };

    planet._.proj = planet._.orthoGraphic();
    planet._.path = d3.geoPath().projection(planet._.proj);
    return planet;
    //----------------------------------------
    function qEvent(obj, qname) {
        var qkey = qname+'Keys';
        if (obj[qname]) {
            _[qname][obj.name] = obj[qname];
            _[qkey] = Object.keys(_[qname]);
        }
    }
};

// Version 0.0.0. Copyright 2017 Mike Bostock.
var versorFn = function() {
    var acos = Math.acos,
        asin = Math.asin,
        atan2 = Math.atan2,
        cos = Math.cos,
        max = Math.max,
        min = Math.min,
        PI = Math.PI,
        sin = Math.sin,
        sqrt = Math.sqrt,
        radians = PI / 180,
        degrees = 180 / PI;

    // Returns the unit quaternion for the given Euler rotation angles [λ, φ, γ].
    function versor(e) {
      var l = e[0] / 2 * radians, sl = sin(l), cl = cos(l), // λ / 2
          p = e[1] / 2 * radians, sp = sin(p), cp = cos(p), // φ / 2
          g = e[2] / 2 * radians, sg = sin(g), cg = cos(g); // γ / 2
      return [
        cl * cp * cg + sl * sp * sg,
        sl * cp * cg - cl * sp * sg,
        cl * sp * cg + sl * cp * sg,
        cl * cp * sg - sl * sp * cg
      ];
    }

    // Returns Cartesian coordinates [x, y, z] given spherical coordinates [λ, φ].
    versor.cartesian = function(e) {
      var l = e[0] * radians, p = e[1] * radians, cp = cos(p);
      return [cp * cos(l), cp * sin(l), sin(p)];
    };

    // Returns the Euler rotation angles [λ, φ, γ] for the given quaternion.
    versor.rotation = function(q) {
      return [
        atan2(2 * (q[0] * q[1] + q[2] * q[3]), 1 - 2 * (q[1] * q[1] + q[2] * q[2])) * degrees,
        asin(max(-1, min(1, 2 * (q[0] * q[2] - q[3] * q[1])))) * degrees,
        atan2(2 * (q[0] * q[3] + q[1] * q[2]), 1 - 2 * (q[2] * q[2] + q[3] * q[3])) * degrees
      ];
    };

    // Returns the quaternion to rotate between two cartesian points on the sphere.
    versor.delta = function(v0, v1) {
      var w = cross(v0, v1), l = sqrt(dot(w, w));
      if (!l) return [1, 0, 0, 0];
      var t = acos(max(-1, min(1, dot(v0, v1)))) / 2, s = sin(t); // t = θ / 2
      return [cos(t), w[2] / l * s, -w[1] / l * s, w[0] / l * s];
    };

    // Returns the quaternion that represents q0 * q1.
    versor.multiply = function(q0, q1) {
      return [
        q0[0] * q1[0] - q0[1] * q1[1] - q0[2] * q1[2] - q0[3] * q1[3],
        q0[0] * q1[1] + q0[1] * q1[0] + q0[2] * q1[3] - q0[3] * q1[2],
        q0[0] * q1[2] - q0[1] * q1[3] + q0[2] * q1[0] + q0[3] * q1[1],
        q0[0] * q1[3] + q0[1] * q1[2] - q0[2] * q1[1] + q0[3] * q1[0]
      ];
    };

    function cross(v0, v1) {
      return [
        v0[1] * v1[2] - v0[2] * v1[1],
        v0[2] * v1[0] - v0[0] * v1[2],
        v0[0] * v1[1] - v0[1] * v1[0]
      ];
    }

    function dot(v0, v1) {
      return v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2];
    }

    return versor;
};

// Mike Bostock’s Block https://bl.ocks.org/mbostock/7ea1dde508cec6d2d95306f92642bc42
//
var versor = versorFn();
var versorDragPlugin = function() {
    return {
        name: 'versorDragPlugin',
        onInit() {
            var _this = this;
            this._.svg.call(d3.drag()
                .on('start', dragstarted)
                .on('end',   dragsended)
                .on('drag',  dragged));

            var v0, // Mouse position in Cartesian coordinates at start of drag gesture.
                r0, // Projection rotation as Euler angles at start.
                q0; // Projection rotation as versor at start.

            function dragstarted() {
                _this._.drag = true;
                v0 = versor.cartesian(_this._.proj.invert(d3.mouse(this)));
                r0 = _this._.proj.rotate();
                q0 = versor(r0);
            }

            function dragsended() {
                _this._.drag = false;
            }

            function dragged() {
                var v1 = versor.cartesian(_this._.proj.rotate(r0).invert(d3.mouse(this))),
                    q1 = versor.multiply(q0, versor.delta(v0, v1)),
                    r1 = versor.rotation(q1);
                _this._.rotate(r1);
            }
        }
    }
};

var wheelZoomPlugin = function() {
    return {
        name: 'wheelZoomPlugin',
        onInit() {
            var _this = this;
            this._.svg.on('wheel', function() {
                var y = d3.event.deltaY+_this._.proj.scale();
                if (y>230 && y<1000) {
                    _this._.scale(y);
                }
            });
        }
    }
};

// Bo Ericsson’s Block http://bl.ocks.org/boeric/aa80b0048b7e39dd71c8fbe958d1b1d4
var canvasPlugin = function() {
    var _ = {svg:null, select: null};

    function svgAddCanvas() {
        _.svg.selectAll('.canvas').remove();
        if (this._.options.showCanvas) {
            var fObject = _.svg.append("g").attr("class","canvas").append("foreignObject")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", this._.options.width)
            .attr("height", this._.options.height);
            var fBody = fObject.append("xhtml:body")
            .style("margin", "0px")
            .style("padding", "0px")
            .style("background-color", "none")
            .style("width", this._.options.width + "px")
            .style("height", this._.options.height + "px");
            this._.canvas = fBody.append("canvas")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", this._.options.width)
            .attr("height", this._.options.height);
            return this._.canvas;
        }
    }

    return {
        name: 'canvasPlugin',
        onInit() {
            this.svgAddCanvas = svgAddCanvas;
            this._.options.showCanvas = true;
            _.svg = this._.svg;
        },
        onRefresh() {
            var width = this._.options.width,
                height= this._.options.height;
            this._.svg.each(function() {
                var context = this.getElementsByTagName('canvas')[0].getContext("2d");
                context.clearRect(0, 0, width, height);
            });
        },
        select(slc) {
            _.svg = d3.selectAll(slc);
            _.select = slc;
            return _.svg;
        },
        render(fn) {
            var _this = this;
            var cpath = d3.geoPath().projection(this._.proj);
            this._.svg.each(function() {
                var context = this.getElementsByTagName('canvas')[0].getContext("2d");
                fn.call(_this, context, cpath.context(context));
            });
        }
    }
};

var oceanPlugin = function(initOptions={}) {
    var _ = {svg:null, select: null};

    function svgAddOcean() {
        _.svg.selectAll('#ocean,.ocean').remove();
        if (this._.options.showOcean) {
            var ocean_fill = this._.defs.append("radialGradient")
                .attr("id", "ocean")
                .attr("cx", "75%")
                .attr("cy", "25%");
            ocean_fill.append("stop")
                .attr("offset", "5%")
                .attr("stop-color", "#ddf");
            ocean_fill.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", "#9ab");
            this._.ocean = _.svg.append("g").attr("class","ocean").append("circle")
                .attr("cx",this._.options.width / 2).attr("cy", this._.options.height / 2)
                .attr("r", this._.proj.scale())
                .attr("class", "noclicks");
            return this._.ocean;
        }
    }

    initOptions = Object.assign({
        showOcean: true,
    }, initOptions);

    return {
        name: 'oceanPlugin',
        onInit() {
            Object.assign(this._.options, initOptions);
            this.svgAddOcean = svgAddOcean;
            _.svg = this._.svg;
        },
        onResize() {
            if (this._.ocean && this._.options.showOcean) {
                this._.ocean.attr("r", this._.proj.scale());
            }
        },
        select(slc) {
            _.svg = d3.selectAll(slc);
            _.select = slc;
            return _.svg;
        }
    }
};

var configPlugin = function() {
    return {
        name: 'configPlugin',
        set(newOpt) {
            if (newOpt) {
                Object.assign(this._.options, newOpt);
                if (newOpt.spin!==undefined) {
                    var p = this.autorotatePlugin;
                    newOpt.spin ? p.start() : p.stop();
                }
                this._.drag = true;
                this.svgDraw();
                this._.drag = false;
            }
            return Object.assign({}, this._.options);
        }
    }
};

var graticuleCanvas = function() {
    var datumGraticule = d3.geoGraticule();

    function canvasAddGraticule() {
        if (this._.options.showGraticule) {
            this.canvasPlugin.render(function(context, path) {
                context.beginPath();
                path(datumGraticule());
                context.lineWidth = 0.3;
                context.strokeStyle = 'rgba(119,119,119,.5)';
                context.stroke();
            });
        }
    }

    return {
        name: 'graticuleCanvas',
        onInit() {
            this.canvasAddGraticule = canvasAddGraticule;
            this._.options.showGraticule = true;
        },
        onRefresh() {
            canvasAddGraticule.call(this);
        }
    }
};

var graticulePlugin = function() {
    var datumGraticule = d3.geoGraticule();
    var _ = {svg:null, select: null};

    function svgAddGraticule() {
        _.svg.selectAll('.graticule').remove();
        if (this._.options.showGraticule) {
            this._.graticule = _.svg.append("g").attr("class","graticule").append("path")
                .datum(datumGraticule)
                .attr("class", "noclicks")
                .attr("d", this._.path);
            return this._.graticule;
        }
    }

    return {
        name: 'graticulePlugin',
        onInit() {
            this.svgAddGraticule = svgAddGraticule;
            this._.options.showGraticule = true;
            _.svg = this._.svg;
        },
        onRefresh() {
            if (this._.graticule && this._.options.showGraticule) {
                this._.graticule.attr("d", this._.path);
            }
        },
        select(slc) {
            _.svg = d3.selectAll(slc);
            _.select = slc;
            return _.svg;
        }
    }
};

// Derek Watkins’s Block http://bl.ocks.org/dwtkns/4686432
//
var fauxGlobePlugin = function(initOptions={}) {
    var _ = {svg:null, select: null};

    function svgAddDropShadow() {
        _.svg.selectAll('#drop_shadow,.drop_shadow').remove();
        if (this._.options.showGlobeShadow) {
            var drop_shadow = this._.defs.append("radialGradient")
                  .attr("id", "drop_shadow")
                  .attr("cx", "50%")
                  .attr("cy", "50%");
                drop_shadow.append("stop")
                  .attr("offset","20%").attr("stop-color", "#000")
                  .attr("stop-opacity",".5");
                drop_shadow.append("stop")
                  .attr("offset","100%").attr("stop-color", "#000")
                  .attr("stop-opacity","0");
            this._.dropShadow = _.svg.append("g").attr("class","drop_shadow").append("ellipse")
                  .attr("cx", this._.options.width/2).attr("cy", this._.options.height-50)
                  .attr("rx", this._.proj.scale()*0.90)
                  .attr("ry", this._.proj.scale()*0.25)
                  .attr("class", "noclicks")
                  .style("fill", "url(#drop_shadow)");
            this._.dropShadow;
        }
    }

    function svgAddGlobeShading() {
        _.svg.selectAll('#shading,.shading').remove();
        if (this._.options.showGlobeShading) {
            var globe_shading = this._.defs.append("radialGradient")
                  .attr("id", "shading")
                  .attr("cx", "50%")
                  .attr("cy", "40%");
                globe_shading.append("stop")
                  .attr("offset","50%").attr("stop-color", "#9ab")
                  .attr("stop-opacity","0");
                globe_shading.append("stop")
                  .attr("offset","100%").attr("stop-color", "#3e6184")
                  .attr("stop-opacity","0.3");
            this._.globeShading = _.svg.append("g").attr("class","shading").append("circle")
                .attr("cx", this._.options.width / 2).attr("cy", this._.options.height / 2)
                .attr("r",  this._.proj.scale())
                .attr("class","noclicks")
                .style("fill", "url(#shading)");
            return this._.globeShading;
        }
    }

    function svgAddGlobeHilight() {
        _.svg.selectAll('#hilight,.hilight').remove();
        if (this._.options.showGlobeHilight) {
            var globe_highlight = this._.defs.append("radialGradient")
                  .attr("id", "hilight")
                  .attr("cx", "75%")
                  .attr("cy", "25%");
                globe_highlight.append("stop")
                  .attr("offset", "5%").attr("stop-color", "#ffd")
                  .attr("stop-opacity","0.6");
                globe_highlight.append("stop")
                  .attr("offset", "100%").attr("stop-color", "#ba9")
                  .attr("stop-opacity","0.2");
            this._.globeHilight = _.svg.append("g").attr("class","hilight").append("circle")
                .attr("cx", this._.options.width / 2).attr("cy", this._.options.height / 2)
                .attr("r",  this._.proj.scale())
                .attr("class","noclicks")
                .style("fill", "url(#hilight)");
            return this._.globeHilight;
        }
    }

    initOptions = Object.assign({
        showGlobeShadow: true,
        showGlobeShading: true,
        showGlobeHilight: true,
    }, initOptions);

    return {
        name: 'fauxGlobePlugin',
        onInit() {
            Object.assign(this._.options, initOptions);
            this.svgAddDropShadow = svgAddDropShadow;
            this.svgAddGlobeHilight = svgAddGlobeHilight;
            this.svgAddGlobeShading = svgAddGlobeShading;
            _.svg = this._.svg;
        },
        onResize() {
            if (this._.globeShading && this._.options.showGlobeShading) {
                this._.globeShading.attr("r", this._.proj.scale());
            }
            if (this._.globeHilight && this._.options.showGlobeHilight) {
                this._.globeHilight.attr("r", this._.proj.scale());
            }
        },
        select(slc) {
            _.svg = d3.selectAll(slc);
            _.select = slc;
            return _.svg;
        }
    }
};

var autorotatePlugin = function(degPerSec) {
    var _ = {
        spin: true,
        lastTick: null,
        degree: degPerSec
    };

    return {
        name: 'autorotatePlugin',
        onInit() {},
        onInterval() {
            var now = new Date();
            if (!_.lastTick || !_.spin || this._.drag) {
                _.lastTick = now;
            } else {
                var delta = now - _.lastTick;
                var r = this._.proj.rotate();
                r[0] += _.degree * delta / 1000;
                if (r[0] >= 180)
                    r[0] -= 360;
                this._.rotate(r);
                _.lastTick = now;
            }
        },
        speed(degPerSec) {
            _.degree = degPerSec;
        },
        start() {
            _.spin = true;
        },
        stop() {
            _.spin = false;
        }
    };
};

var placesPlugin = function(urlPlaces) {
    var _ = {svg:null, select: null, places: null};

    function svgAddPlaces() {
        _.svg.selectAll('.points,.labels').remove();
        if (_.places) {
            if (this._.options.showPlaces) {
                svgAddPlacePoints.call(this);
                svgAddPlaceLabels.call(this);
                position_labels.call(this);
            }
        }
    }

    function svgAddPlacePoints() {
        this._.placePoints = _.svg.append("g").attr("class","points").selectAll("path")
            .data(_.places.features).enter().append("path")
            .attr("class", "point")
            .attr("d", this._.path);
        return this._.placePoints;
    }

    function svgAddPlaceLabels() {
        this._.placeLabels = _.svg.append("g").attr("class","labels").selectAll("text")
            .data(_.places.features).enter().append("text")
            .attr("class", "label")
            .text(function(d) { return d.properties.name });
        return this._.placeLabels;
    }

    function position_labels() {
        var _this = this;
        var centerPos = this._.proj.invert([this._.options.width / 2, this._.options.height/2]);

        this._.placeLabels
            .attr("text-anchor",function(d) {
                var x = _this._.proj(d.geometry.coordinates)[0];
                return x < _this._.options.width/2-20 ? "end" :
                       x < _this._.options.width/2+20 ? "middle" :
                       "start"
            })
            .attr("transform", function(d) {
                var loc = _this._.proj(d.geometry.coordinates),
                    x = loc[0],
                    y = loc[1];
                var offset = x < _this._.options.width/2 ? -5 : 5;
                return "translate(" + (x+offset) + "," + (y-2) + ")"
            })
            .style("display", function(d) {
                return d3.geoDistance(d.geometry.coordinates, centerPos) > 1.57 ? 'none' : 'inline';
            });
    }

    return {
        name: 'placesPlugin',
        urls: urlPlaces && [urlPlaces],
        onReady(err, places) {
            _.places = places;
        },
        onInit() {
            this._.options.showPlaces = true;
            this.svgAddPlaces = svgAddPlaces;
            _.svg = this._.svg;
        },
        onRefresh() {
            if (this._.placePoints) {
                this._.placePoints.attr("d", this._.path);
                position_labels.call(this);
            }
        },
        select(slc) {
            _.svg = d3.selectAll(slc);
            _.select = slc;
            return _.svg;
        },
        data(p) {
            if (p) {
                var data = p.placesPlugin.data();
                _.places = data.places;
            } else {
                return {places: _.places}
            }
        }
    };
};

// John J Czaplewski’s Block http://bl.ocks.org/jczaplew/6798471
var worldCanvas = function(urlWorld, urlCountryNames) {
    var _ = {world: null, countryNames: null};

    function canvasAddWorldOrCountries() {
        if (this._.options.showLand) {
            if (_.world) {
                canvasAddWorld.call(this);
                if (this._.options.showCountries) {
                    canvasAddCountries.call(this);
                }
                if (this._.options.showLakes) {
                    canvasAddLakes.call(this);
                }
            }
        }
    }

    function canvasAddWorld() {
        var land = topojson.feature(_.world, _.world.objects.land);
        this.canvasPlugin.render(function(context, path) {
            context.beginPath();
            path(land);
            context.fillStyle = "rgb(117, 87, 57)";
            context.fill();
        });
    }

    function canvasAddCountries() {
        var countries = topojson.feature(_.world, _.world.objects.countries);
        this.canvasPlugin.render(function(context, path) {
            context.beginPath();
            path(countries);
            context.lineWidth = .5;
            context.strokeStyle = "rgb(80, 64, 39)";
            context.stroke();
        });
    }

    function canvasAddLakes() {
        var lakes = topojson.feature(_.world, _.world.objects.ne_110m_lakes);
        this.canvasPlugin.render(function(context, path) {
            context.beginPath();
            path(lakes);
            context.fillStyle = "rgb(80, 87, 97)";
            context.fill();
        });
    }

    var urls = null;
    if (urlWorld) {
        urls = [urlWorld];
        if (urlCountryNames) {
            urls.push(urlCountryNames);
        }
    }

    return {
        name: 'worldCanvas',
        urls: urls,
        onReady(err, world, countryNames) {
            _.world = world;
            _.countryNames = countryNames;
        },
        onInit() {
            this._.options.showLand = true;
            this._.options.showLakes = true;
            this._.options.showCountries = true;
            this.canvasAddWorldOrCountries = canvasAddWorldOrCountries;
        },
        onRefresh() {
            canvasAddWorldOrCountries.call(this);
        },
        data(p) {
            if (p) {
                var data = p.worldPlugin.data();
                _.countryNames = data.countryNames;
                _.world = data.world;
            } else {
                return {
                    countryNames: _.countryNames,
                    world: _.world
                }
            }
        }
    }
};

var worldPlugin = function(urlWorld, urlCountryNames) {
    var _ = {svg:null, select: null, world: null, countries: null, countryNames: null};
    var countryClick = function() {
        // console.log(d);
    };

    function svgAddWorldOrCountries() {
        _.svg.selectAll('.land,.lakes,.countries').remove();
        if (this._.options.showLand) {
            if (_.world) {
                if (this._.options.showCountries) {
                    svgAddCountries.call(this);
                } else {
                    svgAddWorld.call(this);
                }
                if (this._.options.showLakes) {
                    svgAddLakes.call(this);
                }
            }
        }
    }

    function svgAddWorld() {
        var land = topojson.feature(_.world, _.world.objects.land);

        this._.world = _.svg.append("g").attr("class","land").append("path")
            .datum(land)
            .attr("d", this._.path);
        return this._.world;
    }

    function svgAddCountries() {
        var countries = topojson.feature(_.world, _.world.objects.countries).features;

        this._.countries = _.svg.append("g").attr("class","countries").selectAll("path")
            .data(countries).enter().append("path").on('click', countryClick)
            .attr("id",function(d) {return 'x'+d.id})
            .attr("d", this._.path);
        return this._.countries;
    }

    function svgAddLakes() {
        var lakes = topojson.feature(_.world, _.world.objects.ne_110m_lakes);

        this._.lakes = _.svg.append("g").attr("class","lakes").append("path")
            .datum(lakes)
            .attr("d", this._.path);
        return this._.lakes;
    }

    var urls = null;
    if (urlWorld) {
        urls = [urlWorld];
        if (urlCountryNames) {
            urls.push(urlCountryNames);
        }
    }
    return {
        name: 'worldPlugin',
        urls: urls,
        onReady(err, world, countryNames) {
            _.world = world;
            _.countryNames = countryNames;

        },
        onInit() {
            this._.options.showLand = true;
            this._.options.showLakes = true;
            this._.options.showCountries = true;
            this.svgAddWorldOrCountries = svgAddWorldOrCountries;
            _.svg = this._.svg;
        },
        onRefresh() {
            if (_.world && this._.options.showLand) {
                if (this._.options.showCountries) {
                    this._.countries.attr("d", this._.path);
                } else {
                    this._.world.attr("d", this._.path);
                }
                if (this._.options.showLakes) {
                    this._.lakes.attr("d", this._.path);
                }
            }
        },
        countries() {
            return _.countries;
        },
        countryName(d) {
            var cname = '';
            if (_.countryNames) {
                cname = _.countryNames.find(function(x) {
                    return x.id==d.id;
                });
            }
            return cname;
        },
        select(slc) {
            _.svg = d3.selectAll(slc);
            _.select = slc;
            return _.svg;
        },
        data(p) {
            if (p) {
                var data = p.worldPlugin.data();
                _.countryNames = data.countryNames;
                _.world = data.world;
            } else {
                return {
                    countryNames: _.countryNames,
                    world: _.world
                }
            }
        }
    };
};

// KoGor’s Block http://bl.ocks.org/KoGor/5994804
//
var centerPlugin = function() {
    var _ = {focused: null};

    function country(cnt, id) {
        id = id.replace('x', '');
        for(var i=0, l=cnt.length; i<l; i++) {
            if(cnt[i].id == id) {return cnt[i];}
        }
    }

    function transition(p) {
        var _this = this;
        d3.transition()
        .duration(2500)
        .tween("rotate", function() {
            var r = d3.interpolate(_this._.proj.rotate(), [-p[0], -p[1]]);
            return function(t) {
                _this._.rotate(r(t));
            };
        });
    }

    return {
        name: 'centerPlugin',
        onInit() {
            var _this = this;
            var originalsvgAddCountries = this.svgAddCountries;
            this.svgAddCountries = function() {
                return originalsvgAddCountries.call(this)
                .on("click", function(d) {
                    var id = this.id.replace('x', ''),
                    c = _this.worldPlugin.countries(),
                    focusedCountry = country(c, id),
                    p = d3.geoCentroid(focusedCountry);
                    transition.call(_this, p);
                    console.log(id);
                    if (typeof(_.focused)==='function') {
                        _.focused.call(_this);
                    }
                });
            };
        },
        go(id) {
            focusedCountry = country(c, id),
            p = d3.geoCentroid(focusedCountry);
            transition.call(_this, p);
        },
        focused(fn) {
            _.focused = fn;
        }
    }
};

// KoGor’s Block http://bl.ocks.org/KoGor/5994804
//
var countryTooltipPlugin = function() {
    var countryTooltip = d3.select("body").append("div").attr("class", "countryTooltip");

    return {
        name: 'countryTooltipPlugin',
        onInit() {
            var _this = this;
            var originalsvgAddCountries = this.svgAddCountries;
            this.svgAddCountries  = function() {
                return originalsvgAddCountries.call(this)
                .on("mouseover", function(d) {
                    var country = _this.worldPlugin.countryName.call(_this, d);
                    countryTooltip.text(country.name)
                    .style("left", (d3.event.pageX + 7) + "px")
                    .style("top", (d3.event.pageY - 15) + "px")
                    .style("display", "block")
                    .style("opacity", 1);
                })
                .on("mouseout", function() {
                    countryTooltip.style("opacity", 0)
                    .style("display", "none");
                })
                .on("mousemove", function() {
                    countryTooltip.style("left", (d3.event.pageX + 7) + "px")
                    .style("top", (d3.event.pageY - 15) + "px");
                });
            };
        },
    }
};

var flattenPlugin = function() {
    var _ = {proj: null};

    return {
        name: 'flattenPlugin',
        onInit() {
            var width = 700,
                height = 500,
                _this = this;

            function animation() {
                _this._.svg.transition()
                    .duration(10500)
                    .tween("projection", function() {
                        return function(_x) {
                            animation.alpha(_x);
                            _this._.refresh();
                        };
                    });
            }

            function interpolatedProjection(a, b) {
                var px = d3.geoProjection(raw).scale(1), alpha;

                function raw(lamda, pi) {
                    var pa = a([lamda *= 180 / Math.PI, pi *= 180 / Math.PI]), pb = b([lamda, pi]);
                    return [(1 - alpha) * pa[0] + alpha * pb[0], (alpha - 1) * pa[1] - alpha * pb[1]];
                }

                animation.alpha = function(_x) {
                    if (!arguments.length)
                        return alpha;
                    var ta = a.translate(),
                        tb = b.translate();
                        alpha = + _x;
                        tb[0] = ta[0];
                        tb[1] = ta[1]/1.2;
                    console.log(px.rotate(), _x);
                    px.translate([
                        (1 - alpha) * ta[0] + alpha * tb[0],
                        ((1 - alpha) * ta[1] + alpha * tb[1])
                    ]);
                    return px;
                };
                animation.alpha(0);
                return px;
            }

            var g1 = this._.proj;
            var g2 = d3.geoEquirectangular()
                .scale(width/4)
                .translate([width / 2, height / 2]);
            _.proj = interpolatedProjection(g1, g2);
            // _.proj.center([0,0]);
            this._.animation = animation;
            this._.px = _.proj;
            this._.g1 = g1;
            this._.g2 = g2;
        },
        toMap() {
            // var r = this._.proj.rotate();
            this._.path = d3.geoPath().projection(_.proj);
            // this._.proj.rotate([r[0],0,0]);
            // this._.proj.center([0,0]);
            this.svgDraw();
            this._.animation.call(this);
        }
    }
};

var barPlugin = function(urlBars) {
    var _ = {svg:null, barProjection: null, select: null, bars: null};

    function svgAddBar() {
        _.svg.selectAll('.bar').remove();
        if (_.bars && this._.options.showBars) {
            var gBar = _.svg.append("g").attr("class","bar");
            var mask = gBar.append("mask")
                .attr("id", "edge");
            mask.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", "100%")
                .attr("height", "100%")
                .attr("fill", "white");
            mask.append("use")
                .attr("xlink:href", "#edgeCircle")
                .attr("fill", "black");
            this._.mask = mask;

            _.max = d3.max(_.bars, function(d) {
              return parseInt(d.Value);
            });

            var scale = this._.proj.scale();
            _.lengthScale = d3.scaleLinear()
                .domain([0, _.max])
                .range([scale, scale+50]);

            this._.bar = gBar.selectAll("line").data(_.bars).enter().append("line")
                .attr("stroke", "red")
                .attr("stroke-width", "2");
            return this._.bar;
        }
    }

    function svgClipPath() {
        // mask creation
        this._.defs.selectAll('clipPath').remove();
        this._.defs.append("clipPath").append("circle")
            .attr("id", "edgeCircle")
            .attr("cx", this._.options.width / 2)
            .attr("cy", this._.options.height / 2)
            .attr("r",  this._.proj.scale());
    }

    function refresh() {
        if (_.bars && this._.options.showBars) {
            var proj= this._.proj;
            var centerPos = proj.invert([this._.options.width / 2, this._.options.height/2]);
            this._.bar
                .attr("x1", function(d) {
                    return proj([d.Longitude, d.Latitude])[0]
                })
                .attr("y1", function(d) {
                    return proj([d.Longitude, d.Latitude])[1]
                })
                .attr("x2", function(d) {
                    _.barProjection.scale(_.lengthScale(d.Value));
                    return _.barProjection([d.Longitude, d.Latitude])[0];
                })
                .attr("y2", function(d) {
                    _.barProjection.scale(_.lengthScale(d.Value));
                    return _.barProjection([d.Longitude, d.Latitude])[1];
                })
                .attr("mask", function (d) {
                    var gDistance = d3.geoDistance([d.Longitude, d.Latitude], centerPos);
                    return gDistance < 1.57 ? null : "url(#edge)";
                });
        }
    }

    return {
        name: 'barPlugin',
        urls: urlBars && [urlBars],
        onReady(err, bars) {
            var _this = this;
            _.bars = bars;
            // svgAddBar.call(this); //called in this.svgDraw();
            setTimeout(function() {
                refresh.call(_this);
            },1);
        },
        onInit() {
            this.svgAddBar = svgAddBar;
            this.svgClipPath = svgClipPath;
            this._.options.showBars = true;
            _.barProjection = this._.orthoGraphic();
            _.svg = this._.svg;
            svgClipPath.call(this);
        },
        onResize() {
            svgClipPath.call(this);
            svgAddBar.call(this);
        },
        onRefresh() {
            _.barProjection.rotate(this._.proj.rotate());
            refresh.call(this);
        },
        select(slc) {
            _.svg = d3.selectAll(slc);
            _.select = slc;
            return _.svg;
        },
        data(p) {
            if (p) {
                var data = p.barPlugin.data();
                _.bars = data.bars;
            } else {
                return {bars: _.bars}
            }
        },
    }
};

app$1.plugins= {
    versorDragPlugin,
    wheelZoomPlugin,
    canvasPlugin,
    oceanPlugin,
    configPlugin,
    graticuleCanvas,
    graticulePlugin,
    fauxGlobePlugin,
    autorotatePlugin,
    placesPlugin,
    worldCanvas,
    worldPlugin,
    centerPlugin,
    countryTooltipPlugin,
    flattenPlugin,
    barPlugin
};

return app$1;

})));
//# sourceMappingURL=earthjs.js.map