//------------------------------------------------------
// FILTERS.JS
// Sugarcane GIS Enterprise v8.0
//------------------------------------------------------

//======================================================
// GLOBAL STATE
//======================================================

let currentFeatures = [];

//======================================================
// INITIALIZE
//======================================================

document.addEventListener("DOMContentLoaded", () => {

    const applyBtn = document.getElementById("applyFilters");
    const resetBtn = document.getElementById("resetFilters");

    if (applyBtn) {
        applyBtn.addEventListener("click", applyFilters);
    }

    if (resetBtn) {
        resetBtn.addEventListener("click", resetFilters);
    }

});

//======================================================
// POPULATE FILTERS
//======================================================

function populateFilters(features){

    if(!features) return;

    const varieties = new Set();
    const statuses = new Set();
    const villages = new Set();
    const growers = new Set();
    const ratoons = new Set();

    features.forEach(feature=>{

        const p = feature.properties;

        if(p.Variety){
            varieties.add(String(p.Variety));
        }

        if(p.Status){
            statuses.add(String(p.Status));
        }

        if(p.Ratoon_Cycle != null){
            ratoons.add(String(p.Ratoon_Cycle));
        }

        const grower =
            (typeof getGrowerById === "function")
            ? getGrowerById(p.Grower_ID)
            : null;

        if(grower){

            if(grower.grower_name){
                growers.add(String(grower.grower_name));
            }

            if(grower.village){
                villages.add(String(grower.village));
            }

        }

    });

    fillSelect("filterVariety", varieties);
    fillSelect("filterStatus", statuses);
    fillSelect("filterVillage", villages);
    fillSelect("filterGrower", growers);
    fillSelect("filterRatoon", ratoons);

}
//======================================================
// FILL SELECT
//======================================================

function fillSelect(id, values){

    const select = document.getElementById(id);

    if(!select) return;

    //--------------------------------------------------
    // Correct default option for each filter
    //--------------------------------------------------

    const labels = {

        filterVariety : "All Varieties",

        filterStatus  : "All Status",

        filterVillage : "All Villages",

        filterGrower  : "All Growers",

        filterRatoon  : "All Ratoon Cycles"

    };

    //--------------------------------------------------
    // Reset dropdown
    //--------------------------------------------------

    select.innerHTML = "";

    const defaultOption = document.createElement("option");

    defaultOption.value = "";

    defaultOption.textContent = labels[id] || "All";

    select.appendChild(defaultOption);

    //--------------------------------------------------
    // Add values
    //--------------------------------------------------

    [...values]
        .sort()
        .forEach(value=>{

            const option = document.createElement("option");

            option.value = value;

            option.textContent = value;

            select.appendChild(option);

        });

}

//======================================================
// APPLY FILTERS
//======================================================

function applyFilters(){

    if(!window.parcelData) return;

    const variety = document.getElementById("filterVariety").value;
    const status  = document.getElementById("filterStatus").value;
    const village = document.getElementById("filterVillage").value;
    const grower  = document.getElementById("filterGrower").value;
    const ratoon  = document.getElementById("filterRatoon").value;

    currentFeatures = window.parcelData.features.filter(feature=>{

        const p = feature.properties;

        //--------------------------------------------------
        // Lookup grower only once
        //--------------------------------------------------

        const growerInfo = getGrowerById(p.Grower_ID);

        const growerName = growerInfo ? growerInfo.grower_name : "";
        const villageName = growerInfo ? growerInfo.village : "";

        //--------------------------------------------------
        // Apply filters
        //--------------------------------------------------

        if(variety && p.Variety !== variety) return false;

        if(status && p.Status !== status) return false;

        if(village && villageName !== village) return false;

        if(grower && growerName !== grower) return false;

        if(ratoon && String(p.Ratoon_Cycle) !== ratoon) return false;

        return true;

    });

    refreshApplication(currentFeatures);

    if(typeof logActivity === "function"){

        logActivity(`Filters applied — ${currentFeatures.length} parcels matched`);

    }

}

//======================================================
// RESET FILTERS
//======================================================

function resetFilters(){

    document.getElementById("filterVariety").value = "";
    document.getElementById("filterStatus").value = "";
    document.getElementById("filterVillage").value = "";
    document.getElementById("filterGrower").value = "";
    document.getElementById("filterRatoon").value = "";

    currentFeatures = [];


      if(window.parcelData){

    refreshApplication(window.parcelData.features);

}

    }

//======================================================
// CURRENT FEATURES
//======================================================

function getCurrentFeatures(){

    if(currentFeatures.length){

        return currentFeatures;

    }

    if(window.parcelData){

        return window.parcelData.features;

    }

    return [];

}

//======================================================
// QUICK FILTERS
//======================================================

function filterByStatus(status){

    document.getElementById("filterStatus").value = status;

    applyFilters();

}

function filterByVariety(variety){

    document.getElementById("filterVariety").value = variety;

    applyFilters();

}

function clearFilters(){

    resetFilters();

}

//======================================================
// EXPORTS
//======================================================

window.populateFilters = populateFilters;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.getCurrentFeatures = getCurrentFeatures;
window.filterByStatus = filterByStatus;
window.filterByVariety = filterByVariety;
window.clearFilters = clearFilters;