//------------------------------------------------------
// ROUTE.JS
// Sugarcane GIS Enterprise
//
// Two tools built on OpenStreetMap data:
//  1. Coordinate picker - click the map, get lat/lng.
//  2. Route Analysis - shortest DRIVING route (via the
//     public OSRM routing API, which runs on OpenStreetMap
//     road data) from a chosen start point to a parcel's
//     centroid, for transport planning.
//------------------------------------------------------

const RouteTool = {

    pickingCoord: false,

    pickingStart: false,

    routeLayer: null,

    startMarker: null,

    startLatLng: null,

    targetParcelId: null

};

//======================================================
// COORDINATE PICKER
//======================================================

function toggleCoordinatePicker(){

    if(typeof DrawingController !== "undefined" && DrawingController.active){

        alert("Finish or cancel the parcel you're currently drawing first.");

        return;

    }

    RouteTool.pickingCoord = !RouteTool.pickingCoord;

    if(RouteTool.pickingCoord && typeof goToMapView === "function"){

        goToMapView();

    }

    document.getElementById("coordPickerBtn")
        ?.classList.toggle("active", RouteTool.pickingCoord);

    if(window.map){

        window.map.getContainer().style.cursor =
            RouteTool.pickingCoord ? "crosshair" : "";

    }

    if(!RouteTool.pickingCoord){

        document.getElementById("coordResultBox").style.display = "none";

    }

}

function showCoordinateResult(lat, lng){

    const box = document.getElementById("coordResultBox");

    if(!box) return;

    box.style.display = "block";

    document.getElementById("coordLat").textContent = lat.toFixed(6);
    document.getElementById("coordLng").textContent = lng.toFixed(6);

    box.dataset.lat = lat;
    box.dataset.lng = lng;

}

function copyCoordinates(){

    const box = document.getElementById("coordResultBox");

    if(!box || !box.dataset.lat) return;

    const text = box.dataset.lat + ", " + box.dataset.lng;

    if(navigator.clipboard){

        navigator.clipboard.writeText(text)
            .then(() => alert("Copied: " + text))
            .catch(() => window.prompt("Copy coordinates:", text));

    }

    else{

        window.prompt("Copy coordinates:", text);

    }

}

//======================================================
// ROUTE TO PARCEL - OPEN / CLOSE
//======================================================

function startRouteToParcel(parcelId){

    RouteTool.targetParcelId = parcelId;

    document.getElementById("routeParcelLabel").textContent = parcelId;

    document.getElementById("routeResult").innerHTML = "";

    document.getElementById("routePanel").style.display = "block";

}

function closeRoutePanel(){

    document.getElementById("routePanel").style.display = "none";

    RouteTool.pickingStart = false;

    if(window.map){

        window.map.getContainer().style.cursor = "";

    }

}

//======================================================
// SET START POINT
//======================================================

function beginPickStart(){

    if(typeof DrawingController !== "undefined" && DrawingController.active){

        alert("Finish or cancel the parcel you're currently drawing first.");

        return;

    }

    RouteTool.pickingStart = true;

    if(window.map){

        window.map.getContainer().style.cursor = "crosshair";

    }

}

function useMyLocation(){

    if(!navigator.geolocation){

        alert("Geolocation isn't available in this browser.");

        return;

    }

    navigator.geolocation.getCurrentPosition(

        pos => setStartPoint(pos.coords.latitude, pos.coords.longitude),

        err => alert("Unable to get your location: " + err.message)

    );

}

function setStartPoint(lat, lng){

    RouteTool.startLatLng = [lat, lng];

    if(RouteTool.startMarker){

        window.map.removeLayer(RouteTool.startMarker);

    }

    RouteTool.startMarker = L.marker([lat, lng], {

        title:"Route start"

    }).addTo(window.map);

    document.getElementById("routeStartLabel").textContent =
        lat.toFixed(5) + ", " + lng.toFixed(5);

    RouteTool.pickingStart = false;

    if(window.map){

        window.map.getContainer().style.cursor = "";

    }

}

//======================================================
// CALCULATE SHORTEST ROUTE (OSRM / OpenStreetMap)
//======================================================

