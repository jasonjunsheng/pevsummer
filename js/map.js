"use strict";

var trips = [];
var Maps = google.maps;
var Directions = new Maps.DirectionsService();
var lines = [];
var intervals = [];
var tripID;
var map;
var t;
var markers = [];
var bTime = 0;
var bDist = 0;
var dTime = 0;
var dDist = 0;
var allLines = {};


function start() {
    for (var m = 0; m < markers.length; m++) {
        markers[m].setMap(null);
    }
    document.getElementById("startBtn").disabled = true;
    t = 0;
    tripChanged(trips[t]);
    $("ol#trip-list li:nth-child(" + (t + 1) + ")").css("opacity", "1");
}

function clear() {
    bTime = 0;
    bDist = 0;
    dTime = 0;
    dDist = 0;
    $("p#bike-time").html(bTime + " seconds");
    $("p#bike-dist").html(bDist + " meters");
    $("p#drive-time").html(dTime + " seconds");
    $("p#drive-dist").html(dDist + " meters");
}

function sortByTime(trips) {
    trips.sort(function(a,b) {
        var c = new Date(a.start.time);
        var d = new Date(b.start.time);
        return c - d;
    })
}

function accumulator(mark) {
    if (mark.travelMode === Maps.TravelMode.BICYCLING) {
        bTime += mark.travelTime.value;
        bDist += mark.travelDistance.value;
    }
    else if (mark.travelMode === Maps.TravelMode.DRIVING) {
        dTime += mark.travelTime.value;
        dDist += mark.travelDistance.value;
    }
    $("p#bike-time").html(bTime + " seconds");
    $("p#bike-dist").html(bDist + " meters");
    $("p#drive-time").html(dTime + " seconds");
    $("p#drive-dist").html(dDist + " meters");
}

function animateLines() {
    for (var n = 0; n < intervals.length; n++) {
        window.clearInterval(intervals[n]);
    }

    var finished = 0;

    lines.forEach(function(line) {
        var lineSymbol = {
            path: Maps.SymbolPath.CIRCLE,
            scale: 8,
            strokeColor: line.strokeColor,
        };
        line.icons.push({
            icon: lineSymbol,
            offset: "0%",
        });
        var count = 0;
        var interval;

        interval = window.setInterval(function() {
        	if (!interval) {
        		return;
        	}
            count += 5;
            if (count > line.travelTime.value) {
                window.clearInterval(interval);
                finished += 1;
                interval = undefined;

                if (finished === 2) {
	                tripChanged(trips[++t]);
	                $("ol#trip-list li:nth-child(" + (t + 1) + ")").css("opacity", "1");
	                lines.forEach(function(polyline) {
	                	accumulator(polyline);
	                });
	                lines.forEach(function(polyline) {
	        			polyline.setMap(null);
	    			});
	    			lines = [];
	                return;
                }
            }
            var icons = line.get('icons');
            icons[0].offset = ( (count / line.travelTime.value) * 100 ) + '%';
            line.set('icons', icons);
        }, 20);
        intervals.push(interval);
    });
}

function drawPaths(paths, origin, id) {
    var marker = new Maps.Marker({
            position: origin,
            map: map,
    });
	marker.info = {};
	allLines[id] = [];

    var bounds = new Maps.LatLngBounds();
    for (var p = 0; p < paths.length; p++) {
        var color;
        if (paths[p].request.travelMode === Maps.TravelMode.BICYCLING) {
            color = "#00FF00";
        } else {
            color = "#FF0000";
        }

        var polyline = new Maps.Polyline({
            path: [],
            icons: [],
            strokeColor: color,
            strokeOpacity: 0.5,
            strokeWeight: 7,
        });

        // Credits to http://www.geocodezip.com/V3_Polyline_from_directions.html
        var path = paths[p].routes[0].overview_path;
        var legs = paths[p].routes[0].legs;
        for (var i = 0; i < legs.length; i++) {
            var steps = legs[i].steps;
            for (var j = 0; j < steps.length; j++) {
                var nextSegment = steps[j].path;
                for (var k = 0; k < nextSegment.length; k++) {
                    polyline.getPath().push(nextSegment[k]);
                    bounds.extend(nextSegment[k]);
                }
            }
        }

        polyline.travelMode     = paths[p].request.travelMode;
        polyline.travelDistance = paths[p].routes[0].legs[0].distance;
        polyline.travelTime     = paths[p].routes[0].legs[0].duration;
        polyline.setMap(map);
        lines.push(polyline);
        allLines[id].push(polyline);

        marker.info[polyline.travelMode] = {
        	distance: polyline.travelDistance,
        	time:     polyline.travelTime,
        };
        marker.info.id = id;
    }
    map.fitBounds(bounds);
    $("p#c-bike-time").html(marker.info[Maps.TravelMode.BICYCLING].time.value + " seconds");
    $("p#c-bike-dist").html(marker.info[Maps.TravelMode.BICYCLING].distance.value + " meters");
    $("p#c-drive-time").html(marker.info[Maps.TravelMode.DRIVING].time.value + " seconds");
    $("p#c-drive-dist").html(marker.info[Maps.TravelMode.DRIVING].distance.value + " meters");

    Maps.event.addListener(marker, 'click', function() {
    	marker_data(marker.info);
    });
}

