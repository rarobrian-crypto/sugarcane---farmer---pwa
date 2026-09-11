//------------------------------------------------------
// WIZARD.JS
// Sugarcane GIS Enterprise
//
// Drives the 4-step "Add Parcel" wizard shown after a
// boundary has been drawn on the map (see digitizer/*.js).
// Step 1: Identification   Step 2: Crop Details
// Step 3: Area & Yield     Step 4: Review & Save
//------------------------------------------------------

const ParcelWizard = {

    step: 1,

    totalSteps: 4,

    data: {}

};

//======================================================
// OPEN / CLOSE
//======================================================

function openParcelWizard(){

    ParcelWizard.step = 1;

    ParcelWizard.data = {};

    document.getElementById("wizardOverlay").style.display = "flex";

    renderWizardStep();

}

function closeParcelWizard(cancelDraw){

    document.getElementById("wizardOverlay").style.display = "none";

    if(cancelDraw && typeof cancelDrawing === "function"){

        cancelDrawing();

    }

}

//======================================================
// RENDER CURRENT STEP
//======================================================

function renderWizardStep(){

    const content = document.getElementById("wizardContent");

    document.querySelectorAll(".wizard-step").forEach((dot, i) => {

        dot.classList.toggle("active", i + 1 === ParcelWizard.step);
        dot.classList.toggle("complete", i + 1 < ParcelWizard.step);

    });

    if(ParcelWizard.step === 1){

        content.innerHTML = `

            <div class="form-group">
                <label>Parcel ID</label>
                <input type="number" id="wzParcelID" placeholder="e.g. 1024"
                    value="${ParcelWizard.data.parcel_id ?? ""}">
            </div>

            <div class="form-group">
                <label>Grower</label>
                <div class="grower-field-row">
                    <select id="wzGrowerSelect"></select>
                    <button type="button" id="wzAddGrowerBtn" title="Add New Grower">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>

            <div class="form-group">
                <label>Variety</label>
                <input type="text" id="wzVariety" placeholder="e.g. CO 421"
                    value="${ParcelWizard.data.variety ?? ""}">
            </div>

        `;

        if(typeof populateGrowerDropdown === "function"){

            populateGrowerDropdown(ParcelWizard.data.grower_id, "wzGrowerSelect");

        }

        document.getElementById("wzAddGrowerBtn")
            ?.addEventListener("click", () => {

                window.wizardAwaitingGrower = true;

                document.getElementById("growerModal").style.display = "block";

            });

    }

    else if(ParcelWizard.step === 2){

        content.innerHTML = `

            <div class="form-group">
                <label>Planting Date</label>
                <input type="date" id="wzPlantingDate"
                    value="${ParcelWizard.data.planting_date ?? ""}">
            </div>

            <div class="form-group">
                <label>Expected Harvest Date</label>
                <input type="date" id="wzHarvestDate"
                    value="${ParcelWizard.data.harvest_due ?? ""}">
            </div>

            <div class="form-group">
                <label>Ratoon Cycle</label>
                <input type="number" id="wzRatoonCycle" min="0" placeholder="0 = Plant crop"
                    value="${ParcelWizard.data.ratoon_cycle ?? ""}">
            </div>

            <div class="form-group">
                <label>Status</label>
                <div class="status-preview" id="wzStatusPreview">
                    Set a planting date to see the status.
                </div>
            </div>

        `;

        const plantingInput = document.getElementById("wzPlantingDate");
        const harvestInput = document.getElementById("wzHarvestDate");
        const preview = document.getElementById("wzStatusPreview");

        const updateStatusPreview = () => {

            const status = computeStatusPreview(plantingInput.value, harvestInput.value);

            preview.innerHTML = status
                ? `Calculated automatically: <strong>${status}</strong>`
                : "Set a planting date to see the status.";

        };

        plantingInput.addEventListener("input", updateStatusPreview);
        harvestInput.addEventListener("input", updateStatusPreview);

        updateStatusPreview();

    }

    else if(ParcelWizard.step === 3){

        const vertices = (typeof DrawingController !== "undefined")
            ? DrawingController.vertices
            : [];

        const areaHa = computeAreaHa(vertices);

        ParcelWizard.data.area = areaHa;

        content.innerHTML = `

            <div class="form-group">
                <label>Area (auto-calculated from drawn boundary)</label>
                <input type="text" id="wzArea" value="${areaHa.toFixed(2)} Ha" readonly>
            </div>

            <div class="form-group">
                <label>Estimated Yield (t/ha)</label>
                <input type="number" step="0.01" min="0" id="wzYield" placeholder="e.g. 80"
                    value="${ParcelWizard.data.yield_t_ha ?? ""}">
            </div>

            <div class="form-group">
                <label>Estimated Tonnage</label>
                <input type="text" id="wzTonnage" readonly>
            </div>

        `;

        const yieldInput = document.getElementById("wzYield");
        const tonnageInput = document.getElementById("wzTonnage");

        const updateTonnage = () => {

            const y = parseFloat(yieldInput.value);

            tonnageInput.value = (y > 0)
                ? (y * areaHa).toFixed(2) + " t"
                : "-";

        };

        yieldInput.addEventListener("input", updateTonnage);

        updateTonnage();

    }

    else if(ParcelWizard.step === 4){

        collectStepData();

        const d = ParcelWizard.data;

        const growerName = (() => {

            const select = document.getElementById("wzGrowerSelect");

            if(typeof getGrowerById === "function"){

                const g = getGrowerById(d.grower_id);

                if(g) return g.grower_name;

            }

            return d.grower_id;

        })();

        const status = computeStatusPreview(d.planting_date, d.harvest_due);

        content.innerHTML = `

            <div class="wizard-review">
                <p><strong>Parcel ID:</strong> ${d.parcel_id ?? "-"}</p>
                <p><strong>Grower:</strong> ${growerName ?? "-"}</p>
                <p><strong>Variety:</strong> ${d.variety || "-"}</p>
                <p><strong>Status (auto):</strong> ${status || "-"}</p>
                <p><strong>Planting Date:</strong> ${d.planting_date || "-"}</p>
                <p><strong>Expected Harvest:</strong> ${d.harvest_due || "-"}</p>
                <p><strong>Ratoon Cycle:</strong> ${d.ratoon_cycle ?? "-"}</p>
                <p><strong>Area:</strong> ${d.area ? d.area.toFixed(2) + " Ha" : "-"}</p>
                <p><strong>Estimated Yield:</strong> ${d.yield_t_ha ?? "-"} t/ha</p>
                <p><strong>Estimated Tonnage:</strong> ${d.estimated_tonnage ?? "-"} t</p>
            </div>

        `;

    }

    document.getElementById("wizardBack").style.visibility =
        (ParcelWizard.step === 1) ? "hidden" : "visible";

    document.getElementById("wizardNext").textContent =
        (ParcelWizard.step === ParcelWizard.totalSteps) ? "Save Parcel" : "Next";

}

