//------------------------------------------------------
// MAP.JS
// Sugarcane GIS Enterprise v5.0
//------------------------------------------------------

//======================================================
// GLOBAL VARIABLES
//======================================================

let map;

let streetLayer;
let satelliteLayer;
let layerControl = null;
let parcelLayer = null;
window.parcelData = null;
window.homeMap = homeMap;

let selectedLayer = null;

let legend = null;

//======================================================
// STATUS COLOURS
//======================================================

const STATUS_COLORS={

    Planned:"#1976D2",

    Growing:"#43A047",

    Mature:"#FB8C00",

    Harvested:"#8D6E63",

    Fallow:"#9E9E9E",

    Unknown:"#BDBDBD"

};

//======================================================
// INITIALIZE
//======================================================

document.addEventListener("DOMContentLoaded",()=>{

    initializeMap();

    initializeToolbar();

});

//======================================================
// INITIALIZE MAP
//======================================================

function initializeMap(){

    //--------------------------------------------------
    // Create Map
    //--------------------------------------------------

    map=L.map("map",{

        zoomControl:true,

        attributionControl:true,

        // OpenStreetMap's tile server only serves up to zoom 19 -
        // anything higher was causing repeated 400s on tile requests
        // whenever fitBounds()/route zoom pushed past that.
        maxZoom:19

    });
     window.map = map;
    //--------------------------------------------------
    // Default View
    //--------------------------------------------------

    map.setView(

        [-0.520,35.270],

        12

    );

    //--------------------------------------------------
    // Basemaps
    //--------------------------------------------------

    createBaseMaps();

    //--------------------------------------------------
    // Legend
    //--------------------------------------------------

    addLegend();

    //--------------------------------------------------
    // Load GeoJSON
    //--------------------------------------------------

    loadParcels();

}
//======================================================
// LOAD PARCELS
//======================================================

async function loadParcels(){

    try{

        const response = await fetch("/parcels");

        const geojson = await response.json();

        window.parcelData = geojson;

        populateFilters(geojson.features);

        refreshApplication(geojson.features);
    }

    catch(error){

        console.error("Failed to load parcels.", error);

    }

}
//======================================================
// DRAW PARCELS
//======================================================

function drawParcels(features){

    if(parcelLayer){

        map.removeLayer(parcelLayer);

    }

    parcelLayer = L.geoJSON({

        type:"FeatureCollection",

        features:features

    },{

        style:parcelStyle,

        onEachFeature:onEachParcel

    }).addTo(map);

    window.parcelLayer = parcelLayer;

    if(features.length){

        map.fitBounds(

            parcelLayer.getBounds(),

            {padding:[40,40]}

        );

    }

}
//======================================================
// FIT MAP TO CURRENT PARCELS
//
// Leaflet computes zoom/bounds from the container's pixel
// size. While #mapSection is still display:none (before
// its first click) that size is 0x0, so any fitBounds()
// done during the initial load ends up wrong - the map
// looks blank/mis-zoomed until something forces a
// recalculation. Call this again once the map container
// is actually visible (see nav.js switchView).
//======================================================

function fitMapToParcels(){

    if(!map) return;

    map.invalidateSize(true);

    if(

        parcelLayer &&

        parcelLayer.getBounds &&

        parcelLayer.getBounds().isValid()

    ){

        map.fitBounds(

            parcelLayer.getBounds(),

            {padding:[40,40]}

        );

    }

}

window.fitMapToParcels = fitMapToParcels;
//======================================================
// REFRESH ENTIRE APPLICATION
//======================================================

function refreshApplication(features){

    drawParcels(features);

    populateParcelTable(features);

    refreshDashboard(features);

    if(typeof renderExtraSections === "function"){

        renderExtraSections(features);

    }

    if(typeof loadNdviData === "function"){

        try{ loadNdviData(); }
        catch(err){ console.error("[NDVI load failed]", err); }

    }

}

//======================================================
// REFRESH MAP
//======================================================

function refreshMap(features){

    refreshApplication(features);

}
//======================================================
// RESTORE ORIGINAL DATA
//======================================================

function restoreMap(){

    if(!window.parcelData) return;

    refreshApplication(

        window.parcelData.features

    );

}
//======================================================
// PARCEL STYLE
//======================================================

function parcelStyle(feature){

    const status = String(

        feature.properties.Status || "Unknown"

    ).trim();

    return{

        color:"#ffffff",

        weight:1.2,

        opacity:1,

        fillOpacity:0.75,

        fillColor:

            STATUS_COLORS[status] ||

            STATUS_COLORS.Unknown

    };

}

//======================================================
// HIGHLIGHT PARCEL
//======================================================

function highlightParcel(layer){

    layer.setStyle({

        weight:4,

        color:"#FFD54F",

        fillOpacity:0.95

    });

    layer.bringToFront();

}

//======================================================
// RESET PARCEL STYLE
//======================================================

function resetParcel(layer){

    if(parcelLayer){

        parcelLayer.resetStyle(layer);

    }

}
//======================================================
// SELECT PARCEL
//======================================================

function selectParcel(layer){

    if(selectedLayer){

        resetParcel(selectedLayer);

    }

    selectedLayer = layer;

    highlightParcel(layer);

    const feature = layer.feature;

    if(typeof showParcelDashboard==="function"){

        showParcelDashboard(feature);

    }

    if(typeof updateParcelInformation==="function"){

        updateParcelInformation(feature);

    }

    if(typeof highlightParcelRow==="function"){

        highlightParcelRow(feature.properties.Parcel_ID);

    }

    layer.openPopup();

}
//======================================================
// EVENTS FOR EACH PARCEL
//======================================================

