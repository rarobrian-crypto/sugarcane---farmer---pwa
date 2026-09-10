//------------------------------------------------------
// SEARCH.JS
// Sugarcane GIS Enterprise
//------------------------------------------------------

//======================================================
// INITIALIZE
//======================================================

document.addEventListener("DOMContentLoaded", () => {

    initializeParcelSearch();

});

//======================================================
// SEARCH CONTROLS
//======================================================

function initializeParcelSearch(){

    const input = document.getElementById("parcelSearch");

    const button = document.getElementById("searchBtn");

    if(!input || !button) return;

    button.onclick = searchParcel;

    input.addEventListener("keyup", e=>{

        if(e.key==="Enter"){

            searchParcel();

        }

    });

}

//======================================================
// SEARCH PARCEL
//======================================================

function searchParcel(){

    const input = document.getElementById("parcelSearch");

    if(!input || !parcelLayer) return;

    const parcelID = input.value.trim();

    if(!parcelID){

        input.focus();

        return;

    }

    let found = false;

    parcelLayer.eachLayer(layer=>{

        if(

            String(layer.feature.properties.Parcel_ID)===

            String(parcelID)

        ){

            found = true;

        }

    });

    if(found){

        if(typeof goToMapView === "function") goToMapView();

        setTimeout(() => zoomToParcel(parcelID), 160);

        input.value="";

    }

    input.focus();

}

//======================================================
// RESET SEARCH
//======================================================

function resetParcelSearch(){

    const input=document.getElementById("parcelSearch");

    if(!input) return;

    input.value="";

    input.focus();

}

//======================================================
// EXPORTS
//======================================================

window.searchParcel = searchParcel;

window.resetParcelSearch = resetParcelSearch;