//======================================================
// STATUS PREVIEW (mirrors server.js computeInitialStatus)
//======================================================

function computeStatusPreview(plantingDateStr, harvestDueStr){

    if(!plantingDateStr) return null;

    const DAY = 24 * 60 * 60 * 1000;
    const today = new Date();
    const plant = new Date(plantingDateStr);

    if(isNaN(plant)) return null;

    if(plant > today) return "Planned";

    if(harvestDueStr){

        const harvest = new Date(harvestDueStr);

        if(!isNaN(harvest)){

            if(today >= harvest) return "Harvested";

            if(today >= new Date(harvest.getTime() - 45 * DAY)) return "Mature";

            return "Growing";

        }

    }

    const fallbackMatureFrom = new Date(plant.getTime() + (365 - 45) * DAY);

    return (today >= fallbackMatureFrom) ? "Mature" : "Growing";

}

//======================================================
// AREA HELPER (mirrors digitizer/measure.js)
//======================================================

function computeAreaHa(vertices){

    if(!vertices || vertices.length < 3) return 0;

    const projected = vertices.map(coord => proj4("EPSG:4326", "EPSG:32636", coord));

    let area = 0;

    for(let i = 0; i < projected.length; i++){

        const j = (i + 1) % projected.length;

        area += projected[i][0] * projected[j][1] - projected[j][0] * projected[i][1];

    }

    return Math.abs(area) / 2 / 10000;

}

//======================================================
// COLLECT DATA FROM CURRENT STEP INTO STATE
//======================================================

function collectStepData(){

    if(ParcelWizard.step === 1){

        ParcelWizard.data.parcel_id = document.getElementById("wzParcelID")?.value;
        ParcelWizard.data.grower_id = document.getElementById("wzGrowerSelect")?.value;
        ParcelWizard.data.variety = document.getElementById("wzVariety")?.value;

    }

    else if(ParcelWizard.step === 2){

        ParcelWizard.data.planting_date = document.getElementById("wzPlantingDate")?.value;
        ParcelWizard.data.harvest_due = document.getElementById("wzHarvestDate")?.value;
        ParcelWizard.data.ratoon_cycle = document.getElementById("wzRatoonCycle")?.value;

    }

    else if(ParcelWizard.step === 3){

        const y = document.getElementById("wzYield")?.value;

        ParcelWizard.data.yield_t_ha = y ? Number(y) : null;

        ParcelWizard.data.estimated_tonnage = (y > 0)
            ? Number((y * ParcelWizard.data.area).toFixed(2))
            : null;

    }

}

//======================================================
// VALIDATE CURRENT STEP
//======================================================

function validateStep(){

    if(ParcelWizard.step === 1){

        if(!ParcelWizard.data.parcel_id){

            alert("Please enter a Parcel ID.");
            return false;

        }

        if(!ParcelWizard.data.grower_id){

            alert("Please select a Grower.");
            return false;

        }

    }

    return true;

}

//======================================================
// NAVIGATION
//======================================================

async function handleWizardNext(){

    collectStepData();

    if(!validateStep()) return;

    if(ParcelWizard.step < ParcelWizard.totalSteps){

        ParcelWizard.step++;

        renderWizardStep();

        return;

    }

    //--------------------------------------------------
    // Final step -> submit
    //--------------------------------------------------

    const btn = document.getElementById("wizardNext");

    btn.disabled = true;
    btn.textContent = "Saving...";

    const result = await submitParcel(ParcelWizard.data);

    btn.disabled = false;
    btn.textContent = "Save Parcel";

    if(result.success){

        alert("Parcel " + result.parcel_id + " saved successfully.");

        closeParcelWizard(false);

    }

    else{

        alert(result.error || "Unable to save parcel.");

    }

}

function handleWizardBack(){

    if(ParcelWizard.step > 1){

        collectStepData();

        ParcelWizard.step--;

        renderWizardStep();

    }

}

//======================================================
// INITIALIZE
//======================================================

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("wizardNext")
        ?.addEventListener("click", handleWizardNext);

    document.getElementById("wizardBack")
        ?.addEventListener("click", handleWizardBack);

    document.getElementById("wizardClose")
        ?.addEventListener("click", () => closeParcelWizard(true));

});

window.openParcelWizard = openParcelWizard;
window.closeParcelWizard = closeParcelWizard;
