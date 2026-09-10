//------------------------------------------------------
// MEASURE.JS
// Sugarcane GIS Enterprise v3.0
//------------------------------------------------------

//======================================================
// DEFINE PROJECTIONS
//======================================================

// WGS84
proj4.defs(
    "EPSG:4326",
    "+proj=longlat +datum=WGS84 +no_defs"
);

// Kenya UTM Zone 36N
proj4.defs(
    "EPSG:32636",
    "+proj=utm +zone=36 +datum=WGS84 +units=m +no_defs"
);

//======================================================
// UPDATE LIVE MEASUREMENTS
//======================================================

function updateMeasurements(){

    const vertices = DrawingController.vertices;

    //--------------------------------------------------
    // Need at least 3 points
    //--------------------------------------------------

    if(vertices.length < 3){

        document.getElementById("liveArea").innerHTML = "0.00 Ha";
        document.getElementById("livePerimeter").innerHTML = "0.00 m";

        return;

    }

    //--------------------------------------------------
    // Convert Lon/Lat -> UTM
    //--------------------------------------------------

    const projected = vertices.map(coord => {

        return proj4(
            "EPSG:4326",
            "EPSG:32636",
            coord
        );

    });

    //--------------------------------------------------
    // Area (Shoelace Formula)
    //--------------------------------------------------

    let area = 0;

    for(let i=0;i<projected.length;i++){

        const j = (i+1) % projected.length;

        area +=
            projected[i][0] * projected[j][1]
          - projected[j][0] * projected[i][1];

    }

    area = Math.abs(area) / 2;

    //--------------------------------------------------
    // Perimeter
    //--------------------------------------------------

    let perimeter = 0;

    for(let i=0;i<projected.length;i++){

        const j = (i+1) % projected.length;

        const dx = projected[j][0] - projected[i][0];
        const dy = projected[j][1] - projected[i][1];

        perimeter += Math.sqrt(dx*dx + dy*dy);

    }

    //--------------------------------------------------
    // Convert to hectares
    //--------------------------------------------------

    const hectares = area / 10000;

    //--------------------------------------------------
    // Display
    //--------------------------------------------------

    document.getElementById("liveArea").innerHTML =
        hectares.toFixed(2) + " Ha";

    document.getElementById("livePerimeter").innerHTML =
        perimeter.toFixed(2) + " m";

    //--------------------------------------------------
    // Debug
    //--------------------------------------------------

    console.log("Projected:", projected);
    console.log("Area (m²):", area);
    console.log("Area (Ha):", hectares);
    console.log("Perimeter:", perimeter);

}

window.updateMeasurements = updateMeasurements;