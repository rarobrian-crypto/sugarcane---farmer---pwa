//------------------------------------------------------
// ACTIONS.JS
// Sugarcane GIS Enterprise
//------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("addParcelBtn")
        ?.addEventListener("click", () => {

            if(typeof goToMapView === "function") goToMapView();

            if(typeof startDrawing === "function"){

                setTimeout(() => startDrawing(), 160);

            }

        });

    document.getElementById("uploadBtn")
        ?.addEventListener("click", bulkUpload);

    document.getElementById("reportBtn")
        ?.addEventListener("click", generateReport);

    document.getElementById("downloadBtn")
        ?.addEventListener("click", downloadData);

    //====================================================
    // PARCEL REGISTER - HEADER ACTIONS
    //====================================================

    document.getElementById("registerAddBtn")
        ?.addEventListener("click", () => {

            if(typeof goToMapView === "function") goToMapView();

            if(typeof startDrawing === "function"){

                setTimeout(() => startDrawing(), 160);

            }

        });

    document.getElementById("registerExportCsvBtn")
        ?.addEventListener("click", () => {

            exportTableAsCSV("parcelTable", "parcel_register.csv");

        });

    document.getElementById("registerExportXlsxBtn")
        ?.addEventListener("click", () => {

            exportTableAsXLSX("parcelTable", "parcel_register.xlsx", "Parcel Register");

        });

    document.getElementById("registerFilterBtn")
        ?.addEventListener("click", flashQuickFilters);

});

//======================================================
// FLASH QUICK FILTERS
// Scrolls the sidebar's Quick Filters panel into view and
// briefly highlights it - used by every "Filter" button so
// people notice where filtering actually happens.
//======================================================

function flashQuickFilters(){

    const panel = document.getElementById("quickFiltersCard");

    if(!panel) return;

    panel.scrollIntoView({ behavior:"smooth", block:"start" });

    panel.classList.add("quick-filters-flash");

    setTimeout(() => panel.classList.remove("quick-filters-flash"), 1200);

}

window.flashQuickFilters = flashQuickFilters;

//======================================================
// BULK UPLOAD
//======================================================

function bulkUpload(){

    const input=document.createElement("input");

    input.type="file";

    input.accept=".geojson,.json,.zip";

    input.click();

}

//======================================================
// REPORT
//======================================================

function generateReport(){

    window.print();

}

//======================================================
// DOWNLOAD CURRENT DATA
//======================================================

function downloadData(){

    let features =
        getCurrentFeatures();

    const geojson = {

        type:"FeatureCollection",

        features:features

    };

    const blob = new Blob(

        [JSON.stringify(geojson,null,2)],

        {

            type:"application/json"

        }

    );

    const url = URL.createObjectURL(blob);

    const a=document.createElement("a");

    a.href=url;

    a.download="Filtered_Parcels.geojson";

    a.click();

    URL.revokeObjectURL(url);

}
