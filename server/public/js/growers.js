//------------------------------------------------------
// GROWERS.JS
// Sugarcane GIS Enterprise
//------------------------------------------------------

//======================================================
// GLOBAL DATA
//======================================================

let growerList = [];

//======================================================
// INITIALIZE
//======================================================

document.addEventListener("DOMContentLoaded", () => {

    loadGrowers();

});

//======================================================
// LOAD GROWERS
//======================================================

async function loadGrowers(){

    try{

        const response = await fetch("/growers");

        growerList = await response.json();

        populateGrowerDropdown();

        initializeGrowerSearch();

    }

    catch(error){

        console.error("Failed to load growers.", error);

    }

}

//======================================================
// SEARCH CONTROLS
//======================================================

function initializeGrowerSearch(){

    const input = document.getElementById("growerSearch");

    const button = document.getElementById("growerBtn");

    if(!input || !button) return;

    button.onclick = searchGrower;

    input.addEventListener("keyup", e=>{

        if(e.key==="Enter"){

            searchGrower();

        }

    });

}

function searchGrower(){

    const input = document.getElementById("growerSearch");

    if(!input || !window.parcelData) return;

    const text = input.value.trim().toLowerCase();

    if(!text){

        input.focus();

        return;

    }

    //--------------------------------------------------
    // Find Grower
    //--------------------------------------------------

    const grower = growerList.find(g=>

        String(g.grower_name || "")
            .toLowerCase()
            .includes(text)

    );

    if(!grower){

        alert("Grower not found.");

        input.focus();

        return;

    }

    //--------------------------------------------------
    // Filter parcels
    //--------------------------------------------------

    const features = window.parcelData.features.filter(feature=>{

        return String(feature.properties.Grower_ID) ===

              String(
    grower.grower_id ??
    grower.Grower_ID ??
    grower.id
); 

    });

    //--------------------------------------------------
    // Refresh everything
    //--------------------------------------------------

    refreshApplication(features);

    //--------------------------------------------------
    // Zoom
    //--------------------------------------------------

    if(features.length){

        if(typeof goToMapView === "function") goToMapView();

        const bounds = L.geoJSON({

            type:"FeatureCollection",

            features:features

        }).getBounds();

        setTimeout(() => map.fitBounds(bounds,{padding:[50,50]}), 160);

    }

    input.value="";

}

//======================================================
// GET GROWER
//======================================================

function getGrowerById(id){

    const grower = growerList.find(g=>

        String(g.grower_id ?? g.Grower_ID ?? g.id) === String(id)

    );

    if(!grower) return null;

    return{

        id:

            grower.grower_id ??
            grower.Grower_ID ??
            grower.id,

        grower_name:

            grower.grower_name ??
            grower.Grower_Name ??
            grower.name ??
            "-",

        village:

            grower.village ??
            grower.Village ??
            "-",

        raw:grower

    };

}
//------------------------------------------------------
// POPULATE GROWER DROPDOWN
//------------------------------------------------------

function populateGrowerDropdown(selectedId = null, targetId = "growerSelect"){

    const select = document.getElementById(targetId);

    if(!select) return;

    select.innerHTML = `

        <option value="">Select Grower</option>

    `;

    growerList.forEach(grower=>{

        const option = document.createElement("option");

        option.value = grower.grower_id;

        option.textContent = grower.grower_name;

        if(selectedId && String(selectedId) === String(grower.grower_id)){

            option.selected = true;

        }

        select.appendChild(option);

    });

}
//======================================================
// EXPORTS
//======================================================

window.getGrowerById = getGrowerById;
window.searchGrower = searchGrower;
window.populateGrowerDropdown = populateGrowerDropdown;
window.loadGrowers = loadGrowers;