async function computeRoute(){

    if(!RouteTool.startLatLng){

        alert("Set a starting point first - use your location or click on the map.");

        return;

    }

    if(!RouteTool.targetParcelId || !window.parcelData){

        alert("No destination parcel selected.");

        return;

    }

    const feature = window.parcelData.features.find(f =>
        String(f.properties.Parcel_ID) === String(RouteTool.targetParcelId)
    );

    if(!feature){

        alert("Parcel not found.");

        return;

    }

    const resultBox = document.getElementById("routeResult");

    resultBox.innerHTML = "Calculating route...";

    try{

        const centroid = turf.centroid(feature);

        const destLng = centroid.geometry.coordinates[0];
        const destLat = centroid.geometry.coordinates[1];

        const [startLat, startLng] = RouteTool.startLatLng;

        const url =

            "/api/route?startLat=" + startLat +
            "&startLng=" + startLng +
            "&destLat=" + destLat +
            "&destLng=" + destLng;

        const response = await fetch(url);

        if(response.status === 403){

            const denial = await response.json();

            resultBox.innerHTML = denial.error || "You don't have access to Route Analysis.";

            return;

        }

        const data = await response.json();

        if(!data.routes || !data.routes.length){

            resultBox.innerHTML = "No driving route could be found between these points.";

            return;

        }

        const route = data.routes[0];

        if(RouteTool.routeLayer){

            window.map.removeLayer(RouteTool.routeLayer);

        }

        RouteTool.routeLayer = L.geoJSON(route.geometry, {

            style:{

                color:"#1976D2",

                weight:5,

                opacity:0.85

            }

        }).addTo(window.map);

        window.map.fitBounds(

            RouteTool.routeLayer.getBounds(),

            { padding:[40, 40] }

        );

        const unit = window.distanceUnit || "km";

        const distanceKm = route.distance / 1000;

        const distanceDisplay = (unit === "mi")

            ? (distanceKm * 0.621371).toFixed(2) + " mi"

            : distanceKm.toFixed(2) + " km";

        const minutes = Math.round(route.duration / 60);

        const durationDisplay = (minutes >= 60)

            ? Math.floor(minutes / 60) + "h " + (minutes % 60) + "m"

            : minutes + " min";

        resultBox.innerHTML = `

            <p><strong>Distance:</strong> ${distanceDisplay}</p>
            <p><strong>Est. Drive Time:</strong> ${durationDisplay}</p>
            <p class="route-source">Route via OpenStreetMap road network (OSRM)</p>

        `;

    }

    catch(error){

        console.error(error);

        resultBox.innerHTML = "Unable to calculate route - check your connection and try again.";

    }

}

//======================================================
// CLEAR ROUTE
//======================================================

function clearRoute(){

    if(RouteTool.routeLayer){

        window.map.removeLayer(RouteTool.routeLayer);

        RouteTool.routeLayer = null;

    }

    if(RouteTool.startMarker){

        window.map.removeLayer(RouteTool.startMarker);

        RouteTool.startMarker = null;

    }

    RouteTool.startLatLng = null;

    document.getElementById("routeStartLabel").textContent = "Not set";

    document.getElementById("routeResult").innerHTML = "";

}

//======================================================
// INITIALIZE
//======================================================

document.addEventListener("DOMContentLoaded", () => {

    const wait = setInterval(() => {

        if(!window.map) return;

        clearInterval(wait);

        window.map.on("click", (e) => {

            if(RouteTool.pickingStart){

                setStartPoint(e.latlng.lat, e.latlng.lng);

                return;

            }

            if(RouteTool.pickingCoord){

                showCoordinateResult(e.latlng.lat, e.latlng.lng);

            }

        });

    }, 100);

    document.getElementById("coordPickerBtn")
        ?.addEventListener("click", toggleCoordinatePicker);

    document.getElementById("coordCloseBtn")
        ?.addEventListener("click", () => {

            document.getElementById("coordResultBox").style.display = "none";

        });

    document.getElementById("copyCoordBtn")
        ?.addEventListener("click", copyCoordinates);

    document.getElementById("routeUseLocationBtn")
        ?.addEventListener("click", useMyLocation);

    document.getElementById("routePickStartBtn")
        ?.addEventListener("click", beginPickStart);

    document.getElementById("routeCalculateBtn")
        ?.addEventListener("click", computeRoute);

    document.getElementById("routeClearBtn")
        ?.addEventListener("click", clearRoute);

    document.getElementById("routeCloseBtn")
        ?.addEventListener("click", closeRoutePanel);

    window.addEventListener("click", (e) => {

        if(e.target === document.getElementById("routePanel")){

            closeRoutePanel();

        }

    });

    //----------------------------------------------------
    // "Route to Parcel" button lives inside the dynamically
    // rendered Parcel Information panel - delegate from a
    // stable ancestor.
    //----------------------------------------------------

    document.getElementById("parcelInfo")
        ?.addEventListener("click", (e) => {

            const btn = e.target.closest(".route-btn");

            if(!btn) return;

            startRouteToParcel(btn.dataset.parcelId);

        });

});

window.startRouteToParcel = startRouteToParcel;
