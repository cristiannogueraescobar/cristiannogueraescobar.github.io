/* f7b-model-grids.js — the 12 reserved F7b model grids (source of truth for re-solving).
 * Phase 1 reserved tranche; NOT live in the catalogue. Objectives are re-derived by the real engine.
 */
'use strict';
const GRIDS = [
  {
    "key": "assembly-line-mix",
    "sense": "max",
    "whole": false,
    "grid": [
      [
        "Product",
        "Units",
        "Term",
        "",
        ""
      ],
      [
        "Standard",
        "0",
        "",
        "",
        ""
      ],
      [
        "Premium",
        "0",
        "",
        "",
        ""
      ],
      [
        "",
        "",
        "",
        "",
        ""
      ],
      [
        "Total profit (GBP)",
        "",
        "=40*B2+60*B3",
        "",
        ""
      ],
      [
        "Machine hours",
        "",
        "=2*B2+4*B3",
        "<=",
        "100"
      ],
      [
        "Assembly hours",
        "",
        "=3*B2+2*B3",
        "<=",
        "90"
      ]
    ]
  },
  {
    "key": "machine-shop-jobs",
    "sense": "max",
    "whole": true,
    "grid": [
      [
        "Job",
        "Runs",
        "Term",
        "",
        ""
      ],
      [
        "Brackets",
        "0",
        "",
        "",
        ""
      ],
      [
        "Flanges",
        "0",
        "",
        "",
        ""
      ],
      [
        "Housings",
        "0",
        "",
        "",
        ""
      ],
      [
        "",
        "",
        "",
        "",
        ""
      ],
      [
        "Total contribution (GBP)",
        "",
        "=70*B2+55*B3+95*B4",
        "",
        ""
      ],
      [
        "Lathe hours",
        "",
        "=2*B2+1*B3+3*B4",
        "<=",
        "40"
      ],
      [
        "Mill hours",
        "",
        "=1*B2+2*B3+2*B4",
        "<=",
        "36"
      ],
      [
        "Max housing runs",
        "",
        "=B4",
        "<=",
        "6"
      ]
    ]
  },
  {
    "key": "warehouse-dispatch",
    "sense": "min",
    "whole": false,
    "grid": [
      [
        "Route",
        "Loads",
        "Term",
        "",
        ""
      ],
      [
        "DepotA",
        "0",
        "",
        "",
        ""
      ],
      [
        "DepotB",
        "0",
        "",
        "",
        ""
      ],
      [
        "",
        "",
        "",
        "",
        ""
      ],
      [
        "Total cost (GBP)",
        "",
        "=18*B2+25*B3",
        "",
        ""
      ],
      [
        "Demand covered",
        "",
        "=B2+B3",
        ">=",
        "120"
      ],
      [
        "DepotA capacity",
        "",
        "=B2",
        "<=",
        "80"
      ],
      [
        "DepotB capacity",
        "",
        "=B3",
        "<=",
        "90"
      ]
    ]
  },
  {
    "key": "container-loading",
    "sense": "max",
    "whole": true,
    "grid": [
      [
        "Pallet type",
        "Count",
        "Term",
        "",
        ""
      ],
      [
        "Light",
        "0",
        "",
        "",
        ""
      ],
      [
        "Heavy",
        "0",
        "",
        "",
        ""
      ],
      [
        "",
        "",
        "",
        "",
        ""
      ],
      [
        "Total value (GBP)",
        "",
        "=120*B2+200*B3",
        "",
        ""
      ],
      [
        "Weight (kg)",
        "",
        "=150*B2+400*B3",
        "<=",
        "6000"
      ],
      [
        "Floor slots",
        "",
        "=B2+B3",
        "<=",
        "28"
      ]
    ]
  },
  {
    "key": "budget-allocation",
    "sense": "max",
    "whole": false,
    "grid": [
      [
        "Channel",
        "Spend (k)",
        "Term",
        "",
        ""
      ],
      [
        "Search",
        "0",
        "",
        "",
        ""
      ],
      [
        "Social",
        "0",
        "",
        "",
        ""
      ],
      [
        "",
        "",
        "",
        "",
        ""
      ],
      [
        "Total reach (k)",
        "",
        "=8*B2+6*B3",
        "",
        ""
      ],
      [
        "Budget (k)",
        "",
        "=B2+B3",
        "<=",
        "50"
      ],
      [
        "Max search (k)",
        "",
        "=B2",
        "<=",
        "30"
      ],
      [
        "Min social (k)",
        "",
        "=B3",
        ">=",
        "10"
      ]
    ]
  },
  {
    "key": "raw-material-buy",
    "sense": "min",
    "whole": false,
    "grid": [
      [
        "Supplier",
        "Tonnes",
        "Term",
        "",
        ""
      ],
      [
        "SupplierX",
        "0",
        "",
        "",
        ""
      ],
      [
        "SupplierY",
        "0",
        "",
        "",
        ""
      ],
      [
        "",
        "",
        "",
        "",
        ""
      ],
      [
        "Total cost (GBP)",
        "",
        "=210*B2+190*B3",
        "",
        ""
      ],
      [
        "Tonnes required",
        "",
        "=B2+B3",
        ">=",
        "100"
      ],
      [
        "SupplierX limit",
        "",
        "=B2",
        "<=",
        "70"
      ],
      [
        "SupplierY limit",
        "",
        "=B3",
        "<=",
        "60"
      ]
    ]
  },
  {
    "key": "shift-coverage",
    "sense": "min",
    "whole": true,
    "grid": [
      [
        "Shift crew",
        "Staff",
        "Term",
        "",
        ""
      ],
      [
        "Day",
        "0",
        "",
        "",
        ""
      ],
      [
        "Evening",
        "0",
        "",
        "",
        ""
      ],
      [
        "",
        "",
        "",
        "",
        ""
      ],
      [
        "Total wage cost (GBP)",
        "",
        "=120*B2+150*B3",
        "",
        ""
      ],
      [
        "Day cover",
        "",
        "=B2",
        ">=",
        "5"
      ],
      [
        "Evening cover",
        "",
        "=B3",
        ">=",
        "4"
      ],
      [
        "Total headcount",
        "",
        "=B2+B3",
        ">=",
        "12"
      ]
    ]
  },
  {
    "key": "feed-blend",
    "sense": "min",
    "whole": false,
    "grid": [
      [
        "Ingredient",
        "kg",
        "Term",
        "",
        ""
      ],
      [
        "Grain",
        "0",
        "",
        "",
        ""
      ],
      [
        "Soy",
        "0",
        "",
        "",
        ""
      ],
      [
        "",
        "",
        "",
        "",
        ""
      ],
      [
        "Total cost (GBP)",
        "",
        "=3*B2+5*B3",
        "",
        ""
      ],
      [
        "Batch mass (kg)",
        "",
        "=B2+B3",
        ">=",
        "100"
      ],
      [
        "Protein units",
        "",
        "=1*B2+4*B3",
        ">=",
        "180"
      ],
      [
        "Max grain (kg)",
        "",
        "=B2",
        "<=",
        "80"
      ]
    ]
  },
  {
    "key": "tutoring-hours",
    "sense": "max",
    "whole": false,
    "grid": [
      [
        "Programme",
        "Hours",
        "Term",
        "",
        ""
      ],
      [
        "Maths",
        "0",
        "",
        "",
        ""
      ],
      [
        "Reading",
        "0",
        "",
        "",
        ""
      ],
      [
        "",
        "",
        "",
        "",
        ""
      ],
      [
        "Students helped",
        "",
        "=3*B2+2*B3",
        "",
        ""
      ],
      [
        "Tutor hours",
        "",
        "=B2+B3",
        "<=",
        "60"
      ],
      [
        "Room hours",
        "",
        "=2*B2+1*B3",
        "<=",
        "90"
      ],
      [
        "Min reading hours",
        "",
        "=B3",
        ">=",
        "15"
      ]
    ]
  },
  {
    "key": "battery-dispatch",
    "sense": "max",
    "whole": false,
    "grid": [
      [
        "Source",
        "MWh",
        "Term",
        "",
        ""
      ],
      [
        "Solar",
        "0",
        "",
        "",
        ""
      ],
      [
        "Battery",
        "0",
        "",
        "",
        ""
      ],
      [
        "",
        "",
        "",
        "",
        ""
      ],
      [
        "Total revenue (GBP)",
        "",
        "=50*B2+65*B3",
        "",
        ""
      ],
      [
        "Grid limit (MWh)",
        "",
        "=B2+B3",
        "<=",
        "200"
      ],
      [
        "Solar available",
        "",
        "=B2",
        "<=",
        "140"
      ],
      [
        "Battery throughput",
        "",
        "=B3",
        "<=",
        "90"
      ]
    ]
  },
  {
    "key": "menu-planning",
    "sense": "max",
    "whole": false,
    "grid": [
      [
        "Dish",
        "Portions",
        "Term",
        "",
        ""
      ],
      [
        "Pasta",
        "0",
        "",
        "",
        ""
      ],
      [
        "Salad",
        "0",
        "",
        "",
        ""
      ],
      [
        "",
        "",
        "",
        "",
        ""
      ],
      [
        "Total margin (GBP)",
        "",
        "=7*B2+5*B3",
        "",
        ""
      ],
      [
        "Prep minutes",
        "",
        "=6*B2+4*B3",
        "<=",
        "600"
      ],
      [
        "Fresh stock",
        "",
        "=2*B2+3*B3",
        "<=",
        "300"
      ]
    ]
  },
  {
    "key": "retail-shelf-space",
    "sense": "max",
    "whole": true,
    "grid": [
      [
        "Product line",
        "Facings",
        "Term",
        "",
        ""
      ],
      [
        "Snacks",
        "0",
        "",
        "",
        ""
      ],
      [
        "Drinks",
        "0",
        "",
        "",
        ""
      ],
      [
        "",
        "",
        "",
        "",
        ""
      ],
      [
        "Weekly profit (GBP)",
        "",
        "=15*B2+22*B3",
        "",
        ""
      ],
      [
        "Shelf facings",
        "",
        "=B2+B3",
        "<=",
        "30"
      ],
      [
        "Chiller facings",
        "",
        "=B3",
        "<=",
        "12"
      ],
      [
        "Min snack facings",
        "",
        "=B2",
        ">=",
        "6"
      ]
    ]
  }
];

module.exports = { GRIDS };
