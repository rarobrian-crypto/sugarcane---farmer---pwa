//------------------------------------------------------
// TABLE.JS
// Sugarcane GIS Enterprise
//------------------------------------------------------

function populateParcelTable(features){

    const tbody=document.getElementById("parcelTableBody");

    if(!tbody){

        console.error("parcelTableBody missing");

        return;

    }


    tbody.innerHTML="";


    features.forEach(function(feature){


        const p=feature.properties;

let village="-";
let growerName=p.Grower_ID;

if(typeof getGrowerById==="function"){

    const grower=getGrowerById(p.Grower_ID);

    if(grower){

        village =
            grower.village ||
            grower.Village ||
            "-";

        growerName =
            grower.grower_name ||
            grower.name ||
            p.Grower_ID;

    }

}



        const row=document.createElement("tr");


        row.id="parcelRow_"+p.Parcel_ID;


        const status = (p.Status || "-").toLowerCase();

let badgeClass = "";

switch(status){

    case "planned":
        badgeClass = "planned";
        break;

    case "growing":
        badgeClass = "growing";
        break;

    case "mature":
        badgeClass = "mature";
        break;

    case "harvested":
        badgeClass = "harvested";
        break;

    case "fallow":
        badgeClass = "fallow";
        break;

    default:
        badgeClass = "fallow";

}

row.innerHTML = `

<td>${p.Parcel_ID}</td>

<td>${growerName}</td>

<td>${village}</td>

<td>${p.Variety || "-"}</td>

<td>${Number(p.Area_Ha || 0).toFixed(2)}</td>

<td>${p.Crop_Age !== undefined && p.Crop_Age !== null ? Number(p.Crop_Age).toFixed(1) + " mo" : "-"}</td>

<td>

    <span class="statusBadge ${badgeClass}">

        ${p.Status || "-"}

    </span>

</td>

<td>${Number(p.Estimated_Tonnage || 0).toFixed(2)}</td>

<td class="action-cell">

    <button class="action-btn view"
            title="View"
            data-parcel-id="${p.Parcel_ID}">

        <i class="fa-solid fa-eye"></i>

    </button>

    <button class="action-btn edit"
            title="Edit"
            data-parcel-id="${p.Parcel_ID}">

        <i class="fa-solid fa-pen"></i>

    </button>

    <button class="action-btn delete"
            title="Delete"
            data-parcel-id="${p.Parcel_ID}">

        <i class="fa-solid fa-trash"></i>

    </button>

</td>

`;


        row.style.cursor="pointer";


        row.onclick = function(){

       zoomToParcel(p.Parcel_ID);

       highlightParcelRow(p.Parcel_ID);

};
    row.ondblclick = function(){

    map.flyToBounds(

        L.geoJSON(feature).getBounds(),

        {

            padding:[50,50]

        }

    );

};
row.onmouseenter = function(){

    if(!parcelLayer) return;

    parcelLayer.eachLayer(function(layer){

        if(

            String(layer.feature.properties.Parcel_ID) ===

            String(p.Parcel_ID)

        ){

            highlightParcel(layer);

        }

    });

};

row.onmouseleave = function(){

    if(!parcelLayer) return;

    parcelLayer.eachLayer(function(layer){

        if(

            String(layer.feature.properties.Parcel_ID) ===

            String(p.Parcel_ID)

        ){

            if(selectedLayer !== layer){

                resetParcel(layer);

            }

        }

    });

};
        
        tbody.appendChild(row);


    });

    const footer = document.getElementById("registerTableFooter");

    if(footer){

        footer.textContent =
            `Showing ${features.length} parcel${features.length === 1 ? "" : "s"}`;

    }

}



function highlightParcelRow(parcelID){


    document
    .querySelectorAll("#parcelTableBody tr")
    .forEach(row=>{


        row.classList.remove("selectedRow");


    });



    const row=document.getElementById(
        "parcelRow_"+parcelID
    );


    if(row){


        row.classList.add("selectedRow");


        row.scrollIntoView({

            behavior:"smooth",

            block:"nearest"

        });


    }


}



window.populateParcelTable=populateParcelTable;

window.highlightParcelRow=highlightParcelRow;

//======================================================
// ACTION BUTTONS (View / Edit / Delete)
// Delegated once on the tbody so it survives re-renders.
//======================================================

document.addEventListener("DOMContentLoaded", () => {

    const tbody = document.getElementById("parcelTableBody");

    tbody?.addEventListener("click", (e) => {

        const btn = e.target.closest(".action-btn");

        if(!btn) return;

        e.stopPropagation();

        const parcelId = btn.dataset.parcelId;

        if(btn.classList.contains("view") && typeof viewParcel === "function"){

            viewParcel(parcelId);

        }

        else if(btn.classList.contains("edit") && typeof openEditParcel === "function"){

            openEditParcel(parcelId);

        }

        else if(btn.classList.contains("delete") && typeof deleteParcel === "function"){

            deleteParcel(parcelId);

        }

    });

});