function marker_data(info) {
    lines.forEach(function(line) {
    	line.setMap(null);
    });

    lines = [];

	if (tripID === info.id) {
		accumulator({});
		tripID = undefined;
		return;
	}
	tripID = info.id;

	var bTimeSpecific = info[Maps.TravelMode.BICYCLING].time.value;
	var bDistSpecific = info[Maps.TravelMode.BICYCLING].distance.value;
	var dTimeSpecific = info[Maps.TravelMode.DRIVING].time.value;
	var dDistSpecific = info[Maps.TravelMode.DRIVING].distance.value;
    $("p#c-bike-time").html(bTimeSpecific + " seconds");
    $("p#c-bike-dist").html(bDistSpecific + " meters");
    $("p#c-drive-time").html(dTimeSpecific + " seconds");
    $("p#c-drive-dist").html(dDistSpecific + " meters");

    allLines[info.id].forEach(function(line) {
    	lines.push(line);
    	line.setMap(map);
    });
}

function tripChanged(trip) {
    if (!trip) {
        return
    }
    var res = [];
    var origin = new Maps.LatLng(trip.start.lat, trip.start.long);
    var destination = new Maps.LatLng(trip.end.lat, trip.end.long);
    var dirfunc = function(response, status) {
        if (status == Maps.DirectionsStatus.OK) {
            res.push(response);
            if (res.length === 2) {
                drawPaths(res, origin, trip.id);
                animateLines();
            }
        }
    };
    Directions.route({
        origin:      origin,
        destination: destination,
        travelMode:  Maps.TravelMode.DRIVING,
    }, dirfunc);
    Directions.route({
        origin:      origin,
        destination: destination,
        travelMode:  Maps.TravelMode.BICYCLING,
    }, dirfunc);
}


function fileChanged(event) {
    var csv = event.target.files[0];
    Papa.parse(csv, {
        step: function(results, parser) {
            var row = results.data[0];
            if (row[2]) {
                var trip = {
                    id: parseInt(row[0]),
                    start: {
                        long: parseFloat(row[3]),
                        lat:  parseFloat(row[4]),
                        time: row[1],
                        address: row[2],
                    },
                    end: {
                        long: parseFloat(row[7]),
                        lat:  parseFloat(row[8]),
                        time: row[5],
                        address: row[6],
                    },
                };
                
                trips.push(trip);
            }
        },
        complete: function() {
            sortByTime(trips);
            $('#prompt').empty();
            for (var t = 0; t < trips.length; t++) {
                var index = t;
                $("ol#trip-list").append("<li data-index=\"" + index + "\">" + trips[t].start.address + "</li>");
              
            }
            $("#trip-list").click(function(event) {
                var newID = $(event.toElement).attr("data-index");
                if (newID !== tripID) {
                    tripID = newID;
                    $("ol#trip-list li").css("opacity", "0.5");
                    $(event.toElement).css("opacity", "1");
                    tripChanged(trips[newID]);
                }
            });
        }
    });
    document.getElementById("startBtn").disabled = false;
}

window.onload = function() {
    document.getElementById("trip-file").addEventListener("change", fileChanged, false);
    map = new Maps.Map(document.getElementById('map-canvas'), {
      zoom: 12,
      center: new Maps.LatLng(42.3601, -71.0589),
      mapTypeId: Maps.MapTypeId.ROADMAP
    });
    document.getElementById("trip-file").value = "";
    document.getElementById("startBtn").disabled = true;
};
