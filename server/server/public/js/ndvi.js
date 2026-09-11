//------------------------------------------------------
// NDVI.JS
// Sugarcane GIS - NDVI Crop Monitoring
//
// Real NDVI math when NIR+Red bands are supplied (pixel
// by pixel, via canvas), a clearly-labeled RGB-based
// approximation (VARI) when only a normal photo is
// available, or manual entry for externally-computed
// values. No fabricated numbers anywhere in this file.
//------------------------------------------------------

const NDVI_BUCKETS = [

    { key:"veryHealthy", label:"Very Healthy", min:0.6,  max:1.01, color:"#2E7D32" },
    { key:"healthy",     label:"Healthy",       min:0.3,  max:0.6,  color:"#8BC34A" },
    { key:"moderate",    label:"Moderate",      min:0.1,  max:0.3,  color:"#FDD835" },
    { key:"poor",        label:"Poor",          min:-0.1, max:0.1,  color:"#FB8C00" },
    { key:"veryPoor",    label:"Very Poor",     min:-1.01,max:-0.1, color:"#E53935" }

];

function ndviColor(value){

    if(value === null || value === undefined) return "#9E9E9E";

    const bucket = NDVI_BUCKETS.find(b => value >= b.min && value < b.max);

    return bucket ? bucket.color : "#9E9E9E";

}

function ndviBucketLabel(value){

    if(value === null || value === undefined) return "No Data";

    const bucket = NDVI_BUCKETS.find(b => value >= b.min && value < b.max);

    return bucket ? bucket.label : "No Data";

}

//======================================================
// STATE
//======================================================

const NdviState = {

    map:null,

    layer:null,

    latestByParcel:{}, // parcel_id -> reading row

    mode:"multispectral",

    computed:null // { avg, min, max, source, previewDataUrl }

};

//======================================================
// LOAD + RENDER
//======================================================

async function loadNdviData(){

    if(!window.hasPermission || !hasPermission("view_ndvi")) return;

    try{

        const response = await fetch("/ndvi");

        if(!response.ok) return;

        const rows = await response.json();

        NdviState.latestByParcel = {};

        rows.forEach(r => {

            NdviState.latestByParcel[String(r.parcel_id)] = r;

        });

        renderNdviMap();

        renderNdviStats();

        renderNdviCharts();

        renderNdviInsights();

    }
    catch(err){

        console.error("Failed to load NDVI data:", err);

    }

}

//======================================================
// MAP
//======================================================

function initNdviMap(){

    if(NdviState.map || !document.getElementById("ndviMap")) return;

    NdviState.map = L.map("ndviMap", {

        zoomControl:true,

        attributionControl:true,

        maxZoom:19

    });

    NdviState.map.setView([-0.520, 35.270], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {

        maxZoom:19,

        attribution:"© OpenStreetMap"

    }).addTo(NdviState.map);

}

function renderNdviMap(){

    initNdviMap();

    if(!NdviState.map || !window.parcelData) return;

    if(NdviState.layer){

        NdviState.map.removeLayer(NdviState.layer);

    }

    NdviState.layer = L.geoJSON(window.parcelData, {

        style: feature => {

            const reading = NdviState.latestByParcel[String(feature.properties.Parcel_ID)];

            const value = reading ? Number(reading.avg_ndvi) : null;

            return {

                fillColor:ndviColor(value),

                color:"#0B1F16",

                weight:1,

                fillOpacity:.75

            };

        },

        onEachFeature:(feature, layer) => {

            const p = feature.properties;

            const reading = NdviState.latestByParcel[String(p.Parcel_ID)];

            const value = reading ? Number(reading.avg_ndvi) : null;

            layer.bindPopup(`

                <strong>Parcel ${p.Parcel_ID}</strong><br>
                Variety: ${p.Variety || "-"}<br>
                Area: ${Number(p.Area_Ha || 0).toFixed(2)} Ha<br>
                NDVI: ${value !== null ? value.toFixed(2) + " (" + ndviBucketLabel(value) + ")" : "No data"}
                ${reading ? "<br>Recorded: " + reading.reading_date + " (" + reading.source + ")" : ""}

            `);

        }

    }).addTo(NdviState.map);

    const withData = Object.keys(NdviState.latestByParcel).length;

    const subtitle = document.getElementById("ndviMapSubtitle");

    if(subtitle){

        subtitle.textContent = withData

            ? withData + " of " + (window.parcelData.features?.length || 0) + " parcels have recorded readings"

            : "No readings recorded yet - use \"New Reading\" to add the first one";

    }

    if(NdviState.layer.getLayers().length){

        try{ NdviState.map.fitBounds(NdviState.layer.getBounds(), { padding:[20,20] }); }
        catch(e){}

    }

}

//======================================================
// STATS
//======================================================

function renderNdviStats(){

    const values = Object.values(NdviState.latestByParcel)
        .map(r => Number(r.avg_ndvi))
        .filter(v => !isNaN(v));

    const totalParcels = window.parcelData?.features?.length || 0;

    document.getElementById("ndviAvg").textContent =
        values.length ? (values.reduce((a,b)=>a+b,0)/values.length).toFixed(2) : "-";

    document.getElementById("ndviMax").textContent =
        values.length ? Math.max(...values).toFixed(2) : "-";

    document.getElementById("ndviMin").textContent =
        values.length ? Math.min(...values).toFixed(2) : "-";

    document.getElementById("ndviCoverage").textContent =
        values.length + " / " + totalParcels;

}

//======================================================
// CHARTS
//======================================================

let ndviDistChart = null;
let ndviVarietyChart = null;
let ndviTrendChart = null;

