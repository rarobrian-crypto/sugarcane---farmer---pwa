//------------------------------------------------------
// DASHBOARD-OVERVIEW.JS
// Sugarcane GIS Enterprise
//
// Fills the main Dashboard view (below the KPI cards)
// with real, data-driven widgets:
//   - Plantation Overview (4 mini charts)
//   - Season Summary
//   - Harvest Status donut
//   - Recent Activity (live session log)
//   - Top Growers table
//   - Harvest Schedule preview (next 7 days)
//   - Map Quick Actions
//   - Data Shortcuts
//
// Everything here is driven by window.parcelData /
// growerList already loaded by map.js / growers.js -
// nothing on this page is fabricated demo data.
//------------------------------------------------------

//======================================================
// CHART INSTANCES
//======================================================

let dashAreaVarietyChart = null;
let dashProductionVarietyChart = null;
let dashParcelStatusChart = null;
let dashMonthlyTrendChart = null;
let dashHarvestStatusChart = null;

//======================================================
// ACTIVITY LOG (real session events, not fake history)
//======================================================

let dashActivityLog = [];
let dashActivitySeeded = false;

function logActivity(message){

    dashActivityLog.unshift({

        message,

        time:new Date()

    });

    if(dashActivityLog.length > 6){

        dashActivityLog.length = 6;

    }

    renderActivityLog();

}

function formatActivityTime(date){

    return date.toLocaleTimeString([], {

        hour:"2-digit",

        minute:"2-digit"

    });

}

function renderActivityLog(){

    const box = document.getElementById("dashActivityList");

    if(!box) return;

    if(!dashActivityLog.length){

        box.innerHTML = `<p class="dash-empty">No activity yet.</p>`;

        return;

    }

    box.innerHTML = dashActivityLog.map(entry => `

        <p>
            <span>${entry.message}</span>
            <span class="activity-time">${formatActivityTime(entry.time)}</span>
        </p>

    `).join("");

}

window.logActivity = logActivity;

//======================================================
// MASTER REFRESH - called from dashboard.js#refreshDashboard
//======================================================

function renderDashboardOverview(features){

    if(!features) features = [];

    //--------------------------------------------------
    // Each widget renders independently - if one throws,
    // it's logged clearly and the rest still render
    // instead of the whole dashboard going blank.
    //--------------------------------------------------

    const widgets = [

        ["Extra KPIs", () => updateExtraKPIs(features)],

        ["Plantation Charts", () => renderPlantationCharts(features)],

        ["Season Summary", () => renderSeasonSummaryPanel(features)],

        ["Harvest Status Chart", () => renderDashHarvestStatusChart(features)],

        ["Top Growers Table", () => renderTopGrowersTable(features)],

        ["Harvest Preview Table", () => renderHarvestPreviewTable(features)]

    ];

    widgets.forEach(([name, fn]) => {

        try{

            fn();

        }
        catch(err){

            console.error("[Dashboard widget failed: " + name + "]", err);

        }

    });

    if(!dashActivitySeeded && features.length){

        dashActivitySeeded = true;

        logActivity(`Plantation data loaded — ${features.length} parcels`);

    }

}

window.renderDashboardOverview = renderDashboardOverview;

//======================================================
// EXTRA KPI CARDS (Healthy Fields %, Overdue Parcels)
//======================================================

function updateExtraKPIs(features){

    const total = features.length;

    const healthy = features.filter(f =>

        String(f.properties.Status || "").trim() !== "Fallow"

    ).length;

    const overdue = features.filter(f =>

        f.properties.Harvest_Status === "Overdue"

    ).length;

    const healthyPct = total ? Math.round((healthy / total) * 100) : 0;

    const healthyEl = document.getElementById("dashHealthyPct");

    const overdueEl = document.getElementById("dashOverdueCount");

    if(healthyEl) healthyEl.textContent = healthyPct + "%";

    if(overdueEl) overdueEl.textContent = overdue;

}

//======================================================
// GROUP FEATURES BY VARIETY
//======================================================

function groupByVariety(features){

    const groups = {};

    features.forEach(f => {

        const variety = String(f.properties.Variety || "Unspecified").trim();

        if(!groups[variety]){

            groups[variety] = { count:0, area:0, tonnage:0 };

        }

        groups[variety].count++;

        groups[variety].area += Number(f.properties.Area_Ha || 0);

        groups[variety].tonnage += Number(f.properties.Estimated_Tonnage || 0);

    });

    return groups;

}

//======================================================
// PLANTATION OVERVIEW - 4 MINI CHARTS
//======================================================

