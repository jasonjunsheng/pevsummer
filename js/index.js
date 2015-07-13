// "use strict";

var trips = [];
var Maps = google.maps;
var Directions = new Maps.DirectionsService();
var lines = [];
var intervals = [];
var tripID;
var map;

function animateLines() {
    for (var n = 0; n < intervals.length; n++) {
        window.clearInterval(intervals[n]);
    }

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
            count = (count + 1) % line.travelTime.value;
            if (count === 0) {
                window.clearInterval(interval);
                return;
            }
            var icons = line.get('icons');
            icons[0].offset = (count / 2) + '%';
            line.set('icons', icons);
        }, 20);
        intervals.push(interval);
    });
}

function drawPaths(paths) {
    for (var l = 0; l < lines.length; l++) {
        lines[l].setMap(null);
    }
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
        polyline.travelMode = paths[p].request.travelMode;
        polyline.travelTime = paths[p].routes[0].legs[0].duration;
        polyline.setMap(map);
        lines.push(polyline);
    }
    map.fitBounds(bounds);
}

function tripChanged(trip) {
    var res = [];
    var origin = new Maps.LatLng(trip.start.lat, trip.start.long);
    var destination = new Maps.LatLng(trip.end.lat, trip.end.long);
    var dirfunc = function(response, status) {
        if (status == google.maps.DirectionsStatus.OK) {
            res.push(response);
            if (res.length === 2) {
                drawPaths(res);
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
                var index = trips.push(trip) - 1;
                $("ol#trip-list").append("<li data-index=\"" + index + "\">" + trip.start.address + "</li>");
            }
        },
    });

    $("#trip-list").click(function(event) {
        var newID = $(event.toElement).attr("data-index");
        alert('haha');
        if (newID !== tripID) {
            tripID = newID;
            $("ol#trip-list li").css("opacity", "0.5");
            $(event.toElement).css("opacity", "1");
            tripChanged(trips[newID]);
        }
    });
}

window.onload = function() {
    document.getElementById("trip-file").addEventListener("change", fileChanged, false);
    map = new Maps.Map(document.getElementById('map-canvas'), {
      zoom: 12,
      center: new Maps.LatLng(42.3601, -71.0589),
      mapTypeId: Maps.MapTypeId.ROADMAP
    });
};
