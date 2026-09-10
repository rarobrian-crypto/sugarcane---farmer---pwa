//------------------------------------------------------
// CHARTS.JS
// Sugarcane GIS Enterprise v6.0
//------------------------------------------------------

//======================================================
// GLOBAL CHART OBJECTS
//======================================================

let harvestChart = null;
let varietyChart = null;

let growersSpark = null;
let parcelsSpark = null;
let hectaresSpark = null;
let yieldSpark = null;

//======================================================
// DEFAULT CHART COLORS
//======================================================

const VARIETY_COLORS = [

    "#2E7D32",
    "#43A047",
    "#66BB6A",
    "#81C784",
    "#A5D6A7",
    "#C8E6C9",
    "#1B5E20",
    "#388E3C"

];

//======================================================
// UPDATE ALL CHARTS
//======================================================

function updateCharts(features){

    if(!features || features.length === 0){

        if(harvestChart) harvestChart.destroy();

        if(varietyChart) varietyChart.destroy();

        return;

    }

    buildHarvestChart(features);

    buildVarietyChart(features);

}

//======================================================
// HARVEST STATUS
//======================================================

function buildHarvestChart(features){

    const counts={

        Planned:0,

        Growing:0,

        Mature:0,

        Harvested:0,

        Fallow:0

    };

    features.forEach(feature=>{

        const status=String(

            feature.properties.Status || "Unknown"

        ).trim();

        if(counts[status]!==undefined){

            counts[status]++;

        }

    });

    const canvas=document.getElementById("statusChart");

    if(!canvas) return;

    if(harvestChart){

        harvestChart.destroy();

    }

    harvestChart=new Chart(canvas,{

        type:"doughnut",

        data:{

            labels:Object.keys(counts),

            datasets:[{

                data:Object.values(counts),

                // Look each color up by its own status key rather than
                // relying on array order - STATUS_COLORS and `counts`
                // don't necessarily list statuses in the same order.
                backgroundColor:Object.keys(counts).map(
                    status => STATUS_COLORS[status] || STATUS_COLORS.Unknown
                ),

                borderWidth:2,

                borderColor:"#FFFFFF",

                hoverOffset:8

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            cutout:"65%",

            animation:{

                animateRotate:true,

                animateScale:true

            },

            plugins:{

                legend:{

                    position:"bottom",

                    labels:{

                        usePointStyle:true,

                        pointStyle:"circle",

                        padding:18,

                        boxWidth:12,

                        color:"#37474F",

                        font:{

                            size:12,

                            weight:"600"

                        }

                    }

                },

                tooltip:{

                    callbacks:{

                        label:function(context){

                            return context.label +

                            ": " +

                            context.raw +

                            " parcels";

                        }

                    }

                }

            }

        }

    });

}

//======================================================
// VARIETY DISTRIBUTION
//======================================================

function buildVarietyChart(features){

    const counts={};

    features.forEach(feature=>{

        const variety=

            String(

                feature.properties.Variety ||

                "Unknown"

            ).trim();

        counts[variety]=(counts[variety]||0)+1;

    });

    const labels=Object.keys(counts);

    const values=Object.values(counts);

    const canvas=document.getElementById("varietyChart");

    if(!canvas) return;

    if(varietyChart){

        varietyChart.destroy();

    }

    varietyChart=new Chart(canvas,{

        type:"bar",

        data:{

            labels:labels,

            datasets:[{

                label:"Number of Parcels",

                data:values,

                backgroundColor:

                    labels.map((_,i)=>

                        VARIETY_COLORS[

                            i % VARIETY_COLORS.length

                        ]

                    ),

                borderRadius:8,

                borderSkipped:false,

                maxBarThickness:45

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            animation:{

                duration:900

            },

            plugins:{

                legend:{

                    display:false

                },

                tooltip:{

                    callbacks:{

                        label:function(context){

                            return context.raw +

                            " parcels";

                        }

                    }

                }

            },

            scales:{

                x:{

                    grid:{

                        display:false

                    },

                    ticks:{

                        color:"#455A64",

                        font:{

                            weight:"600"

                        }

                    }

                },

                y:{

                    beginAtZero:true,

                    ticks:{

                        precision:0,

                        color:"#455A64"

                    },

                    grid:{

                        color:"#ECEFF1"

                    }

                }

            }

        }

    });

}
//======================================================
// KPI SPARKLINES
//======================================================

function buildSparklines(){

    // Reserved for future sparkline implementation.

    // KPI values are now controlled entirely
    // by dashboard.js.

}
//======================================================
// CREATE SINGLE SPARKLINE
//======================================================

function createSparkline(

    chart,

    canvasId,

    values,

    color

){

    const canvas =

        document.getElementById(canvasId);

    if(!canvas) return null;

    if(chart){

        chart.destroy();

    }

    return new Chart(canvas,{

        type:"line",

        data:{

            labels:["","","","",""],

            datasets:[{

                data:values,

                borderColor:color,

                backgroundColor:color + "22",

                fill:true,

                tension:.45,

                borderWidth:3,

                pointRadius:0

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{

                legend:{

                    display:false

                },

                tooltip:{

                    enabled:false

                }

            },

            scales:{

                x:{

                    display:false

                },

                y:{

                    display:false

                }

            },

            elements:{

                line:{

                    borderJoinStyle:"round"

                }

            }

        }

    });

}

//======================================================
// REFRESH CHARTS
//======================================================

function refreshCharts(features){

    updateCharts(features);

}

//======================================================
// RESTORE CHARTS
//======================================================

function restoreCharts(){

    if(

        window.parcelData &&

        window.parcelData.features

    ){

        updateCharts(

            window.parcelData.features

        );

    }

}

//======================================================
// GET LARGEST VARIETY
//======================================================

function getLargestVariety(features){

    const counts={};

    features.forEach(feature=>{

        const variety=String(

            feature.properties.Variety ||

            "Unknown"

        ).trim();

        counts[variety]=(counts[variety]||0)+1;

    });

    let largest="-";

    let highest=0;

    Object.keys(counts).forEach(name=>{

        if(counts[name]>highest){

            highest=counts[name];

            largest=name;

        }

    });

    return{

        name:largest,

        count:highest

    };

}

//======================================================
// EXPORTS
//======================================================

window.updateCharts = updateCharts;

window.refreshCharts = refreshCharts;

window.restoreCharts = restoreCharts;

window.getLargestVariety = getLargestVariety;