//------------------------------------------------------
// SECTIONS.JS
// Renders the Growers / Production / Harvest sidebar
// pages from data already loaded by map.js / growers.js.
//------------------------------------------------------

function renderExtraSections(features){

    renderGrowersTable(features);

    renderProductionTable(features);

    renderHarvestTable(features);

    renderProductionAnalytics(features);

    renderHarvestManagementPage(features);

}

//======================================================
// GROWERS DIRECTORY
//======================================================

function renderGrowersTable(features){

    const body = document.getElementById("growersTableBody");

    if(!body) return;

    if(typeof growerList === "undefined" || !growerList.length){

        body.innerHTML = `<tr><td colspan="6">No growers loaded yet.</td></tr>`;

        return;

    }

    body.innerHTML = growerList.map(grower => {

        const theirParcels = features.filter(f =>
            String(f.properties.Grower_ID) === String(grower.grower_id)
        );

        const totalArea = theirParcels.reduce(
            (sum, f) => sum + Number(f.properties.Area_Ha || 0), 0
        );

        const totalProduction = theirParcels.reduce(
            (sum, f) => sum + Number(f.properties.Estimated_Tonnage || 0), 0
        );

        return `

            <tr>
                <td>${grower.grower_id}</td>
                <td>${grower.grower_name}</td>
                <td>${grower.phone || "-"}</td>
                <td>${grower.village || "-"}</td>
                <td>${theirParcels.length}</td>
                <td>${totalArea.toFixed(2)}</td>
                <td>${totalProduction.toFixed(2)}</td>
            </tr>

        `;

    }).join("");

}

//======================================================
// PRODUCTION OVERVIEW (BY VARIETY)
//======================================================

function renderProductionTable(features){

    const body = document.getElementById("productionTableBody");

    if(!body) return;

    const groups = {};

    features.forEach(f => {

        const variety = f.properties.Variety || "Unspecified";

        if(!groups[variety]){

            groups[variety] = { count:0, area:0, tonnage:0 };

        }

        groups[variety].count++;
        groups[variety].area += Number(f.properties.Area_Ha || 0);
        groups[variety].tonnage += Number(f.properties.Estimated_Tonnage || 0);

    });

    const varieties = Object.keys(groups).sort();

    if(!varieties.length){

        body.innerHTML = `<tr><td colspan="4">No parcels loaded yet.</td></tr>`;

        return;

    }

    body.innerHTML = varieties.map(variety => {

        const g = groups[variety];

        return `

            <tr>
                <td>${variety}</td>
                <td>${g.count}</td>
                <td>${g.area.toFixed(2)}</td>
                <td>${g.tonnage.toFixed(2)}</td>
            </tr>

        `;

    }).join("");

}

//======================================================
// HARVEST SCHEDULE (MATURE / DUE SOON / OVERDUE)
//======================================================

