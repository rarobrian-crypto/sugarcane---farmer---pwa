//------------------------------------------------------
// NDVI-UPLOAD.JS
// The "Add NDVI Reading" modal - real pixel computation
// from uploaded images, or manual entry.
//------------------------------------------------------

//======================================================
// IMAGE -> CANVAS (downscaled for performance)
//======================================================

function loadImageToCanvas(file, maxDim){

    maxDim = maxDim || 300;

    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onload = (e) => {

            const img = new Image();

            img.onload = () => {

                let w = img.width;
                let h = img.height;

                if(w > maxDim || h > maxDim){

                    const scale = maxDim / Math.max(w, h);

                    w = Math.round(w * scale);
                    h = Math.round(h * scale);

                }

                const canvas = document.createElement("canvas");

                canvas.width = w;
                canvas.height = h;

                const ctx = canvas.getContext("2d");

                ctx.drawImage(img, 0, 0, w, h);

                resolve({ canvas, ctx, dataUrl:e.target.result });

            };

            img.onerror = reject;

            img.src = e.target.result;

        };

        reader.onerror = reject;

        reader.readAsDataURL(file);

    });

}

//======================================================
// TRUE NDVI FROM NIR + RED BAND IMAGES
//======================================================

async function computeTrueNdvi(nirFile, redFile){

    const nir = await loadImageToCanvas(nirFile);

    const red = await loadImageToCanvas(redFile);

    const w = Math.min(nir.canvas.width, red.canvas.width);

    const h = Math.min(nir.canvas.height, red.canvas.height);

    const nirData = nir.ctx.getImageData(0, 0, w, h).data;

    const redData = red.ctx.getImageData(0, 0, w, h).data;

    let sum = 0, min = Infinity, max = -Infinity, count = 0;

    for(let i = 0; i < nirData.length; i += 4){

        const nirVal = (nirData[i] + nirData[i+1] + nirData[i+2]) / 3;

        const redVal = (redData[i] + redData[i+1] + redData[i+2]) / 3;

        const denom = nirVal + redVal;

        if(denom === 0) continue;

        const ndvi = (nirVal - redVal) / denom;

        sum += ndvi;
        count++;

        if(ndvi < min) min = ndvi;
        if(ndvi > max) max = ndvi;

    }

    if(!count) throw new Error("Could not read pixel data from the images.");

    return {

        avg:sum / count,
        min,
        max,
        source:"drone_multispectral",
        previewDataUrl:nir.dataUrl

    };

}

//======================================================
// VARI APPROXIMATION FROM A NORMAL RGB PHOTO
//======================================================

async function computeVariApprox(rgbFile){

    const img = await loadImageToCanvas(rgbFile);

    const data = img.ctx.getImageData(0, 0, img.canvas.width, img.canvas.height).data;

    let sum = 0, min = Infinity, max = -Infinity, count = 0;

    for(let i = 0; i < data.length; i += 4){

        const r = data[i], g = data[i+1], b = data[i+2];

        const denom = g + r - b;

        if(denom === 0) continue;

        const vari = (g - r) / denom;

        sum += vari;
        count++;

        if(vari < min) min = vari;
        if(vari > max) max = vari;

    }

    if(!count) throw new Error("Could not read pixel data from the image.");

    return {

        avg:sum / count,
        min,
        max,
        source:"drone_rgb_approx",
        previewDataUrl:img.dataUrl

    };

}

//======================================================
// MODAL WIRING
//======================================================

