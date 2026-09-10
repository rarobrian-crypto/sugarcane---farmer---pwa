//------------------------------------------------------
// DRAWING.JS
// Sugarcane GIS Enterprise v2.0
//------------------------------------------------------

//======================================================
// DRAWING CONTROLLER
//======================================================

const DrawingController = {

    active: false,

    vertices: [],

    markers: [],

    line: null,

    polygon: null,

    rubberBand: null

};

//======================================================
// START DRAWING
//======================================================

function startDrawing(){

    console.log("Drawing Started");

    DrawingController.active = true;

    DrawingController.vertices = [];

    clearDrawing();

    //--------------------------------------------------
    // Show measurement panel
    //--------------------------------------------------

    document.getElementById("measurePanel").style.display = "block";

    //--------------------------------------------------
    // Enable drawing mode
    //--------------------------------------------------

    window.map.doubleClickZoom.disable();

    document.getElementById("map").style.cursor = "crosshair";

    //--------------------------------------------------
    // Show toolbar
    //--------------------------------------------------

    if(typeof DrawingToolbar !== "undefined"){

        DrawingToolbar.show();

    }

}

//======================================================
// FINISH DRAWING
//======================================================

function finishDrawing(){

    console.log("Drawing Finished");

    DrawingController.active = false;

    window.map.doubleClickZoom.enable();

    document.getElementById("map").style.cursor = "default";

}

//======================================================
// CANCEL DRAWING
//======================================================

function cancelDrawing(){

    console.log("Drawing Cancelled");

    DrawingController.active = false;

    clearDrawing();

    window.map.doubleClickZoom.enable();

    document.getElementById("map").style.cursor = "default";

    document.getElementById("measurePanel").style.display = "none";

}

//======================================================
// CLEAR DRAWING
//======================================================

function clearDrawing(){

    DrawingController.markers.forEach(marker=>{

        window.map.removeLayer(marker);

    });

    DrawingController.markers = [];

    if(DrawingController.line){

        window.map.removeLayer(DrawingController.line);

        DrawingController.line = null;

    }

    if(DrawingController.polygon){

        window.map.removeLayer(DrawingController.polygon);

        DrawingController.polygon = null;

    }

    if(DrawingController.rubberBand){

        window.map.removeLayer(DrawingController.rubberBand);

        DrawingController.rubberBand = null;

    }

}

//======================================================
// INITIALIZE
//======================================================

document.addEventListener("DOMContentLoaded",()=>{

    document.getElementById("finishDrawBtn")
        ?.addEventListener("click", handleFinishBoundary);

    document.getElementById("cancelDrawBtn")
        ?.addEventListener("click", cancelDrawing);

});

//======================================================
// FINISH BOUNDARY -> OPEN WIZARD
//======================================================

function handleFinishBoundary(){

    if(DrawingController.vertices.length < 3){

        alert("A parcel needs at least 3 points before you can finish it.");

        return;

    }

    finishDrawing();

    if(typeof openParcelWizard === "function"){

        openParcelWizard();

    }

}

window.handleFinishBoundary = handleFinishBoundary;

//======================================================
// GLOBALS
//======================================================

window.DrawingController = DrawingController;

window.startDrawing = startDrawing;

window.finishDrawing = finishDrawing;

window.cancelDrawing = cancelDrawing;