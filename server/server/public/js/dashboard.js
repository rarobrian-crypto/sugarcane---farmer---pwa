//------------------------------------------------------
// DASHBOARD.JS
// Sugarcane GIS Enterprise v6.0
//------------------------------------------------------

//======================================================
// GLOBAL DASHBOARD STATE
//======================================================

let dashboardData = [];

let dashboardSummary = {

    growers:0,

    parcels:0,

    hectares:0,

    yield:0,

    largestVariety:"-"

};

//======================================================
// INITIALIZE
//======================================================

document.addEventListener("DOMContentLoaded",function(){

    initializeDashboard();

});

//======================================================
// INITIALIZE DASHBOARD
//======================================================
function initializeDashboard(){

    console.log("Dashboard initialized.");

}
//======================================================
// CALCULATE DASHBOARD STATISTICS
//======================================================

function calculateStatistics(features){

    const growerSet = new Set();

    const varieties = {};

    let totalArea = 0;

    let totalYield = 0;

    features.forEach(feature=>{

        const p = feature.properties;

        growerSet.add(

            String(p.Grower_ID)

        );

        totalArea +=

            Number(p.Area_Ha || 0);

        totalYield +=

            Number(p.Estimated_Tonnage || 0);

        const variety =

            String(

                p.Variety ||

                "Unknown"

            ).trim();

        varieties[variety] =

            (varieties[variety] || 0) + 1;

    });

    //--------------------------------------------------
    // Largest Variety
    //--------------------------------------------------

    let largest="-";

    let highest=0;

    Object.keys(varieties).forEach(name=>{

        if(varieties[name] > highest){

            highest = varieties[name];

            largest = name;

        }

    });

    dashboardSummary = {

        growers:

            growerSet.size,

        parcels:

            features.length,

        hectares:

            totalArea,

        yield:

            totalYield,

        largestVariety:

            largest

    };

}
//======================================================
// UPDATE KPI CARDS
//======================================================

function updateKPIs(){

    document.getElementById("growers").textContent =
        dashboardSummary.growers;

    document.getElementById("parcels").textContent =
        dashboardSummary.parcels;

    document.getElementById("hectares").textContent =
        dashboardSummary.hectares.toFixed(2);

    document.getElementById("yield").textContent =
        dashboardSummary.yield.toFixed(1);

}

//======================================================
// UPDATE SYSTEM SUMMARY
//======================================================

function updateSummary(){

    document.getElementById("sumGrowers").textContent =
        dashboardSummary.growers;

    document.getElementById("sumParcels").textContent =
        dashboardSummary.parcels;

    document.getElementById("sumHectares").textContent =
        dashboardSummary.hectares.toFixed(2) + " Ha";

    document.getElementById("sumYield").textContent =
        dashboardSummary.yield.toFixed(1) + " T";

    document.getElementById("topVariety").textContent =
        dashboardSummary.largestVariety;

}

//======================================================
// REFRESH ENTIRE DASHBOARD
//======================================================

function refreshDashboard(features){

    if(!features){

        features=[];

    }

    dashboardData = features;

    try{ calculateStatistics(features); }
    catch(err){ console.error("[calculateStatistics failed]", err); }

    try{ updateKPIs(); }
    catch(err){ console.error("[updateKPIs failed]", err); }

    try{ updateSummary(); }
    catch(err){ console.error("[updateSummary failed]", err); }

    if(typeof refreshCharts==="function"){

        try{ refreshCharts(features); }
        catch(err){ console.error("[refreshCharts failed]", err); }

    }

    if(typeof renderDashboardOverview==="function"){

        try{ renderDashboardOverview(features); }
        catch(err){ console.error("[renderDashboardOverview failed]", err); }

    }

}
//======================================================
// RESTORE DASHBOARD
//======================================================

function restoreDashboard(){

    refreshDashboard(dashboardData);

    resetParcelInformation();

}
//======================================================
// UPDATE PARCEL INFORMATION PANEL
//======================================================

function updateParcelInformation(feature){

    if(!feature) return;

    const p = feature.properties;

    //--------------------------------------------------
    // Grower Information
    //--------------------------------------------------

    let growerName = p.Grower_ID;

    let village = p.Village || "-";

    if(typeof getGrowerById === "function"){

        const grower = getGrowerById(p.Grower_ID);

        if(grower){

            growerName = grower.grower_name;

            village = grower.village;

        }

    }

    //--------------------------------------------------
    // Values
    //--------------------------------------------------

    const area =

        Number(p.Area_Ha || 0).toFixed(2);

    const cropAge =

        Number(p.Crop_Age || 0).toFixed(1);

    const yieldTonnes =

        Number(p.Estimated_Tonnage || 0).toFixed(2);

    const status =

        String(p.Status || "Unknown");

    //--------------------------------------------------
    // Render
    //--------------------------------------------------

    document.getElementById("parcelInfo").innerHTML = `

        <p>
            <strong>Parcel ID</strong>
            <span>${p.Parcel_ID}</span>
        </p>

        <p>
            <strong>Grower</strong>
            <span>${growerName}</span>
        </p>

        <p>
            <strong>Village</strong>
            <span>${village}</span>
        </p>

        <p>
            <strong>Variety</strong>
            <span>${p.Variety || "-"}</span>
        </p>

        <p>
            <strong>Status</strong>

            <span class="statusBadge ${status.toLowerCase()}">

                ${status}

            </span>

        </p>

        <p>
            <strong>Area</strong>
            <span>${area} Ha</span>
        </p>

        <p>
            <strong>Crop Age</strong>
            <span>${cropAge} Months</span>
        </p>

        <p>
            <strong>Estimated Yield</strong>
            <span>${yieldTonnes} T</span>
        </p>

        <p>
            <strong>Ratoon Cycle</strong>
            <span>${p.Ratoon_Cycle || "-"}</span>
        </p>

        ${(typeof hasPermission === "function" && hasPermission("route_analysis")) ? `
        <button type="button" class="route-btn" data-parcel-id="${p.Parcel_ID}">
            <i class="fa-solid fa-route"></i>
            Route to Parcel
        </button>
        ` : ""}

    `;

}

//======================================================
// RESET PARCEL INFORMATION
//======================================================

function resetParcelInformation(){

    document.getElementById("parcelInfo").innerHTML = `

        <p style="padding:25px;text-align:center;color:#777;">

            Select a parcel from the map.

        </p>

    `;

}



//======================================================
// EXPORT FUNCTIONS
//======================================================

window.refreshDashboard = refreshDashboard;

window.restoreDashboard = restoreDashboard;

window.updateParcelInformation = updateParcelInformation;

window.resetParcelInformation = resetParcelInformation;