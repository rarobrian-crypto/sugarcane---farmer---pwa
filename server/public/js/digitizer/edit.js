//------------------------------------------------------
// EDIT.JS
// Sugarcane GIS Enterprise
//
// Handles the View / Edit / Delete actions on each row of
// the Parcel Register table.
//------------------------------------------------------

let editingParcelID = null;

//======================================================
// VIEW
//======================================================

function viewParcel(parcelId){

    if(typeof zoomToParcel === "function"){

        zoomToParcel(parcelId);

    }

    if(typeof highlightParcelRow === "function"){

        highlightParcelRow(parcelId);

    }

}

//======================================================
// EDIT - OPEN
//======================================================

async function openEditParcel(parcelId){

    try{

        const response = await fetch("/parcel/" + parcelId);

        if(!response.ok){

            alert("Unable to load parcel " + parcelId + ".");

            return;

        }

        const feature = await response.json();

        const p = feature.properties;

        editingParcelID = parcelId;

        document.getElementById("editParcelIdLabel").textContent = "#" + parcelId;

        document.getElementById("edVariety").value = p.Variety || "";

        document.getElementById("edPlantingDate").value = toDateInputValue(p.Planting_Date);

        document.getElementById("edHarvestDate").value = toDateInputValue(p.Harvest_Due);

        document.getElementById("edRatoonCycle").value = p.Ratoon_Cycle ?? "";

        document.getElementById("edYield").value = p.Yield_t_ha ?? "";

        if(typeof populateGrowerDropdown === "function"){

            populateGrowerDropdown(p.Grower_ID, "edGrowerSelect");

        }

        updateEditStatusPreview();

        document.getElementById("editParcelModal").style.display = "block";

    }

    catch(error){

        console.error(error);

        alert("Unable to load parcel " + parcelId + ".");

    }

}

//------------------------------------------------------
// Postgres returns full ISO timestamps - <input type=date>
// needs just the YYYY-MM-DD portion.
//------------------------------------------------------

function toDateInputValue(value){

    if(!value) return "";

    return String(value).slice(0, 10);

}

//======================================================
// EDIT - LIVE STATUS PREVIEW
//======================================================

function updateEditStatusPreview(){

    const preview = document.getElementById("edStatusPreview");

    if(!preview) return;

    const planting = document.getElementById("edPlantingDate").value;

    const harvest = document.getElementById("edHarvestDate").value;

    const status = (typeof computeStatusPreview === "function")

        ? computeStatusPreview(planting, harvest)

        : null;

    preview.textContent = status || "Set a planting date to see the status.";

}

//======================================================
// EDIT - CLOSE
//======================================================

function closeEditParcel(){

    document.getElementById("editParcelModal").style.display = "none";

    editingParcelID = null;

}

//======================================================
// EDIT - SAVE
//======================================================

async function saveEditParcel(){

    if(!editingParcelID) return;

    const growerId = document.getElementById("edGrowerSelect").value;

    if(!growerId){

        alert("Please select a Grower.");

        return;

    }

    const yieldVal = document.getElementById("edYield").value;

    const parcelRow = (typeof window.parcelData !== "undefined" && window.parcelData)

        ? window.parcelData.features.find(f =>

            String(f.properties.Parcel_ID) === String(editingParcelID)

        )

        : null;

    const area = parcelRow ? Number(parcelRow.properties.Area_Ha || 0) : 0;

    const payload = {

        grower_id: growerId,

        variety: document.getElementById("edVariety").value,

        planting_date: document.getElementById("edPlantingDate").value || null,

        harvest_due: document.getElementById("edHarvestDate").value || null,

        ratoon_cycle: document.getElementById("edRatoonCycle").value || null,

        yield_t_ha: yieldVal || null,

        estimated_tonnage: (yieldVal > 0) ? Number((yieldVal * area).toFixed(2)) : null

    };

    const btn = document.getElementById("saveEditParcelBtn");

    btn.disabled = true;
    btn.textContent = "Saving...";

    try{

        const response = await fetch("/parcel/" + editingParcelID, {

            method: "PUT",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify(payload)

        });

        const result = await response.json();

        btn.disabled = false;
        btn.textContent = "Save Changes";

        if(!result.success){

            alert(result.error || "Unable to update parcel.");

            return;

        }

        closeEditParcel();

        if(typeof loadParcels === "function"){

            loadParcels();

        }

    }

    catch(error){

        console.error(error);

        btn.disabled = false;
        btn.textContent = "Save Changes";

        alert("Server error while updating parcel.");

    }

}

//======================================================
// DELETE
//======================================================

async function deleteParcel(parcelId){

    const confirmed = confirm(

        "Delete parcel " + parcelId + "? This cannot be undone."

    );

    if(!confirmed) return;

    try{

        const response = await fetch("/parcel/" + parcelId, {

            method: "DELETE"

        });

        const result = await response.json();

        if(!result.success){

            alert(result.error || "Unable to delete parcel.");

            return;

        }

        if(typeof loadParcels === "function"){

            loadParcels();

        }

    }

    catch(error){

        console.error(error);

        alert("Server error while deleting parcel.");

    }

}

//======================================================
// INITIALIZE
//======================================================

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("edPlantingDate")

        ?.addEventListener("input", updateEditStatusPreview);

    document.getElementById("edHarvestDate")

        ?.addEventListener("input", updateEditStatusPreview);

    document.getElementById("saveEditParcelBtn")

        ?.addEventListener("click", saveEditParcel);

    document.getElementById("cancelEditParcelBtn")

        ?.addEventListener("click", closeEditParcel);

    document.querySelector(".closeEditParcel")

        ?.addEventListener("click", closeEditParcel);

    window.addEventListener("click", (e) => {

        if(e.target === document.getElementById("editParcelModal")){

            closeEditParcel();

        }

    });

});

window.viewParcel = viewParcel;
window.openEditParcel = openEditParcel;
window.deleteParcel = deleteParcel;