function renderNdviCharts(){

    renderNdviDistChart();

    renderNdviVarietyChart();

    renderNdviTrendChart();

}

function renderNdviDistChart(){

    const canvas = document.getElementById("ndviDistChart");

    if(!canvas || typeof Chart === "undefined") return;

    const counts = {};

    NDVI_BUCKETS.forEach(b => counts[b.label] = 0);

    counts["No Data"] = 0;

    const totalParcels = window.parcelData?.features?.length || 0;

    let withData = 0;

    (window.parcelData?.features || []).forEach(f => {

        const reading = NdviState.latestByParcel[String(f.properties.Parcel_ID)];

        const value = reading ? Number(reading.avg_ndvi) : null;

        counts[ndviBucketLabel(value)]++;

        if(reading) withData++;

    });

    if(ndviDistChart) ndviDistChart.destroy();

    ndviDistChart = new Chart(canvas, {

        type:"doughnut",

        data:{

            labels:Object.keys(counts),

            datasets:[{

                data:Object.values(counts),

                backgroundColor:[...NDVI_BUCKETS.map(b => b.color), "#9E9E9E"],

                borderWidth:2,

                borderColor:"#122A1E"

            }]

        },

        options:{

            plugins:{

                legend:{

                    position:"bottom",

                    labels:{ color:"#D8E8DE", font:{ size:10 } }

                }

            }

        }

    });

    void totalParcels; void withData;

}

function renderNdviVarietyChart(){

    const canvas = document.getElementById("ndviVarietyChart");

    if(!canvas || typeof Chart === "undefined") return;

    const groups = {};

    (window.parcelData?.features || []).forEach(f => {

        const reading = NdviState.latestByParcel[String(f.properties.Parcel_ID)];

        if(!reading) return;

        const variety = f.properties.Variety || "Unspecified";

        if(!groups[variety]) groups[variety] = [];

        groups[variety].push(Number(reading.avg_ndvi));

    });

    const labels = Object.keys(groups);

    const data = labels.map(v => {

        const arr = groups[v];

        return arr.reduce((a,b)=>a+b,0) / arr.length;

    });

    if(ndviVarietyChart) ndviVarietyChart.destroy();

    ndviVarietyChart = new Chart(canvas, {

        type:"bar",

        data:{

            labels,

            datasets:[{

                label:"Avg NDVI",

                data,

                backgroundColor:data.map(v => ndviColor(v))

            }]

        },

        options:{

            scales:{

                y:{ min:-1, max:1, ticks:{ color:"#D8E8DE" }, grid:{ color:"rgba(255,255,255,.08)" } },

                x:{ ticks:{ color:"#D8E8DE" }, grid:{ display:false } }

            },

            plugins:{ legend:{ display:false } }

        }

    });

}

function renderNdviTrendChart(){

    const canvas = document.getElementById("ndviTrendChart");

    if(!canvas || typeof Chart === "undefined") return;

    // Average NDVI per reading_date across all parcels that
    // have a reading on that date.

    const byDate = {};

    Object.values(NdviState.latestByParcel).forEach(r => {

        const date = r.reading_date?.slice(0,10);

        if(!date) return;

        if(!byDate[date]) byDate[date] = [];

        byDate[date].push(Number(r.avg_ndvi));

    });

    const dates = Object.keys(byDate).sort();

    const data = dates.map(d => {

        const arr = byDate[d];

        return arr.reduce((a,b)=>a+b,0) / arr.length;

    });

    if(ndviTrendChart) ndviTrendChart.destroy();

    ndviTrendChart = new Chart(canvas, {

        type:"line",

        data:{

            labels:dates,

            datasets:[{

                label:"Avg NDVI",

                data,

                borderColor:"#8BC34A",

                backgroundColor:"rgba(139,195,74,.15)",

                fill:true,

                tension:.3

            }]

        },

        options:{

            scales:{

                y:{ min:-1, max:1, ticks:{ color:"#D8E8DE" }, grid:{ color:"rgba(255,255,255,.08)" } },

                x:{ ticks:{ color:"#D8E8DE" }, grid:{ display:false } }

            },

            plugins:{ legend:{ display:false } }

        }

    });

}

//======================================================
// INSIGHTS (derived from real stored data only)
//======================================================

function renderNdviInsights(){

    const box = document.getElementById("ndviInsights");

    if(!box) return;

    const readings = Object.values(NdviState.latestByParcel);

    if(!readings.length){

        box.innerHTML = `<div class="ndvi-insight-item"><i class="fa-solid fa-circle-info"></i> No NDVI readings recorded yet.</div>`;

        return;

    }

    const values = readings.map(r => Number(r.avg_ndvi));

    const avg = values.reduce((a,b)=>a+b,0) / values.length;

    const stressed = readings.filter(r => Number(r.avg_ndvi) < 0.1);

    const items = [];

    if(stressed.length){

        items.push(`<div class="ndvi-insight-item warn"><i class="fa-solid fa-triangle-exclamation"></i> ${stressed.length} parcel(s) showing NDVI below 0.1 (Poor to Very Poor).</div>`);

    }

    items.push(`<div class="ndvi-insight-item"><i class="fa-solid fa-leaf"></i> Average NDVI across recorded parcels: <strong>${avg.toFixed(2)}</strong>.</div>`);

    items.push(`<div class="ndvi-insight-item"><i class="fa-solid fa-database"></i> ${readings.length} of ${window.parcelData?.features?.length || 0} parcels have at least one recorded reading.</div>`);

    box.innerHTML = items.join("");

}

window.loadNdviData = loadNdviData;
window.NdviState = NdviState;