function renderHarvestTable(features){

    const body = document.getElementById("harvestTableBody");

    if(!body) return;

    const due = features

        .filter(f =>
            f.properties.Harvest_Status === "Due Soon" ||
            f.properties.Harvest_Status === "Overdue"
        )

        .sort((a, b) => {

            const dateA = a.properties.Harvest_Due || "";
            const dateB = b.properties.Harvest_Due || "";

            return dateA.localeCompare(dateB);

        });

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

window.renderExtraSections = renderExtraSections;

//======================================================
// PRODUCTION / ANALYTICS PAGE - KPI STRIP + CHARTS
//======================================================

let prodAreaVarietyChart = null;
let prodProductionVarietyChart = null;

function renderProductionAnalytics(features){

    //--------------------------------------------------
    // KPI strip
    //--------------------------------------------------

    const totalParcels = features.length;

    const totalHectares = features.reduce(

        (sum, f) => sum + Number(f.properties.Area_Ha || 0), 0

    );

    const totalTonnage = features.reduce(

        (sum, f) => sum + Number(f.properties.Estimated_Tonnage || 0), 0

    );

    const avgYield = totalHectares > 0 ? (totalTonnage / totalHectares) : 0;

    const setKpi = (id, value) => {

        const el = document.getElementById(id);

        if(el) el.textContent = value;

    };

    setKpi("prodKpiParcels", totalParcels.toLocaleString());
    setKpi("prodKpiHectares", totalHectares.toFixed(2));
    setKpi("prodKpiTonnage", totalTonnage.toFixed(1));
    setKpi("prodKpiAvgYield", avgYield.toFixed(2));

    //--------------------------------------------------
    // Group by variety (shared by both charts)
    //--------------------------------------------------

    const groups = {};

    features.forEach(f => {

        const variety = f.properties.Variety || "Unspecified";

        if(!groups[variety]) groups[variety] = { area:0, tonnage:0 };

        groups[variety].area += Number(f.properties.Area_Ha || 0);
        groups[variety].tonnage += Number(f.properties.Estimated_Tonnage || 0);

    });

    const labels = Object.keys(groups).sort();

    //--------------------------------------------------
    // Area by Variety (donut)
    //--------------------------------------------------

    const areaCanvas = document.getElementById("prodAreaVarietyChart");

    if(areaCanvas && typeof Chart !== "undefined"){

        if(prodAreaVarietyChart) prodAreaVarietyChart.destroy();

        prodAreaVarietyChart = new Chart(areaCanvas, {

            type:"doughnut",

            data:{

                labels,

                datasets:[{

                    data:labels.map(k => Number(groups[k].area.toFixed(2))),

                    backgroundColor:labels.map((_, i) =>
                        VARIETY_COLORS[i % VARIETY_COLORS.length]
                    ),

                    borderWidth:2,

                    borderColor:"#FFFFFF"

                }]

            },

            options:{

                responsive:true,

                maintainAspectRatio:false,

                cutout:"65%",

                plugins:{

                    legend:{ position:"bottom", labels:{ boxWidth:10, font:{ size:10 }, padding:8 } },

                    tooltip:{ callbacks:{ label:ctx => `${ctx.label}: ${ctx.raw} Ha` } }

                }

            }

        });

    }

    //--------------------------------------------------
    // Production Estimate by Variety (bar)
    //--------------------------------------------------

    const prodCanvas = document.getElementById("prodProductionVarietyChart");

    if(prodCanvas && typeof Chart !== "undefined"){

        if(prodProductionVarietyChart) prodProductionVarietyChart.destroy();

        prodProductionVarietyChart = new Chart(prodCanvas, {

            type:"bar",

            data:{

                labels,

                datasets:[{

                    data:labels.map(k => Number(groups[k].tonnage.toFixed(2))),

                    backgroundColor:"#2E7D32",

                    borderRadius:4

                }]

            },

            options:{

                responsive:true,

                maintainAspectRatio:false,

                plugins:{ legend:{ display:false } },

                scales:{

                    y:{ beginAtZero:true, ticks:{ font:{ size:10 } } },

                    x:{ ticks:{ font:{ size:10 } } }

                }

            }

        });

    }

}

//======================================================
// HARVEST MANAGEMENT PAGE - KPI STRIP + DONUT
//======================================================

let harvestStatusChartInstance = null;

function renderHarvestManagementPage(features){

    const totalParcels = features.length;

    const harvested = features.filter(f => f.properties.Status === "Harvested");

    const harvestedArea = harvested.reduce(

        (sum, f) => sum + Number(f.properties.Area_Ha || 0), 0

    );

    const harvestedTonnage = harvested.reduce(

        (sum, f) => sum + Number(f.properties.Estimated_Tonnage || 0), 0

    );

    const overdueCount = features.filter(

        f => f.properties.Harvest_Status === "Overdue"

    ).length;

    const progressPct = totalParcels > 0

        ? Math.round((harvested.length / totalParcels) * 100)

        : 0;

    const setKpi = (id, value) => {

        const el = document.getElementById(id);

        if(el) el.textContent = value;

    };

    setKpi("harvestKpiProgress", `${progressPct}%`);
    setKpi("harvestKpiArea", harvestedArea.toFixed(2));
    setKpi("harvestKpiTonnes", harvestedTonnage.toFixed(1));
    setKpi("harvestKpiOverdue", overdueCount.toLocaleString());

    //--------------------------------------------------
    // Harvest Status donut
    //--------------------------------------------------

    const canvas = document.getElementById("harvestStatusChart");

    if(!canvas || typeof Chart === "undefined") return;

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

    const colors = {

        "Scheduled":"#1976D2",
        "Due Soon":"#FB8C00",
        "Overdue":"#E53935",
        "Not Scheduled":"#9E9E9E"

    };

    if(harvestStatusChartInstance) harvestStatusChartInstance.destroy();

    harvestStatusChartInstance = new Chart(canvas, {

        type:"doughnut",

        data:{

            labels,

            datasets:[{

                data:Object.values(counts),

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

                legend:{ position:"bottom", labels:{ usePointStyle:true, boxWidth:10, font:{ size:11 }, padding:10 } },

                tooltip:{ callbacks:{ label:ctx => `${ctx.label}: ${ctx.raw} parcels` } }

            }

        }

    });

}

//======================================================
// GROWERS DIRECTORY - HEADER ACTIONS
//======================================================

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("growersAddBtn")
        ?.addEventListener("click", () => {

            document.getElementById("growerModal")
                .style.display = "block";

        });

    document.getElementById("growersExportBtn")
        ?.addEventListener("click", () => {

            if(typeof growerList === "undefined" || !growerList.length){

                alert("No growers to export yet.");

                return;

            }

            const header = "Grower ID,Name,Phone,Village\n";

            const rows = growerList.map(g =>

                [g.grower_id, g.grower_name, g.phone || "", g.village || ""]
                    .map(v => `"${String(v).replace(/"/g, '""')}"`)
                    .join(",")

            ).join("\n");

            const blob = new Blob([header + rows], { type:"text/csv" });

            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");

            a.href = url;
            a.download = "growers_directory.csv";

            a.click();

            URL.revokeObjectURL(url);

        });

    document.getElementById("growersImportBtn")
        ?.addEventListener("click", () => {

            if(typeof bulkUpload === "function") bulkUpload();

        });

    document.getElementById("growersFilterBtn")
        ?.addEventListener("click", () => {

            if(typeof flashQuickFilters === "function") flashQuickFilters();

        });

    //====================================================
    // PRODUCTION / ANALYTICS PAGE - HEADER ACTIONS
    //====================================================

    document.getElementById("productionExportCsvBtn")
        ?.addEventListener("click", () => {

            exportTableAsCSV("productionTable", "production_by_variety.csv");

        });

    document.getElementById("productionExportXlsxBtn")
        ?.addEventListener("click", () => {

            exportTableAsXLSX("productionTable", "production_by_variety.xlsx", "Production");

        });

    document.getElementById("productionFilterBtn")
        ?.addEventListener("click", () => {

            if(typeof flashQuickFilters === "function") flashQuickFilters();

        });

    //====================================================
    // HARVEST MANAGEMENT PAGE - HEADER ACTIONS
    //====================================================

    document.getElementById("harvestExportCsvBtn")
        ?.addEventListener("click", () => {

            exportTableAsCSV("harvestTable", "harvest_schedule.csv");

        });

    document.getElementById("harvestExportXlsxBtn")
        ?.addEventListener("click", () => {

            exportTableAsXLSX("harvestTable", "harvest_schedule.xlsx", "Harvest");

        });

    document.getElementById("harvestFilterBtn")
        ?.addEventListener("click", () => {

            if(typeof flashQuickFilters === "function") flashQuickFilters();

        });

});