function renderPlantationCharts(features){

    renderAreaVarietyChart(features);

    renderProductionVarietyChart(features);

    renderParcelStatusChart(features);

    renderMonthlyTrendChart(features);

}

//------------------------------------------------------
// Area by Variety (donut)
//------------------------------------------------------

function renderAreaVarietyChart(features){

    const canvas = document.getElementById("dashAreaVarietyChart");

    if(!canvas) return;

    const groups = groupByVariety(features);

    const labels = Object.keys(groups);

    const values = labels.map(k => Number(groups[k].area.toFixed(2)));

    const total = values.reduce((a,b) => a + b, 0);

    const totalEl = document.getElementById("dashAreaTotal");

    if(totalEl) totalEl.textContent = total.toFixed(1);

    if(dashAreaVarietyChart) dashAreaVarietyChart.destroy();

    dashAreaVarietyChart = new Chart(canvas, {

        type:"doughnut",

        data:{

            labels,

            datasets:[{

                data:values,

                backgroundColor:labels.map((_,i) =>

                    VARIETY_COLORS[i % VARIETY_COLORS.length]

                ),

                borderWidth:2,

                borderColor:"#FFFFFF"

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            cutout:"68%",

            plugins:{

                legend:{

                    position:"bottom",

                    labels:{

                        boxWidth:10,

                        font:{ size:10 },

                        padding:8

                    }

                },

                tooltip:{

                    callbacks:{

                        label:ctx => `${ctx.label}: ${ctx.raw} Ha`

                    }

                }

            }

        }

    });

}

//------------------------------------------------------
// Production Estimate by Variety (bar)
//------------------------------------------------------

function renderProductionVarietyChart(features){

    const canvas = document.getElementById("dashProductionVarietyChart");

    if(!canvas) return;

    const groups = groupByVariety(features);

    const labels = Object.keys(groups);

    const values = labels.map(k => Number(groups[k].tonnage.toFixed(2)));

    if(dashProductionVarietyChart) dashProductionVarietyChart.destroy();

    dashProductionVarietyChart = new Chart(canvas, {

        type:"bar",

        data:{

            labels,

            datasets:[{

                label:"Tonnes",

                data:values,

                backgroundColor:labels.map((_,i) =>

                    VARIETY_COLORS[i % VARIETY_COLORS.length]

                ),

                borderRadius:6,

                maxBarThickness:34

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{

                legend:{ display:false },

                tooltip:{

                    callbacks:{

                        label:ctx => `${ctx.raw} Tonnes`

                    }

                }

            },

            scales:{

                x:{ grid:{ display:false }, ticks:{ font:{ size:10 } } },

                y:{ beginAtZero:true, ticks:{ font:{ size:10 } } }

            }

        }

    });

}

//------------------------------------------------------
// Parcels by Status (donut)
//------------------------------------------------------

function renderParcelStatusChart(features){

    const canvas = document.getElementById("dashParcelStatusChart");

    if(!canvas) return;

    const counts = { Planned:0, Growing:0, Mature:0, Harvested:0, Fallow:0 };

    features.forEach(f => {

        const status = String(f.properties.Status || "Unknown").trim();

        if(counts[status] !== undefined) counts[status]++;

    });

    const labels = Object.keys(counts);

    const values = Object.values(counts);

    if(dashParcelStatusChart) dashParcelStatusChart.destroy();

    dashParcelStatusChart = new Chart(canvas, {

        type:"doughnut",

        data:{

            labels,

            datasets:[{

                data:values,

                backgroundColor:labels.map(s =>

                    STATUS_COLORS[s] || STATUS_COLORS.Unknown

                ),

                borderWidth:2,

                borderColor:"#FFFFFF"

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            cutout:"60%",

            plugins:{

                legend:{

                    position:"bottom",

                    labels:{ boxWidth:10, font:{ size:10 }, padding:8 }

                },

                tooltip:{

                    callbacks:{

                        label:ctx => `${ctx.label}: ${ctx.raw} parcels`

                    }

                }

            }

        }

    });

}

//------------------------------------------------------
// Harvest Trend by Month (line) - derived from real
// Harvest_Due dates, bucketed by month of the year.
//------------------------------------------------------

function renderMonthlyTrendChart(features){

    const canvas = document.getElementById("dashMonthlyTrendChart");

    if(!canvas) return;

    const monthLabels = [

        "Jan","Feb","Mar","Apr","May","Jun",

        "Jul","Aug","Sep","Oct","Nov","Dec"

    ];

    const totals = new Array(12).fill(0);

    features.forEach(f => {

        const due = f.properties.Harvest_Due;

        if(!due) return;

        const d = new Date(due);

        if(isNaN(d)) return;

        totals[d.getMonth()] += Number(f.properties.Estimated_Tonnage || 0);

    });

    const values = totals.map(v => Number(v.toFixed(1)));

    if(dashMonthlyTrendChart) dashMonthlyTrendChart.destroy();

    dashMonthlyTrendChart = new Chart(canvas, {

        type:"line",

        data:{

            labels:monthLabels,

            datasets:[{

                label:"Tonnes",

                data:values,

                borderColor:"#2E7D32",

                backgroundColor:"#2E7D3222",

                fill:true,

                tension:.4,

                borderWidth:2,

                pointRadius:2

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{

                legend:{ display:false },

                tooltip:{

                    callbacks:{

                        label:ctx => `${ctx.raw} Tonnes`

                    }

                }

            },

            scales:{

                x:{ grid:{ display:false }, ticks:{ font:{ size:9 } } },

                y:{ beginAtZero:true, ticks:{ font:{ size:9 } } }

            }

        }

    });

}

//======================================================
// SEASON SUMMARY
//======================================================

function renderSeasonSummaryPanel(features){

    let areaPlanted = 0;

    let harvestedArea = 0;

    let prodHarvested = 0;

    const ratoonCycles = new Set();

    features.forEach(f => {

        const p = f.properties;

        const status = String(p.Status || "").trim();

        const area = Number(p.Area_Ha || 0);

        if(status !== "Fallow"){

            areaPlanted += area;

        }

        if(status === "Harvested"){

            harvestedArea += area;

            prodHarvested += Number(p.Estimated_Tonnage || 0);

        }

        if(p.Ratoon_Cycle !== null && p.Ratoon_Cycle !== undefined && p.Ratoon_Cycle !== ""){

            ratoonCycles.add(String(p.Ratoon_Cycle));

        }

    });

    const avgYield = harvestedArea ? (prodHarvested / harvestedArea) : 0;

    setText("seasonAreaPlanted", areaPlanted.toFixed(2) + " Ha");

    setText("seasonHarvestedArea", harvestedArea.toFixed(2) + " Ha");

    setText("seasonProdHarvested", prodHarvested.toFixed(1) + " T");

    setText("seasonAvgYield", avgYield.toFixed(2) + " T/Ha");

    setText("seasonRatoonCycles", ratoonCycles.size);

}

function setText(id, value){

    const el = document.getElementById(id);

    if(el) el.textContent = value;

}

//======================================================
// HARVEST STATUS CHART (based on real Harvest_Status field)
//======================================================

function renderDashHarvestStatusChart(features){

    const canvas = document.getElementById("dashHarvestStatusChart");

    if(!canvas) return;

    const counts = {

        "Scheduled":0,

        "Due Soon":0,

        "Overdue":0,

        "Not Scheduled":0

    };

    features.forEach(f => {

        const hs = f.properties.Harvest_Status;

        if(hs === "Scheduled") counts["Scheduled"]++;

        else if(hs === "Due Soon") counts["Due Soon"]++;

        else if(hs === "Overdue") counts["Overdue"]++;

        else counts["Not Scheduled"]++;

    });

    const labels = Object.keys(counts);

    const values = Object.values(counts);

    const colors = {

        "Scheduled":"#1976D2",

        "Due Soon":"#FB8C00",

        "Overdue":"#E53935",

        "Not Scheduled":"#9E9E9E"

    };

    if(dashHarvestStatusChart) dashHarvestStatusChart.destroy();

    dashHarvestStatusChart = new Chart(canvas, {

        type:"doughnut",

        data:{

            labels,

            datasets:[{

                data:values,

                backgroundColor:labels.map(l => colors[l]),

                borderWidth:2,

                borderColor:"#FFFFFF"

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            cutout:"65%",

            plugins:{

                legend:{

                    position:"bottom",

                    labels:{ usePointStyle:true, boxWidth:10, font:{ size:11 }, padding:10 }

                },

                tooltip:{

                    callbacks:{

                        label:ctx => `${ctx.label}: ${ctx.raw} parcels`

                    }

                }

            }

        }

    });

}

//======================================================
// TOP GROWERS (BY AREA)
//======================================================

function renderTopGrowersTable(features){

    const body = document.getElementById("dashTopGrowersBody");

    if(!body) return;

    if(typeof growerList === "undefined" || !growerList.length){

        body.innerHTML = `<tr><td colspan="3">No growers loaded yet.</td></tr>`;

        return;

    }

    const rows = growerList.map(grower => {

        const theirParcels = features.filter(f =>

            String(f.properties.Grower_ID) === String(grower.grower_id)

        );

        const area = theirParcels.reduce(

            (sum, f) => sum + Number(f.properties.Area_Ha || 0), 0

        );

        return {

            name:grower.grower_name,

            parcels:theirParcels.length,

            area

        };

    })

    .sort((a, b) => b.area - a.area)

    .slice(0, 5);

    if(!rows.length){

        body.innerHTML = `<tr><td colspan="3">No growers loaded yet.</td></tr>`;

        return;

    }

    body.innerHTML = rows.map(r => `

        <tr>
            <td>${r.name}</td>
            <td>${r.parcels}</td>
            <td>${r.area.toFixed(2)}</td>
        </tr>

    `).join("");

}

//======================================================
// HARVEST SCHEDULE PREVIEW (NEXT 7 DAYS + OVERDUE)
//======================================================

function renderHarvestPreviewTable(features){

    const body = document.getElementById("dashHarvestPreviewBody");

    if(!body) return;

    const now = new Date();

    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const due = features.filter(f => {

        const status = f.properties.Harvest_Status;

        if(status === "Overdue") return true;

        if(status !== "Due Soon" || !f.properties.Harvest_Due) return false;

        const d = new Date(f.properties.Harvest_Due);

        return !isNaN(d) && d <= weekAhead;

    })

    .sort((a, b) => {

        const dateA = a.properties.Harvest_Due || "";

        const dateB = b.properties.Harvest_Due || "";

        return dateA.localeCompare(dateB);

    })

    .slice(0, 6);

    if(!due.length){

        body.innerHTML = `<tr><td colspan="6">No parcels currently due for harvest.</td></tr>`;

        return;

    }

    body.innerHTML = due.map(f => {

        const p = f.properties;

        const growerName = (typeof getGrowerById === "function")

            ? (getGrowerById(p.Grower_ID)?.grower_name || p.Grower_ID)

            : p.Grower_ID;

        const badgeClass = (p.Harvest_Status === "Overdue") ? "harvested" : "mature";

        return `

            <tr>
                <td>${p.Parcel_ID}</td>
                <td>${growerName}</td>
                <td>${p.Variety || "-"}</td>
                <td>${p.Harvest_Due || "-"}</td>
                <td><span class="statusBadge ${badgeClass}">${p.Harvest_Status}</span></td>
                <td>${Number(p.Area_Ha || 0).toFixed(2)}</td>
            </tr>

        `;

    }).join("");

}

//======================================================
// BUTTON WIRING - Map Quick Actions / Data Shortcuts
//======================================================

document.addEventListener("DOMContentLoaded", () => {

    //----------------------------------------------------
    // Map Quick Actions
    //----------------------------------------------------

    document.getElementById("dashQaAddParcel")?.addEventListener("click", () => {

        if(typeof goToMapView === "function") goToMapView();

        if(typeof startDrawing === "function"){

            setTimeout(() => startDrawing(), 160);

        }

    });

    document.getElementById("dashQaMeasure")?.addEventListener("click", () => {

        if(typeof goToMapView === "function") goToMapView();

        if(typeof startDrawing === "function"){

            setTimeout(() => startDrawing(), 160);

        }

    });

    document.getElementById("dashQaFindParcel")?.addEventListener("click", () => {

        const input = document.getElementById("parcelSearch");

        input?.scrollIntoView({ behavior:"smooth", block:"center" });

        input?.focus();

    });

    document.getElementById("dashQaPrintMap")?.addEventListener("click", () => {

        if(typeof goToMapView === "function") goToMapView();

        setTimeout(() => {

            if(typeof printMap === "function") printMap();

        }, 200);

    });

    //----------------------------------------------------
    // Data Shortcuts
    //----------------------------------------------------

    function goToSection(targetId){

        if(typeof switchView === "function") switchView(targetId);

        if(typeof activateNavLink === "function") activateNavLink(targetId);

    }

    document.getElementById("dashScParcelRegister")?.addEventListener("click", () => {

        goToSection("registerSection");

    });

    document.getElementById("dashScGrowers")?.addEventListener("click", () => {

        goToSection("growersSection");

    });

    document.getElementById("dashScProduction")?.addEventListener("click", () => {

        goToSection("productionSection");

    });

    document.getElementById("dashScReports")?.addEventListener("click", () => {

        goToSection("reportsSection");

    });

    //----------------------------------------------------
    // "View All" buttons on the dashboard mini-cards
    //----------------------------------------------------

    document.getElementById("dashViewAllGrowersBtn")?.addEventListener("click", () => {

        goToSection("growersSection");

    });

    document.getElementById("dashViewFullHarvestBtn")?.addEventListener("click", () => {

        goToSection("harvestSection");

    });

});
