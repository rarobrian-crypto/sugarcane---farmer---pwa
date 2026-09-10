//------------------------------------------------------
// SAVE.JS
// Sugarcane GIS Enterprise v2.0
//
// Called by the wizard (js/wizard/wizard.js) once the
// user has drawn a boundary and completed all 4 steps.
//------------------------------------------------------

//======================================================
// SUBMIT PARCEL TO SERVER
//======================================================

async function submitParcel(formData){

    //--------------------------------------------------
    // Validation
    //--------------------------------------------------

    if(DrawingController.vertices.length < 3){

        return {

            success:false,

            error:"A parcel requires at least 3 vertices."

        };

    }

    //--------------------------------------------------
    // Build payload matching what POST /addParcel expects
    //--------------------------------------------------

    const payload = {

        parcel_id: formData.parcel_id,

        grower_id: formData.grower_id,

        variety: formData.variety,

        area: formData.area,

        planting_date: formData.planting_date || null,

        harvest_due: formData.harvest_due || null,

        ratoon_cycle: formData.ratoon_cycle || null,

        yield_t_ha: formData.yield_t_ha || null,

        estimated_tonnage: formData.estimated_tonnage || null,

        geometry: DrawingController.vertices

    };

    try{

        //--------------------------------------------------
        // Send to Express
        //--------------------------------------------------

        const response = await fetch("/addParcel",{

            method:"POST",

            headers:{

                "Content-Type":"application/json"

            },

            body:JSON.stringify(payload)

        });

        const result = await response.json();

        if(!result.success){

            return {

                success:false,

                error: result.error || "Unable to save parcel."

            };

        }

        //--------------------------------------------------
        // Clear Drawing
        //--------------------------------------------------

        clearDrawing();

        finishDrawing();

        document.getElementById("measurePanel").style.display = "none";

        //--------------------------------------------------
        // Refresh Parcels
        //--------------------------------------------------

        if(typeof loadParcels === "function"){

            loadParcels();

        }

        //--------------------------------------------------
        // Zoom to Parcel
        //--------------------------------------------------

        if(result.bounds){

            window.map.fitBounds(result.bounds);

        }

        return {

            success:true,

            parcel_id: result.parcel_id

        };

    }

    catch(error){

        console.error(error);

        return {

            success:false,

            error:"Server error while saving parcel."

        };

    }

}

window.submitParcel = submitParcel;