document.addEventListener("DOMContentLoaded", () => {

    const modal = document.getElementById("ndviUploadModal");

    if(!modal) return;

    //----------------------------------------------------
    // Open / Close
    //----------------------------------------------------

    document.getElementById("openNdviUploadBtn")?.addEventListener("click", async () => {

        await populateNdviParcelSelect();

        document.getElementById("ndviReadingDate").value =
            new Date().toISOString().slice(0, 10);

        modal.style.display = "block";

    });

    document.getElementById("ndviModalCloseBtn")?.addEventListener("click", () => {

        modal.style.display = "none";

        resetNdviModal();

    });

    window.addEventListener("click", (e) => {

        if(e.target === modal){

            modal.style.display = "none";

            resetNdviModal();

        }

    });

    //----------------------------------------------------
    // Mode tabs
    //----------------------------------------------------

    document.querySelectorAll(".ndvi-mode-tab").forEach(tab => {

        tab.addEventListener("click", () => {

            document.querySelectorAll(".ndvi-mode-tab").forEach(t => t.classList.remove("active"));

            tab.classList.add("active");

            NdviState.mode = tab.dataset.mode;

            document.getElementById("ndviModeMultispectral").style.display =
                NdviState.mode === "multispectral" ? "block" : "none";

            document.getElementById("ndviModeRgb").style.display =
                NdviState.mode === "rgb" ? "block" : "none";

            document.getElementById("ndviModeManual").style.display =
                NdviState.mode === "manual" ? "block" : "none";

            document.getElementById("ndviComputedPreview").style.display = "none";

            NdviState.computed = null;

        });

    });

    //----------------------------------------------------
    // Auto-compute when files are chosen
    //----------------------------------------------------

    async function tryComputeMultispectral(){

        const nirFile = document.getElementById("ndviNirFile").files[0];
        const redFile = document.getElementById("ndviRedFile").files[0];

        if(!nirFile || !redFile) return;

        const errorBox = document.getElementById("ndviUploadError");

        errorBox.textContent = "";

        try{

            NdviState.computed = await computeTrueNdvi(nirFile, redFile);

            showComputedPreview("Computed real NDVI from NIR + Red bands.");

        }
        catch(err){

            errorBox.textContent = err.message;

        }

    }

    async function tryComputeRgb(){

        const rgbFile = document.getElementById("ndviRgbFile").files[0];

        if(!rgbFile) return;

        const errorBox = document.getElementById("ndviUploadError");

        errorBox.textContent = "";

        try{

            NdviState.computed = await computeVariApprox(rgbFile);

            showComputedPreview("Computed VARI approximation (not true NDVI) from the RGB photo.");

        }
        catch(err){

            errorBox.textContent = err.message;

        }

    }

    document.getElementById("ndviNirFile")?.addEventListener("change", tryComputeMultispectral);
    document.getElementById("ndviRedFile")?.addEventListener("change", tryComputeMultispectral);
    document.getElementById("ndviRgbFile")?.addEventListener("change", tryComputeRgb);

    function showComputedPreview(label){

        const box = document.getElementById("ndviComputedPreview");

        box.style.display = "block";

        box.innerHTML = `

            <strong>${label}</strong><br>
            Average: ${NdviState.computed.avg.toFixed(3)} &nbsp;
            Min: ${NdviState.computed.min.toFixed(3)} &nbsp;
            Max: ${NdviState.computed.max.toFixed(3)}

        `;

    }

    //----------------------------------------------------
    // Save
    //----------------------------------------------------

    document.getElementById("ndviSaveBtn")?.addEventListener("click", async () => {

        const errorBox = document.getElementById("ndviUploadError");

        errorBox.textContent = "";

        const parcelId = document.getElementById("ndviParcelSelect").value;

        const readingDate = document.getElementById("ndviReadingDate").value;

        const notes = document.getElementById("ndviNotes").value;

        if(!parcelId){

            errorBox.textContent = "Please select a parcel.";

            return;

        }

        let payload = null;

        if(NdviState.mode === "manual"){

            const avg = parseFloat(document.getElementById("ndviManualAvg").value);

            if(isNaN(avg)){

                errorBox.textContent = "Please enter an average NDVI value.";

                return;

            }

            payload = {

                parcel_id:parcelId,

                reading_date:readingDate,

                avg_ndvi:avg,

                min_ndvi:document.getElementById("ndviManualMin").value || null,

                max_ndvi:document.getElementById("ndviManualMax").value || null,

                source:document.getElementById("ndviManualSource").value,

                notes

            };

        }
        else{

            if(!NdviState.computed){

                errorBox.textContent = "Choose image(s) first - the NDVI values are computed automatically.";

                return;

            }

            payload = {

                parcel_id:parcelId,

                reading_date:readingDate,

                avg_ndvi:NdviState.computed.avg,

                min_ndvi:NdviState.computed.min,

                max_ndvi:NdviState.computed.max,

                source:NdviState.computed.source,

                image_base64:NdviState.computed.previewDataUrl,

                notes

            };

        }

        const btn = document.getElementById("ndviSaveBtn");

        btn.disabled = true;

        btn.textContent = "Saving...";

        try{

            const response = await fetch("/ndvi", {

                method:"POST",

                headers:{ "Content-Type":"application/json" },

                body:JSON.stringify(payload)

            });

            const result = await response.json();

            if(!result.success){

                errorBox.textContent = result.error || "Unable to save reading.";

                btn.disabled = false;

                btn.textContent = "Save Reading";

                return;

            }

            modal.style.display = "none";

            resetNdviModal();

            btn.disabled = false;

            btn.textContent = "Save Reading";

            if(typeof loadNdviData === "function") loadNdviData();

        }
        catch(err){

            console.error(err);

            errorBox.textContent = "Server error while saving.";

            btn.disabled = false;

            btn.textContent = "Save Reading";

        }

    });

});

async function populateNdviParcelSelect(){

    const select = document.getElementById("ndviParcelSelect");

    if(!select || !window.parcelData) return;

    select.innerHTML = window.parcelData.features.map(f =>

        `<option value="${f.properties.Parcel_ID}">Parcel ${f.properties.Parcel_ID} - ${f.properties.Variety || ""}</option>`

    ).join("");

}

function resetNdviModal(){

    document.getElementById("ndviNirFile").value = "";
    document.getElementById("ndviRedFile").value = "";
    document.getElementById("ndviRgbFile").value = "";
    document.getElementById("ndviManualAvg").value = "";
    document.getElementById("ndviManualMin").value = "";
    document.getElementById("ndviManualMax").value = "";
    document.getElementById("ndviNotes").value = "";
    document.getElementById("ndviUploadError").textContent = "";
    document.getElementById("ndviComputedPreview").style.display = "none";

    NdviState.computed = null;

}