function onEachParcel(feature, layer){

    layer.bindPopup(

        createParcelPopup(feature)

    );

    layer.on({

        mouseover:()=>{

            if(selectedLayer!==layer){

                highlightParcel(layer);

            }

        },

        mouseout:()=>{

            if(selectedLayer!==layer){

                resetParcel(layer);

            }

        },

        click:()=>{

            selectParcel(layer);

        }

    });

}

//======================================================
// CREATE PARCEL POPUP
//======================================================

function createParcelPopup(feature){

    const p = feature.properties;

    return `

        <div style="min-width:230px;line-height:1.6;">

            <h3 style="margin-bottom:8px;color:#2E7D32;">

                Parcel ${p.Parcel_ID}

            </h3>

            <table style="width:100%;font-size:13px;">

                <tr>

                    <td><strong>Grower</strong></td>

                    <td>${p.Grower_ID}</td>

                </tr>

                <tr>

                    <td><strong>Variety</strong></td>

                    <td>${p.Variety}</td>

                </tr>

                <tr>

                    <td><strong>Status</strong></td>

                    <td>${p.Status}</td>

                </tr>

                <tr>

                    <td><strong>Area</strong></td>

                    <td>${Number(p.Area_Ha).toFixed(2)} Ha</td>

                </tr>

                <tr>

                    <td><strong>Crop Age</strong></td>

                    <td>${Number(p.Crop_Age || 0).toFixed(1)} Months</td>

                </tr>

                <tr>

                    <td><strong>Yield</strong></td>

                    <td>${Number(p.Estimated_Tonnage || 0).toFixed(2)} T</td>

                </tr>

            </table>

        </div>

    `;

}

//======================================================
// MAP LEGEND
//======================================================

function addLegend(){

    if(legend){

        map.removeControl(legend);

    }

    legend=L.control({

        position:"bottomright"

    });

    legend.onAdd=function(){

        const div=L.DomUtil.create("div","legend");

        const rows = Object.keys(STATUS_COLORS)

            .filter(status => status !== "Unknown")

            .map(status =>

                `<div><span style="background:${STATUS_COLORS[status]}"></span> ${status}</div>`

            )

            .join("");

        div.innerHTML = `<h4>Sugarcane Status</h4>${rows}`;

        return div;

    };

    legend.addTo(map);

}

//======================================================
// TOOLBAR
//======================================================
//======================================================
// TOOLBAR
//======================================================

function initializeToolbar(){

    connectButton(["homeMap","sidebarHome"], homeMap);

    connectButton(["resetMap","sidebarReset"], resetMap);

    connectButton(["fullscreenMap","sidebarFullscreen"], toggleFullscreen);

    connectButton(["printMap","sidebarPrint"], printMap);

    connectButton(["exportMap","sidebarExport"], exportMap);

}
//======================================================
// CONNECT BUTTONS
//======================================================

function connectButton(ids, action){

    ids.forEach(id=>{

        const btn=document.getElementById(id);

        if(btn){

            btn.onclick=action;

        }

    });

}

//======================================================
// FULLSCREEN
//======================================================

function toggleFullscreen(){

    const mapDiv=document.getElementById("map");

    if(!document.fullscreenElement){

        mapDiv.requestFullscreen();

    }else{

        document.exitFullscreen();

    }

}

//======================================================
// PRINT
//======================================================

function printMap(){

    window.print();

}

//======================================================
// EXPORT
//======================================================

function exportMap(){

    const blob=new Blob(

        [JSON.stringify(window.parcelData,null,2)],

        {type:"application/json"}

    );

    const url=URL.createObjectURL(blob);

    const a=document.createElement("a");

    a.href=url;

    a.download="Sugarcane_Parcels.geojson";

    a.click();

    URL.revokeObjectURL(url);

}

//======================================================
// ZOOM TO PARCEL
//======================================================

function zoomToParcel(parcelID){

    if(!parcelLayer) return;

    parcelLayer.eachLayer(layer=>{

        if(

            String(layer.feature.properties.Parcel_ID)===

            String(parcelID)

        ){

            map.fitBounds(

                layer.getBounds(),

                {

                    padding:[60,60]

                }

            );

            selectParcel(layer);

        }

    });

}

//======================================================
// END OF MAP.JS
//======================================================
//======================================================
// CREATE BASE MAPS
//======================================================

function createBaseMaps(){

    streetLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom:19,
            attribution:"© OpenStreetMap"
        }
    );

    satelliteLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
            maxZoom:19,
            attribution:"Tiles © Esri"
        }
    );

    streetLayer.addTo(map);

    layerControl = L.control.layers(
        {
            "Street Map":streetLayer,
            "Satellite":satelliteLayer
        },
        {},
        {
            collapsed:false,
            position:"bottomright"
        }
    );
    layerControl.addTo(map);

}

//======================================================
// TOGGLE BASEMAP
//======================================================

function toggleBaseMap(){

    if(map.hasLayer(streetLayer)){

        map.removeLayer(streetLayer);

        satelliteLayer.addTo(map);

    }
    else{

        map.removeLayer(satelliteLayer);

        streetLayer.addTo(map);

    }

}

//======================================================
// HOME
//======================================================

function homeMap(){

    if(!parcelLayer) return;

    map.fitBounds(

        parcelLayer.getBounds(),

        {

            padding:[40,40]

        }

    );

}

//======================================================
// RESET MAP
//======================================================

function resetMap(){

    if(selectedLayer){

        resetParcel(selectedLayer);

    }

    selectedLayer = null;

    restoreMap();

    if(typeof restoreDashboard==="function"){

        restoreDashboard();

    }

}
//======================================================
// KEEP MAP RESPONSIVE
//======================================================

window.addEventListener("resize",function(){

    if(map){

        setTimeout(function(){

            map.invalidateSize();

        },200);

    }

});

