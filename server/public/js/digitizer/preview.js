//------------------------------------------------------
// PREVIEW.JS
// Sugarcane GIS Enterprise v2.0
//------------------------------------------------------

//======================================================
// INITIALIZE MAP EVENTS
//======================================================

document.addEventListener("DOMContentLoaded", () => {

    const wait = setInterval(() => {

        if (!window.map) return;

        clearInterval(wait);

        window.map.on("click", handleMapClick);

        window.map.on("mousemove", handleMouseMove);

        window.map.on("contextmenu", function(e){

            if(DrawingController.active){

                L.DomEvent.preventDefault(e);

                if(typeof handleFinishBoundary === "function"){

                    handleFinishBoundary();

                }

            }

        });

    },100);

});

//======================================================
// MAP CLICK
//======================================================

function handleMapClick(e){

    if(!DrawingController.active) return;

    addVertex(e.latlng);

}

//======================================================
// ADD VERTEX
//======================================================

function addVertex(latlng){

    //--------------------------------------------------
    // Store coordinate
    //--------------------------------------------------

    DrawingController.vertices.push([

        latlng.lng,

        latlng.lat

    ]);

    //--------------------------------------------------
    // Marker
    //--------------------------------------------------

    const marker = L.circleMarker(latlng,{

        radius:6,

        color:"#D32F2F",

        fillColor:"#D32F2F",

        fillOpacity:1

    }).addTo(window.map);

    DrawingController.markers.push(marker);

    //--------------------------------------------------
    // Update drawing
    //--------------------------------------------------

    refreshPreview();

}

//======================================================
// MOUSE MOVE
//======================================================

function handleMouseMove(e){

    if(!DrawingController.active) return;

    if(DrawingController.vertices.length===0) return;

    drawRubberBand(e.latlng);

}

//======================================================
// REFRESH PREVIEW
//======================================================

function refreshPreview(){

    drawBoundary();

    drawPolygon();

    if(typeof updateMeasurements==="function"){

        updateMeasurements();

    }

}

//======================================================
// DRAW OUTLINE
//======================================================

function drawBoundary(){

    const latlngs = DrawingController.vertices.map(v=>[v[1],v[0]]);

    if(DrawingController.line){

        window.map.removeLayer(DrawingController.line);

    }

    DrawingController.line = L.polyline(latlngs,{

        color:"#1565C0",

        weight:3

    }).addTo(window.map);

}

//======================================================
// DRAW POLYGON
//======================================================

function drawPolygon(){

    if(DrawingController.vertices.length<3) return;

    const latlngs = DrawingController.vertices.map(v=>[v[1],v[0]]);

    if(DrawingController.polygon){

        window.map.removeLayer(DrawingController.polygon);

    }

    DrawingController.polygon = L.polygon(latlngs,{

        color:"#2E7D32",

        fillColor:"#66BB6A",

        fillOpacity:0.35,

        weight:2

    }).addTo(window.map);

}

//======================================================
// RUBBER BAND
//======================================================

function drawRubberBand(mouse){

    const coords = DrawingController.vertices;

    if(coords.length===0) return;

    const last = coords[coords.length-1];

    const first = coords[0];

    const latlngs = [

        [last[1],last[0]],

        [mouse.lat,mouse.lng]

    ];

    //--------------------------------------------------
    // Show closing guide after 2 vertices
    //--------------------------------------------------

    if(coords.length>=2){

        latlngs.push([first[1],first[0]]);

    }

    if(DrawingController.rubberBand){

        window.map.removeLayer(DrawingController.rubberBand);

    }

    DrawingController.rubberBand = L.polyline(latlngs,{

        color:"#FB8C00",

        dashArray:"6,6",

        weight:2

    }).addTo(window.map);

}