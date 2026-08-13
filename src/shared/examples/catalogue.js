/* Canonical example catalogue — the SINGLE editable authority for the
 * built-in examples data.
 *
 * Each record owns its identity, translations, model and expected contract.
 * Consumers (solver EXAMPLES, i18n example keys, examples.html cards + JSON-LD,
 * assets/examples-data.js, Home references) are PROJECTIONS derived from this
 * file at build time; none may re-store a title, description, slug, URL,
 * category, model or expected value.
 *
 * This file contains DATA ONLY: no HTML, no JSON-LD, no generated URLs, no test
 * names, no hashes, no build paths, no timestamps, no functions inside records.
 * Helpers live in the sibling modules (schema.js, serialize.js, projectors.js,
 * index.js).
 *
 * model.fieldOrder belongs to the HISTORICAL serialization contract only: it
 * records the order in which fields were written in the original solver.html
 * EXAMPLES object so the projection can reproduce it byte-for-byte. It is NOT a
 * second definition of the model and MUST NOT be used as a mathematical
 * authority. It may be dropped in a future visible rebaseline, but not in F1.
 *
 * This module is internal source. It is never published to dist and adds no
 * runtime request; it is consumed only during build/composition.
 */

var CATALOGUE = [
  {
    "key": "production",
    "slug": "production-plan",
    "category": "start",
    "type": "continuous",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Production plan",
        "desc": "Maximise profit within available production hours"
      },
      "es": {
        "title": "Plan de producción",
        "desc": "Maximizar el beneficio dentro de un límite de horas"
      },
      "pt": {
        "title": "Plano de produção",
        "desc": "Maximizar o lucro dentro de um limite de horas"
      },
      "de": {
        "title": "Produktionsplan",
        "desc": "Gewinn innerhalb eines Stundenlimits maximieren"
      },
      "fr": {
        "title": "Plan de production",
        "desc": "Maximiser le profit dans une limite d'heures"
      }
    },
    "model": {
      "grid": [
        [
          "Product",
          "Units",
          "Profit",
          "Contribution",
          "Hours",
          ""
        ],
        [
          "A",
          "0",
          "30",
          "=B2*C2",
          "2",
          ""
        ],
        [
          "B",
          "0",
          "20",
          "=B3*C3",
          "1",
          ""
        ],
        [
          "C",
          "0",
          "48",
          "=B4*C4",
          "3",
          ""
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total profit",
          "",
          "",
          "=SUM(D2:D4)",
          "",
          ""
        ],
        [
          "Total hours",
          "",
          "",
          "=SUMPRODUCT(B2:B4,E2:E4)",
          "<=",
          "100"
        ],
        [
          "Units of B",
          "",
          "",
          "=B3",
          "<=",
          "40"
        ]
      ],
      "fieldOrder": [
        "grid",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 1760
    }
  },
  {
    "key": "workshop",
    "slug": "workshop-chart",
    "category": "start",
    "type": "continuous",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Workshop chart",
        "desc": "Two products, shown on a feasible-region chart"
      },
      "es": {
        "title": "Taller con gráfico",
        "desc": "Dos productos, en un gráfico de región factible"
      },
      "pt": {
        "title": "Oficina com gráfico",
        "desc": "Dois produtos, num gráfico de região factível"
      },
      "de": {
        "title": "Werkstatt-Diagramm",
        "desc": "Zwei Produkte, im Diagramm des zulässigen Bereichs"
      },
      "fr": {
        "title": "Atelier avec graphique",
        "desc": "Deux produits, sur un graphique de région réalisable"
      }
    },
    "model": {
      "grid": [
        [
          "Item",
          "Make",
          "Profit",
          "Total",
          "Wood",
          "Labour"
        ],
        [
          "Chairs",
          "0",
          "30",
          "=B2*C2",
          "2",
          "3"
        ],
        [
          "Tables",
          "0",
          "40",
          "=B3*C3",
          "4",
          "2"
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total profit",
          "",
          "",
          "=SUM(D2:D3)",
          "",
          ""
        ],
        [
          "Wood used",
          "",
          "",
          "=SUMPRODUCT(B2:B3,E2:E3)",
          "<=",
          "80"
        ],
        [
          "Labour used",
          "",
          "",
          "=SUMPRODUCT(B2:B3,F2:F3)",
          "<=",
          "60"
        ]
      ],
      "fieldOrder": [
        "grid",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 900
    }
  },
  {
    "key": "blend",
    "slug": "cheapest-feed-blend",
    "category": "start",
    "type": "continuous",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Cheapest feed blend",
        "desc": "Minimise cost while meeting nutrient minimums"
      },
      "es": {
        "title": "Mezcla más barata",
        "desc": "Minimizar el coste cumpliendo mínimos de nutrientes"
      },
      "pt": {
        "title": "Mistura mais barata",
        "desc": "Minimizar o custo cumprindo mínimos de nutrientes"
      },
      "de": {
        "title": "Günstigste Mischung",
        "desc": "Kosten minimieren bei Einhaltung von Nährstoffminima"
      },
      "fr": {
        "title": "Mélange le moins cher",
        "desc": "Minimiser le coût en respectant les minima de nutriments"
      }
    },
    "model": {
      "grid": [
        [
          "Ingredient",
          "Kg",
          "Cost/kg",
          "Spend",
          "Protein%",
          "Fibre%"
        ],
        [
          "Barley",
          "0",
          "0.30",
          "=B2*C2",
          "12",
          "5"
        ],
        [
          "Soybean",
          "0",
          "0.60",
          "=B3*C3",
          "44",
          "7"
        ],
        [
          "Maize",
          "0",
          "0.25",
          "=B4*C4",
          "9",
          "2"
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total cost",
          "",
          "",
          "=SUM(D2:D4)",
          "",
          ""
        ],
        [
          "Total kg",
          "",
          "",
          "=SUM(B2:B4)",
          "<=",
          "100"
        ],
        [
          "Protein",
          "",
          "",
          "=SUMPRODUCT(B2:B4,E2:E4)",
          ">=",
          "1800"
        ],
        [
          "Fibre",
          "",
          "",
          "=SUMPRODUCT(B2:B4,F2:F4)",
          ">=",
          "350"
        ]
      ],
      "fieldOrder": [
        "grid",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 27.352941176470587,
      "tolerance": 1e-8
    }
  },
  {
    "key": "marketing",
    "slug": "marketing-budget",
    "category": "business",
    "type": "continuous",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Marketing budget",
        "desc": "Allocate spend with per-channel minimums and maximums"
      },
      "es": {
        "title": "Presupuesto de marketing",
        "desc": "Repartir el gasto con mínimos y máximos por canal"
      },
      "pt": {
        "title": "Orçamento de marketing",
        "desc": "Distribuir gastos com mínimos e máximos por canal"
      },
      "de": {
        "title": "Marketingbudget",
        "desc": "Ausgaben mit Kanal-Minima und -Maxima verteilen"
      },
      "fr": {
        "title": "Budget marketing",
        "desc": "Répartir les dépenses avec minima et maxima par canal"
      }
    },
    "model": {
      "grid": [
        [
          "Channel",
          "Spend",
          "Return/unit",
          "Return",
          "",
          ""
        ],
        [
          "Search",
          "0",
          "3.2",
          "=B2*C2",
          "",
          ""
        ],
        [
          "Social",
          "0",
          "2.1",
          "=B3*C3",
          "",
          ""
        ],
        [
          "Email",
          "0",
          "5.0",
          "=B4*C4",
          "",
          ""
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total return",
          "",
          "",
          "=SUM(D2:D4)",
          "",
          ""
        ],
        [
          "Total budget",
          "",
          "",
          "=SUM(B2:B4)",
          "<=",
          "6000"
        ]
      ],
      "fieldOrder": [
        "grid",
        "domains",
        "openVarSettings",
        "expected"
      ],
      "domains": {
        "B2": {
          "type": "continuous",
          "min": 0,
          "max": 4000
        },
        "B3": {
          "type": "continuous",
          "min": 500,
          "max": null
        },
        "B4": {
          "type": "continuous",
          "min": 0,
          "max": 1500
        }
      },
      "openVarSettings": true
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 21350
    }
  },
  {
    "key": "workforce",
    "slug": "workforce-scheduling",
    "category": "business",
    "type": "integer",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Workforce scheduling",
        "desc": "Minimise staff while covering daily demand"
      },
      "es": {
        "title": "Planificación de turnos",
        "desc": "Minimizar personal cubriendo la demanda diaria"
      },
      "pt": {
        "title": "Escalonamento de pessoal",
        "desc": "Minimizar pessoal cobrindo a procura diária"
      },
      "de": {
        "title": "Personalplanung",
        "desc": "Personal minimieren bei täglicher Bedarfsdeckung"
      },
      "fr": {
        "title": "Planification du personnel",
        "desc": "Minimiser le personnel en couvrant la demande quotidienne"
      }
    },
    "model": {
      "grid": [
        [
          "Start day",
          "Staff",
          "",
          "",
          ""
        ],
        [
          "Mon",
          "0",
          "",
          "",
          ""
        ],
        [
          "Tue",
          "0",
          "",
          "",
          ""
        ],
        [
          "Wed",
          "0",
          "",
          "",
          ""
        ],
        [
          "Thu",
          "0",
          "",
          "",
          ""
        ],
        [
          "Fri",
          "0",
          "",
          "",
          ""
        ],
        [
          "Sat",
          "0",
          "",
          "",
          ""
        ],
        [
          "Sun",
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
          "Total staff",
          "",
          "=SUM(B2:B8)",
          "",
          ""
        ],
        [
          "Mon cover",
          "",
          "=B2+B5+B6+B7+B8",
          ">=",
          "17"
        ],
        [
          "Tue cover",
          "",
          "=B2+B3+B6+B7+B8",
          ">=",
          "13"
        ],
        [
          "Wed cover",
          "",
          "=B2+B3+B4+B7+B8",
          ">=",
          "15"
        ],
        [
          "Thu cover",
          "",
          "=B2+B3+B4+B5+B8",
          ">=",
          "19"
        ],
        [
          "Fri cover",
          "",
          "=B2+B3+B4+B5+B6",
          ">=",
          "14"
        ],
        [
          "Sat cover",
          "",
          "=B3+B4+B5+B6+B7",
          ">=",
          "16"
        ],
        [
          "Sun cover",
          "",
          "=B4+B5+B6+B7+B8",
          ">=",
          "11"
        ]
      ],
      "fieldOrder": [
        "whole",
        "grid",
        "expected"
      ],
      "whole": true
    },
    "expected": {
      "status": "optimal",
      "modelType": "integer",
      "objective": 23
    }
  },
  {
    "key": "shipping",
    "slug": "shipping-plan",
    "category": "business",
    "type": "integer",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Shipping plan",
        "desc": "Ship from factories to destinations at least cost"
      },
      "es": {
        "title": "Plan de envíos",
        "desc": "Enviar de fábricas a destinos al menor coste"
      },
      "pt": {
        "title": "Plano de envio",
        "desc": "Enviar de fábricas para destinos ao menor custo"
      },
      "de": {
        "title": "Versandplan",
        "desc": "Von Werken zu Zielen zu geringsten Kosten liefern"
      },
      "fr": {
        "title": "Plan d'expédition",
        "desc": "Expédier des usines aux destinations au moindre coût"
      }
    },
    "model": {
      "grid": [
        [
          "Route",
          "Units",
          "Cost/unit",
          "Cost",
          "",
          ""
        ],
        [
          "F1 to A",
          "0",
          "4",
          "=B2*C2",
          "",
          ""
        ],
        [
          "F1 to B",
          "0",
          "6",
          "=B3*C3",
          "",
          ""
        ],
        [
          "F1 to C",
          "0",
          "8",
          "=B4*C4",
          "",
          ""
        ],
        [
          "F2 to A",
          "0",
          "5",
          "=B5*C5",
          "",
          ""
        ],
        [
          "F2 to B",
          "0",
          "3",
          "=B6*C6",
          "",
          ""
        ],
        [
          "F2 to C",
          "0",
          "7",
          "=B7*C7",
          "",
          ""
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total cost",
          "",
          "",
          "=SUM(D2:D7)",
          "",
          ""
        ],
        [
          "F1 supply",
          "",
          "",
          "=B2+B3+B4",
          "<=",
          "50"
        ],
        [
          "F2 supply",
          "",
          "",
          "=B5+B6+B7",
          "<=",
          "50"
        ],
        [
          "A demand",
          "",
          "",
          "=B2+B5",
          ">=",
          "30"
        ],
        [
          "B demand",
          "",
          "",
          "=B3+B6",
          ">=",
          "25"
        ],
        [
          "C demand",
          "",
          "",
          "=B4+B7",
          ">=",
          "35"
        ]
      ],
      "fieldOrder": [
        "whole",
        "grid",
        "expected"
      ],
      "whole": true
    },
    "expected": {
      "status": "optimal",
      "modelType": "integer",
      "objective": 450
    }
  },
  {
    "key": "project",
    "slug": "project-selection",
    "category": "binary",
    "type": "binary",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Project selection",
        "desc": "Pick projects to fund under budget and hours"
      },
      "es": {
        "title": "Selección de proyectos",
        "desc": "Elegir proyectos a financiar con presupuesto y horas"
      },
      "pt": {
        "title": "Seleção de projetos",
        "desc": "Escolher projetos a financiar com orçamento e horas"
      },
      "de": {
        "title": "Projektauswahl",
        "desc": "Projekte unter Budget und Stunden auswählen"
      },
      "fr": {
        "title": "Sélection de projets",
        "desc": "Choisir les projets à financer sous budget et heures"
      }
    },
    "model": {
      "grid": [
        [
          "Project",
          "Fund",
          "Value",
          "Selected",
          "Cost",
          "Hours"
        ],
        [
          "Alpha",
          "0",
          "40",
          "=B2*C2",
          "30",
          "20"
        ],
        [
          "Beta",
          "0",
          "55",
          "=B3*C3",
          "45",
          "35"
        ],
        [
          "Gamma",
          "0",
          "30",
          "=B4*C4",
          "25",
          "15"
        ],
        [
          "Delta",
          "0",
          "50",
          "=B5*C5",
          "40",
          "30"
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total value",
          "",
          "",
          "=SUM(D2:D5)",
          "",
          ""
        ],
        [
          "Budget used",
          "",
          "",
          "=SUMPRODUCT(B2:B5,E2:E5)",
          "<=",
          "100"
        ],
        [
          "Hours used",
          "",
          "",
          "=SUMPRODUCT(B2:B5,F2:F5)",
          "<=",
          "70"
        ]
      ],
      "fieldOrder": [
        "grid",
        "domains",
        "openVarSettings",
        "expected"
      ],
      "domains": {
        "B2": {
          "type": "binary"
        },
        "B3": {
          "type": "binary"
        },
        "B4": {
          "type": "binary"
        },
        "B5": {
          "type": "binary"
        }
      },
      "openVarSettings": true
    },
    "expected": {
      "status": "optimal",
      "modelType": "binary",
      "objective": 125
    }
  },
  {
    "key": "delivery",
    "slug": "delivery-load",
    "category": "binary",
    "type": "binary",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Delivery load",
        "desc": "Choose orders to load by weight and volume"
      },
      "es": {
        "title": "Carga de reparto",
        "desc": "Elegir pedidos a cargar por peso y volumen"
      },
      "pt": {
        "title": "Carga de entrega",
        "desc": "Escolher pedidos a carregar por peso e volume"
      },
      "de": {
        "title": "Lieferladung",
        "desc": "Aufträge nach Gewicht und Volumen auswählen"
      },
      "fr": {
        "title": "Chargement de livraison",
        "desc": "Choisir les commandes à charger par poids et volume"
      }
    },
    "model": {
      "grid": [
        [
          "Order",
          "Load",
          "Profit",
          "Selected",
          "Weight",
          "Volume"
        ],
        [
          "O1",
          "0",
          "60",
          "=B2*C2",
          "10",
          "4"
        ],
        [
          "O2",
          "0",
          "100",
          "=B3*C3",
          "20",
          "5"
        ],
        [
          "O3",
          "0",
          "120",
          "=B4*C4",
          "30",
          "8"
        ],
        [
          "O4",
          "0",
          "80",
          "=B5*C5",
          "15",
          "6"
        ],
        [
          "O5",
          "0",
          "40",
          "=B6*C6",
          "8",
          "3"
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total profit",
          "",
          "",
          "=SUM(D2:D6)",
          "",
          ""
        ],
        [
          "Weight used",
          "",
          "",
          "=SUMPRODUCT(B2:B6,E2:E6)",
          "<=",
          "50"
        ],
        [
          "Volume used",
          "",
          "",
          "=SUMPRODUCT(B2:B6,F2:F6)",
          "<=",
          "16"
        ]
      ],
      "fieldOrder": [
        "grid",
        "domains",
        "openVarSettings",
        "expected"
      ],
      "domains": {
        "B2": {
          "type": "binary"
        },
        "B3": {
          "type": "binary"
        },
        "B4": {
          "type": "binary"
        },
        "B5": {
          "type": "binary"
        },
        "B6": {
          "type": "binary"
        }
      },
      "openVarSettings": true
    },
    "expected": {
      "status": "optimal",
      "modelType": "binary",
      "objective": 240
    }
  },
  {
    "key": "supplier",
    "slug": "supplier-activation",
    "category": "binary",
    "type": "mixed",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Supplier activation",
        "desc": "Activate suppliers and set quantities (mixed integer)"
      },
      "es": {
        "title": "Activación de proveedores",
        "desc": "Activar proveedores y fijar cantidades (entero mixto)"
      },
      "pt": {
        "title": "Ativação de fornecedores",
        "desc": "Ativar fornecedores e definir quantidades (inteiro misto)"
      },
      "de": {
        "title": "Lieferantenauswahl",
        "desc": "Lieferanten aktivieren und Mengen festlegen (gemischt-ganzzahlig)"
      },
      "fr": {
        "title": "Activation de fournisseurs",
        "desc": "Activer des fournisseurs et fixer les quantités (mixte en nombres entiers)"
      }
    },
    "model": {
      "grid": [
        [
          "Decision",
          "Value",
          "Coeff",
          "Term",
          "",
          ""
        ],
        [
          "Use S1",
          "0",
          "200",
          "=B2*C2",
          "",
          ""
        ],
        [
          "Use S2",
          "0",
          "150",
          "=B3*C3",
          "",
          ""
        ],
        [
          "Use S3",
          "0",
          "300",
          "=B4*C4",
          "",
          ""
        ],
        [
          "Qty S1",
          "0",
          "4",
          "=B5*C5",
          "",
          ""
        ],
        [
          "Qty S2",
          "0",
          "6",
          "=B6*C6",
          "",
          ""
        ],
        [
          "Qty S3",
          "0",
          "3",
          "=B7*C7",
          "",
          ""
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total cost",
          "",
          "",
          "=SUM(D2:D7)",
          "",
          ""
        ],
        [
          "Demand",
          "",
          "",
          "=B5+B6+B7",
          ">=",
          "100"
        ],
        [
          "S1 link",
          "",
          "",
          "=B5-60*B2",
          "<=",
          "0"
        ],
        [
          "S2 link",
          "",
          "",
          "=B6-60*B3",
          "<=",
          "0"
        ],
        [
          "S3 link",
          "",
          "",
          "=B7-60*B4",
          "<=",
          "0"
        ]
      ],
      "fieldOrder": [
        "grid",
        "domains",
        "openVarSettings",
        "expected"
      ],
      "domains": {
        "B2": {
          "type": "binary"
        },
        "B3": {
          "type": "binary"
        },
        "B4": {
          "type": "binary"
        },
        "B5": {
          "type": "integer",
          "min": 0,
          "max": 60
        },
        "B6": {
          "type": "integer",
          "min": 0,
          "max": 60
        },
        "B7": {
          "type": "integer",
          "min": 0,
          "max": 60
        }
      },
      "openVarSettings": true
    },
    "expected": {
      "status": "optimal",
      "modelType": "mixed",
      "objective": 830
    }
  },
  {
    "key": "bakery-mix",
    "slug": "bakery-production-mix",
    "category": "start",
    "type": "continuous",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Bakery production mix",
        "desc": "Maximise contribution within flour, labour and oven limits"
      },
      "es": {
        "title": "Mezcla de producción de panadería",
        "desc": "Maximizar la contribución dentro de los límites de harina, mano de obra y horno"
      },
      "pt": {
        "title": "Mix de produção da padaria",
        "desc": "Maximizar a contribuição dentro dos limites de farinha, mão de obra e forno"
      },
      "de": {
        "title": "Produktionsmix Bäckerei",
        "desc": "Deckungsbeitrag innerhalb von Mehl-, Arbeits- und Ofengrenzen maximieren"
      },
      "fr": {
        "title": "Mix de production boulangerie",
        "desc": "Maximiser la contribution dans les limites de farine, main-d'oeuvre et four"
      }
    },
    "model": {
      "grid": [
        [
          "Product",
          "Units",
          "Term",
          "",
          ""
        ],
        [
          "Loaves",
          "0",
          "",
          "",
          ""
        ],
        [
          "Rolls",
          "0",
          "",
          "",
          ""
        ],
        [
          "Pastries",
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
          "=1.80*B2+0.70*B3+1.30*B4",
          "",
          ""
        ],
        [
          "Flour used (kg)",
          "",
          "=0.50*B2+0.12*B3+0.20*B4",
          "<=",
          "120"
        ],
        [
          "Labour used (min)",
          "",
          "=4*B2+2*B3+5*B4",
          "<=",
          "900"
        ],
        [
          "Oven used (min)",
          "",
          "=3*B2+1*B3+2*B4",
          "<=",
          "600"
        ],
        [
          "Max pastries",
          "",
          "=B4",
          "<=",
          "80"
        ]
      ],
      "fieldOrder": [
        "grid",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 375
    }
  },
  {
    "key": "factory-batches",
    "slug": "factory-batch-plan",
    "category": "start",
    "type": "integer",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Factory batch plan",
        "desc": "Schedule whole batches to maximise margin within machine and labour hours"
      },
      "es": {
        "title": "Plan de lotes de fábrica",
        "desc": "Programar lotes enteros para maximizar el margen dentro de las horas de máquina y mano de obra"
      },
      "pt": {
        "title": "Plano de lotes da fábrica",
        "desc": "Programar lotes inteiros para maximizar a margem dentro das horas de máquina e mão de obra"
      },
      "de": {
        "title": "Chargenplan Fabrik",
        "desc": "Ganze Chargen planen, um die Marge innerhalb von Maschinen- und Arbeitsstunden zu maximieren"
      },
      "fr": {
        "title": "Plan de lots d'usine",
        "desc": "Planifier des lots entiers pour maximiser la marge dans les heures machine et main-d'oeuvre"
      }
    },
    "model": {
      "grid": [
        [
          "Product",
          "Batches",
          "Term",
          "",
          ""
        ],
        [
          "Widgets",
          "0",
          "",
          "",
          ""
        ],
        [
          "Gadgets",
          "0",
          "",
          "",
          ""
        ],
        [
          "Gizmos",
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
          "=120*B2+90*B3+150*B4",
          "",
          ""
        ],
        [
          "Machine hours",
          "",
          "=3*B2+2*B3+4*B4",
          "<=",
          "60"
        ],
        [
          "Labour hours",
          "",
          "=2*B2+2*B3+3*B4",
          "<=",
          "44"
        ],
        [
          "Max widget batches",
          "",
          "=B2",
          "<=",
          "10"
        ],
        [
          "Max gizmo batches",
          "",
          "=B4",
          "<=",
          "8"
        ]
      ],
      "whole": true,
      "fieldOrder": [
        "grid",
        "whole",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "integer",
      "objective": 2370
    }
  },
  {
    "key": "clinic-staffing",
    "slug": "clinic-staffing-plan",
    "category": "business",
    "type": "integer",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Clinic staffing plan",
        "desc": "Cover four care blocks with overlapping shifts at least cost"
      },
      "es": {
        "title": "Plan de personal de la clínica",
        "desc": "Cubrir cuatro bloques asistenciales con turnos solapados al menor coste"
      },
      "pt": {
        "title": "Plano de pessoal da clínica",
        "desc": "Cobrir quatro blocos de atendimento com turnos sobrepostos ao menor custo"
      },
      "de": {
        "title": "Personalplan Klinik",
        "desc": "Vier Versorgungsblöcke mit überlappenden Schichten zu geringsten Kosten abdecken"
      },
      "fr": {
        "title": "Plan de personnel de la clinique",
        "desc": "Couvrir quatre blocs de soins avec des équipes qui se chevauchent au moindre coût"
      }
    },
    "model": {
      "grid": [
        [
          "Shift pattern",
          "Staff",
          "Term",
          "",
          ""
        ],
        [
          "Morning (08-14)",
          "0",
          "",
          "",
          ""
        ],
        [
          "Midday (11-17)",
          "0",
          "",
          "",
          ""
        ],
        [
          "Evening (14-20)",
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
          "=160*B2+170*B3+180*B4",
          "",
          ""
        ],
        [
          "08-11 cover",
          "",
          "=B2",
          ">=",
          "5"
        ],
        [
          "11-14 cover",
          "",
          "=B2+B3",
          ">=",
          "9"
        ],
        [
          "14-17 cover",
          "",
          "=B3+B4",
          ">=",
          "8"
        ],
        [
          "17-20 cover",
          "",
          "=B4",
          ">=",
          "4"
        ]
      ],
      "whole": true,
      "fieldOrder": [
        "grid",
        "whole",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "integer",
      "objective": 2200
    }
  },
  {
    "key": "call-centre",
    "slug": "call-centre-shift-plan",
    "category": "business",
    "type": "integer",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Call centre shift plan",
        "desc": "Choose staggered shift starts to cover five periods at least cost"
      },
      "es": {
        "title": "Plan de turnos del centro de llamadas",
        "desc": "Elegir inicios de turno escalonados para cubrir cinco periodos al menor coste"
      },
      "pt": {
        "title": "Plano de turnos do call center",
        "desc": "Escolher inícios de turno escalonados para cobrir cinco períodos ao menor custo"
      },
      "de": {
        "title": "Schichtplan Callcenter",
        "desc": "Gestaffelte Schichtbeginne wählen, um fünf Zeiträume zu geringsten Kosten abzudecken"
      },
      "fr": {
        "title": "Plan d'équipes du centre d'appels",
        "desc": "Choisir des débuts d'équipe échelonnés pour couvrir cinq périodes au moindre coût"
      }
    },
    "model": {
      "grid": [
        [
          "Shift start",
          "Agents",
          "Term",
          "",
          ""
        ],
        [
          "06:00 (8h)",
          "0",
          "",
          "",
          ""
        ],
        [
          "10:00 (8h)",
          "0",
          "",
          "",
          ""
        ],
        [
          "14:00 (8h)",
          "0",
          "",
          "",
          ""
        ],
        [
          "18:00 (6h)",
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
          "=200*B2+200*B3+200*B4+150*B5",
          "",
          ""
        ],
        [
          "06-10 cover",
          "",
          "=B2",
          ">=",
          "6"
        ],
        [
          "10-14 cover",
          "",
          "=B2+B3",
          ">=",
          "12"
        ],
        [
          "14-18 cover",
          "",
          "=B3+B4",
          ">=",
          "15"
        ],
        [
          "18-22 cover",
          "",
          "=B4+B5",
          ">=",
          "10"
        ],
        [
          "22-24 cover",
          "",
          "=B5",
          ">=",
          "3"
        ]
      ],
      "whole": true,
      "fieldOrder": [
        "grid",
        "whole",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "integer",
      "objective": 4650
    }
  },
  {
    "key": "purchase-split",
    "slug": "purchase-order-split",
    "category": "business",
    "type": "continuous",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Purchase order split",
        "desc": "Split an order across three suppliers to meet demand at least cost"
      },
      "es": {
        "title": "Reparto de la orden de compra",
        "desc": "Repartir un pedido entre tres proveedores para cubrir la demanda al menor coste"
      },
      "pt": {
        "title": "Divisão da ordem de compra",
        "desc": "Dividir um pedido entre três fornecedores para atender à procura ao menor custo"
      },
      "de": {
        "title": "Aufteilung der Bestellung",
        "desc": "Eine Bestellung auf drei Lieferanten aufteilen, um den Bedarf zu geringsten Kosten zu decken"
      },
      "fr": {
        "title": "Répartition du bon de commande",
        "desc": "Répartir une commande entre trois fournisseurs pour couvrir la demande au moindre coût"
      }
    },
    "model": {
      "grid": [
        [
          "Supplier",
          "Units",
          "Term",
          "",
          ""
        ],
        [
          "Supplier A",
          "0",
          "",
          "",
          ""
        ],
        [
          "Supplier B",
          "0",
          "",
          "",
          ""
        ],
        [
          "Supplier C",
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
          "=8.5*B2+7.9*B3+9.2*B4",
          "",
          ""
        ],
        [
          "Meet demand",
          "",
          "=B2+B3+B4",
          ">=",
          "500"
        ],
        [
          "Cap A",
          "",
          "=B2",
          "<=",
          "250"
        ],
        [
          "Cap B",
          "",
          "=B3",
          "<=",
          "200"
        ],
        [
          "Cap C",
          "",
          "=B4",
          "<=",
          "300"
        ]
      ],
      "fieldOrder": [
        "grid",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 4165
    }
  },
  {
    "key": "ingredient-sourcing",
    "slug": "ingredient-sourcing-plan",
    "category": "binary",
    "type": "mixed",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Ingredient sourcing plan",
        "desc": "Activate suppliers and buy quantities to meet two composition needs at least cost"
      },
      "es": {
        "title": "Plan de aprovisionamiento de ingredientes",
        "desc": "Activar proveedores y comprar cantidades para cubrir dos necesidades de composición al menor coste"
      },
      "pt": {
        "title": "Plano de fornecimento de ingredientes",
        "desc": "Ativar fornecedores e comprar quantidades para atender a duas necessidades de composição ao menor custo"
      },
      "de": {
        "title": "Beschaffungsplan Zutaten",
        "desc": "Lieferanten aktivieren und Mengen kaufen, um zwei Zusammensetzungsanforderungen zu geringsten Kosten zu erfüllen"
      },
      "fr": {
        "title": "Plan d'approvisionnement en ingrédients",
        "desc": "Activer des fournisseurs et acheter des quantités pour couvrir deux besoins de composition au moindre coût"
      }
    },
    "model": {
      "grid": [
        [
          "Decision",
          "Value",
          "Coeff",
          "Term",
          "Wheat frac",
          "Barley frac"
        ],
        [
          "Use Farm",
          "0",
          "900",
          "=B2*C2",
          "0",
          "0"
        ],
        [
          "Use Mill",
          "0",
          "700",
          "=B3*C3",
          "0",
          "0"
        ],
        [
          "Use Coop",
          "0",
          "1100",
          "=B4*C4",
          "0",
          "0"
        ],
        [
          "Qty Farm (t)",
          "0",
          "40",
          "=B5*C5",
          "0.75",
          "0.25"
        ],
        [
          "Qty Mill (t)",
          "0",
          "52",
          "=B6*C6",
          "0.25",
          "0.75"
        ],
        [
          "Qty Coop (t)",
          "0",
          "35",
          "=B7*C7",
          "0.50",
          "0.50"
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total cost (GBP)",
          "",
          "",
          "=SUM(D2:D7)",
          "",
          ""
        ],
        [
          "Wheat (t)",
          "",
          "",
          "=SUMPRODUCT(B2:B7,E2:E7)",
          ">=",
          "40"
        ],
        [
          "Barley (t)",
          "",
          "",
          "=SUMPRODUCT(B2:B7,F2:F7)",
          ">=",
          "37.5"
        ],
        [
          "Farm link",
          "",
          "",
          "=B5-60*B2",
          "<=",
          "0"
        ],
        [
          "Mill link",
          "",
          "",
          "=B6-60*B3",
          "<=",
          "0"
        ],
        [
          "Coop link",
          "",
          "",
          "=B7-60*B4",
          "<=",
          "0"
        ]
      ],
      "domains": {
        "B2": {
          "type": "binary"
        },
        "B3": {
          "type": "binary"
        },
        "B4": {
          "type": "binary"
        },
        "B5": {
          "type": "continuous",
          "min": 0,
          "max": 60
        },
        "B6": {
          "type": "continuous",
          "min": 0,
          "max": 60
        },
        "B7": {
          "type": "continuous",
          "min": 0,
          "max": 60
        }
      },
      "fieldOrder": [
        "grid",
        "domains",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "mixed",
      "objective": 5135
    }
  },
  {
    "key": "fleet-assignment",
    "slug": "fleet-assignment-plan",
    "category": "binary",
    "type": "binary",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Fleet assignment plan",
        "desc": "Pick which vehicles to run to cover the load at least operating cost"
      },
      "es": {
        "title": "Plan de asignación de flota",
        "desc": "Elegir qué vehículos usar para cubrir la carga al menor coste operativo"
      },
      "pt": {
        "title": "Plano de atribuição de frota",
        "desc": "Escolher que veículos usar para cobrir a carga ao menor custo operacional"
      },
      "de": {
        "title": "Flottenzuweisungsplan",
        "desc": "Auswählen, welche Fahrzeuge fahren, um die Last zu geringsten Betriebskosten abzudecken"
      },
      "fr": {
        "title": "Plan d'affectation de flotte",
        "desc": "Choisir quels véhicules utiliser pour couvrir la charge au moindre coût d'exploitation"
      }
    },
    "model": {
      "grid": [
        [
          "Vehicle",
          "Use",
          "Cost",
          "Term",
          "Capacity",
          ""
        ],
        [
          "Van 1",
          "0",
          "80",
          "=B2*C2",
          "120",
          ""
        ],
        [
          "Van 2",
          "0",
          "95",
          "=B3*C3",
          "160",
          ""
        ],
        [
          "Truck 1",
          "0",
          "140",
          "=B4*C4",
          "300",
          ""
        ],
        [
          "Truck 2",
          "0",
          "170",
          "=B5*C5",
          "380",
          ""
        ],
        [
          "Truck 3",
          "0",
          "120",
          "=B6*C6",
          "250",
          ""
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total cost (GBP)",
          "",
          "",
          "=SUM(D2:D6)",
          "",
          ""
        ],
        [
          "Total capacity",
          "",
          "",
          "=SUMPRODUCT(B2:B6,E2:E6)",
          ">=",
          "700"
        ]
      ],
      "domains": {
        "B2": {
          "type": "binary"
        },
        "B3": {
          "type": "binary"
        },
        "B4": {
          "type": "binary"
        },
        "B5": {
          "type": "binary"
        },
        "B6": {
          "type": "binary"
        }
      },
      "fieldOrder": [
        "grid",
        "domains",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "binary",
      "objective": 355
    }
  },
  {
    "key": "media-mix",
    "slug": "media-channel-mix",
    "category": "start",
    "type": "continuous",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Media channel mix",
        "desc": "Allocate a budget across channels to maximise reach within limits"
      },
      "es": {
        "title": "Mezcla de canales de medios",
        "desc": "Repartir un presupuesto entre canales para maximizar el alcance dentro de los límites"
      },
      "pt": {
        "title": "Mix de canais de mídia",
        "desc": "Distribuir um orçamento entre canais para maximizar o alcance dentro dos limites"
      },
      "de": {
        "title": "Media-Kanal-Mix",
        "desc": "Ein Budget auf Kanäle verteilen, um die Reichweite innerhalb der Grenzen zu maximieren"
      },
      "fr": {
        "title": "Mix de canaux média",
        "desc": "Répartir un budget entre les canaux pour maximiser la portée dans les limites"
      }
    },
    "model": {
      "grid": [
        [
          "Channel",
          "Spend",
          "Reach",
          "Term",
          "",
          ""
        ],
        [
          "Search",
          "0",
          "5.0",
          "=B2*C2",
          "",
          ""
        ],
        [
          "Social",
          "0",
          "4.2",
          "=B3*C3",
          "",
          ""
        ],
        [
          "TV",
          "0",
          "3.0",
          "=B4*C4",
          "",
          ""
        ],
        [
          "Radio",
          "0",
          "2.5",
          "=B5*C5",
          "",
          ""
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total reach (000s)",
          "",
          "",
          "=SUM(D2:D5)",
          "",
          ""
        ],
        [
          "Total budget",
          "",
          "",
          "=B2+B3+B4+B5",
          "<=",
          "100"
        ],
        [
          "Max Search",
          "",
          "",
          "=B2",
          "<=",
          "40"
        ],
        [
          "Max Social",
          "",
          "",
          "=B3",
          "<=",
          "35"
        ],
        [
          "Max TV",
          "",
          "",
          "=B4",
          "<=",
          "50"
        ],
        [
          "Min traditional",
          "",
          "",
          "=B4+B5",
          ">=",
          "30"
        ]
      ],
      "fieldOrder": [
        "grid",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 416
    }
  },
  {
    "key": "fertiliser-blend",
    "slug": "fertiliser-blend-plan",
    "category": "business",
    "type": "continuous",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Fertiliser blend plan",
        "desc": "Find the cheapest blend meeting minimum nitrogen, phosphorus and potassium"
      },
      "es": {
        "title": "Plan de mezcla de fertilizantes",
        "desc": "Encontrar la mezcla más barata que cumpla el mínimo de nitrógeno, fósforo y potasio"
      },
      "pt": {
        "title": "Plano de mistura de fertilizantes",
        "desc": "Encontrar a mistura mais barata que cumpra o mínimo de azoto, fósforo e potássio"
      },
      "de": {
        "title": "Düngermischungsplan",
        "desc": "Die günstigste Mischung finden, die Mindestwerte für Stickstoff, Phosphor und Kalium erfüllt"
      },
      "fr": {
        "title": "Plan de mélange d'engrais",
        "desc": "Trouver le mélange le moins cher respectant le minimum d'azote, phosphore et potassium"
      }
    },
    "model": {
      "grid": [
        [
          "Fertiliser",
          "Kg",
          "Cost",
          "Term",
          "N frac",
          "P frac",
          "K frac"
        ],
        [
          "Blend X",
          "0",
          "0.9",
          "=B2*C2",
          "0.12",
          "0.08",
          "0.06"
        ],
        [
          "Blend Y",
          "0",
          "1.1",
          "=B3*C3",
          "0.06",
          "0.14",
          "0.10"
        ],
        [
          "Blend Z",
          "0",
          "0.8",
          "=B4*C4",
          "0.10",
          "0.05",
          "0.16"
        ],
        [
          "",
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total cost (GBP)",
          "",
          "",
          "=SUM(D2:D4)",
          "",
          "",
          ""
        ],
        [
          "Nitrogen (kg)",
          "",
          "",
          "=SUMPRODUCT(B2:B4,E2:E4)",
          ">=",
          "6",
          ""
        ],
        [
          "Phosphorus (kg)",
          "",
          "",
          "=SUMPRODUCT(B2:B4,F2:F4)",
          ">=",
          "4",
          ""
        ],
        [
          "Potassium (kg)",
          "",
          "",
          "=SUMPRODUCT(B2:B4,G2:G4)",
          ">=",
          "5",
          ""
        ]
      ],
      "fieldOrder": [
        "grid",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 47.602739726
    }
  },
  {
    "key": "scholarships",
    "slug": "scholarship-allocation",
    "category": "start",
    "type": "integer",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Scholarship allocation",
        "desc": "Fund whole scholarships to support the most students within budget and balance rules"
      },
      "es": {
        "title": "Asignación de becas",
        "desc": "Financiar becas enteras para apoyar al mayor número de estudiantes dentro del presupuesto y las reglas de balance"
      },
      "pt": {
        "title": "Atribuição de bolsas",
        "desc": "Financiar bolsas inteiras para apoiar o maior número de estudantes dentro do orçamento e das regras de equilíbrio"
      },
      "de": {
        "title": "Stipendienvergabe",
        "desc": "Ganze Stipendien finanzieren, um die meisten Studierenden innerhalb von Budget- und Balanceregeln zu unterstützen"
      },
      "fr": {
        "title": "Attribution de bourses",
        "desc": "Financer des bourses entières pour soutenir le plus d'étudiants dans le budget et les règles d'équilibre"
      }
    },
    "model": {
      "grid": [
        [
          "Scholarship",
          "Count",
          "Term",
          "",
          ""
        ],
        [
          "Undergraduate",
          "0",
          "",
          "",
          ""
        ],
        [
          "Vocational",
          "0",
          "",
          "",
          ""
        ],
        [
          "Postgraduate",
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
          "Total students",
          "",
          "=B2+B3+B4",
          "",
          ""
        ],
        [
          "Budget (GBP)",
          "",
          "=3000*B2+2000*B3+5000*B4",
          "<=",
          "120000"
        ],
        [
          "Min undergraduate",
          "",
          "=B2",
          ">=",
          "8"
        ],
        [
          "Min vocational",
          "",
          "=B3",
          ">=",
          "8"
        ],
        [
          "Min postgraduate",
          "",
          "=B4",
          ">=",
          "5"
        ],
        [
          "Max postgraduate",
          "",
          "=B4",
          "<=",
          "12"
        ],
        [
          "Vocational capacity",
          "",
          "=B3-2*B2",
          "<=",
          "0"
        ]
      ],
      "whole": true,
      "fieldOrder": [
        "grid",
        "whole",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "integer",
      "objective": 45
    }
  },
  {
    "key": "food-bank",
    "slug": "food-bank-allocation",
    "category": "start",
    "type": "integer",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Food bank allocation",
        "desc": "Distribute limited stock across centres to serve the most households"
      },
      "es": {
        "title": "Asignación del banco de alimentos",
        "desc": "Distribuir el stock limitado entre centros para atender al mayor número de hogares"
      },
      "pt": {
        "title": "Distribuição do banco alimentar",
        "desc": "Distribuir o stock limitado entre centros para servir o maior número de agregados"
      },
      "de": {
        "title": "Verteilung Tafel",
        "desc": "Begrenzten Bestand auf Zentren verteilen, um die meisten Haushalte zu versorgen"
      },
      "fr": {
        "title": "Répartition de la banque alimentaire",
        "desc": "Répartir un stock limité entre les centres pour servir le plus de foyers"
      }
    },
    "model": {
      "grid": [
        [
          "Centre",
          "Parcels",
          "Served",
          "Term",
          "Food",
          "Volunteers"
        ],
        [
          "North",
          "0",
          "1.0",
          "=B2*C2",
          "2",
          "0.20"
        ],
        [
          "East",
          "0",
          "1.0",
          "=B3*C3",
          "4",
          "0.10"
        ],
        [
          "South",
          "0",
          "1.0",
          "=B4*C4",
          "3",
          "0.30"
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Households served",
          "",
          "",
          "=SUM(D2:D4)",
          "",
          ""
        ],
        [
          "Food stock (kg)",
          "",
          "",
          "=SUMPRODUCT(B2:B4,E2:E4)",
          "<=",
          "2000"
        ],
        [
          "Volunteer hours",
          "",
          "",
          "=SUMPRODUCT(B2:B4,F2:F4)",
          "<=",
          "150"
        ],
        [
          "North capacity",
          "",
          "",
          "=B2",
          "<=",
          "300"
        ],
        [
          "East capacity",
          "",
          "",
          "=B3",
          "<=",
          "250"
        ],
        [
          "South capacity",
          "",
          "",
          "=B4",
          "<=",
          "280"
        ]
      ],
      "whole": true,
      "fieldOrder": [
        "grid",
        "whole",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "integer",
      "objective": 711
    }
  },
  {
    "key": "renewable-mix",
    "slug": "renewable-energy-mix",
    "category": "business",
    "type": "continuous",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Renewable energy mix",
        "desc": "Meet demand from solar, wind and grid at least cost with a renewable target"
      },
      "es": {
        "title": "Mezcla de energía renovable",
        "desc": "Cubrir la demanda con solar, eólica y red al menor coste con un objetivo renovable"
      },
      "pt": {
        "title": "Mix de energia renovável",
        "desc": "Atender à procura com solar, eólica e rede ao menor custo com uma meta renovável"
      },
      "de": {
        "title": "Mix erneuerbarer Energien",
        "desc": "Bedarf aus Solar, Wind und Netz zu geringsten Kosten mit einem Erneuerbaren-Ziel decken"
      },
      "fr": {
        "title": "Mix d'énergie renouvelable",
        "desc": "Couvrir la demande par le solaire, l'éolien et le réseau au moindre coût avec un objectif renouvelable"
      }
    },
    "model": {
      "grid": [
        [
          "Source",
          "MWh",
          "Cost",
          "Term",
          "Renewable",
          ""
        ],
        [
          "Solar",
          "0",
          "55",
          "=B2*C2",
          "1",
          ""
        ],
        [
          "Wind",
          "0",
          "48",
          "=B3*C3",
          "1",
          ""
        ],
        [
          "Grid",
          "0",
          "30",
          "=B4*C4",
          "0",
          ""
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total cost (GBP)",
          "",
          "",
          "=SUM(D2:D4)",
          "",
          ""
        ],
        [
          "Meet demand",
          "",
          "",
          "=B2+B3+B4",
          ">=",
          "1000"
        ],
        [
          "Min renewable",
          "",
          "",
          "=0.4*B2+0.4*B3-0.6*B4",
          ">=",
          "0"
        ],
        [
          "Solar capacity",
          "",
          "",
          "=B2",
          "<=",
          "450"
        ],
        [
          "Wind capacity",
          "",
          "",
          "=B3",
          "<=",
          "500"
        ]
      ],
      "fieldOrder": [
        "grid",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 41500
    }
  },
  {
    "key": "microgrid-capacity",
    "slug": "microgrid-capacity-plan",
    "category": "business",
    "type": "continuous",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Microgrid capacity plan",
        "desc": "Size solar, battery and backup to meet firm capacity at least annualised cost"
      },
      "es": {
        "title": "Plan de capacidad de microrred",
        "desc": "Dimensionar solar, batería y respaldo para cubrir la capacidad firme al menor coste anualizado"
      },
      "pt": {
        "title": "Plano de capacidade de microrrede",
        "desc": "Dimensionar solar, bateria e reserva para cobrir a capacidade firme ao menor custo anualizado"
      },
      "de": {
        "title": "Kapazitätsplan Microgrid",
        "desc": "Solar, Batterie und Reserve dimensionieren, um die gesicherte Leistung zu geringsten annualisierten Kosten zu decken"
      },
      "fr": {
        "title": "Plan de capacité de micro-réseau",
        "desc": "Dimensionner solaire, batterie et secours pour couvrir la capacité ferme au moindre coût annualisé"
      }
    },
    "model": {
      "grid": [
        [
          "Asset",
          "kW",
          "Cost",
          "Term",
          "Firm",
          ""
        ],
        [
          "Solar",
          "0",
          "70",
          "=B2*C2",
          "0.35",
          ""
        ],
        [
          "Battery",
          "0",
          "110",
          "=B3*C3",
          "0.9",
          ""
        ],
        [
          "Backup",
          "0",
          "95",
          "=B4*C4",
          "1.0",
          ""
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Annualised cost (GBP)",
          "",
          "",
          "=SUM(D2:D4)",
          "",
          ""
        ],
        [
          "Firm capacity (kW)",
          "",
          "",
          "=SUMPRODUCT(B2:B4,E2:E4)",
          ">=",
          "200"
        ],
        [
          "Backup dependence",
          "",
          "",
          "=B4-B2-B3",
          "<=",
          "0"
        ],
        [
          "Min solar",
          "",
          "",
          "=B2",
          ">=",
          "80"
        ],
        [
          "Max backup",
          "",
          "",
          "=B4",
          "<=",
          "150"
        ]
      ],
      "fieldOrder": [
        "grid",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 23126.315789474
    }
  },
  {
    "key": "hotel-rooms",
    "slug": "hotel-room-allocation",
    "category": "start",
    "type": "integer",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Hotel room allocation",
        "desc": "Allocate rooms across channels to maximise revenue within inventory and commitments"
      },
      "es": {
        "title": "Asignación de habitaciones de hotel",
        "desc": "Asignar habitaciones entre canales para maximizar los ingresos dentro del inventario y los compromisos"
      },
      "pt": {
        "title": "Atribuição de quartos de hotel",
        "desc": "Atribuir quartos entre canais para maximizar a receita dentro do inventário e dos compromissos"
      },
      "de": {
        "title": "Zimmerverteilung Hotel",
        "desc": "Zimmer auf Kanäle verteilen, um den Umsatz innerhalb von Bestand und Zusagen zu maximieren"
      },
      "fr": {
        "title": "Attribution des chambres d'hôtel",
        "desc": "Répartir les chambres entre les canaux pour maximiser le revenu dans l'inventaire et les engagements"
      }
    },
    "model": {
      "grid": [
        [
          "Channel",
          "Rooms",
          "Term",
          "",
          ""
        ],
        [
          "Direct",
          "0",
          "",
          "",
          ""
        ],
        [
          "OTA",
          "0",
          "",
          "",
          ""
        ],
        [
          "Corporate",
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
          "=110*B2+95*B3+130*B4",
          "",
          ""
        ],
        [
          "Room inventory",
          "",
          "=B2+B3+B4",
          "<=",
          "80"
        ],
        [
          "Max direct",
          "",
          "=B2",
          "<=",
          "60"
        ],
        [
          "Max corporate",
          "",
          "=B4",
          "<=",
          "25"
        ],
        [
          "Min OTA",
          "",
          "=B3",
          ">=",
          "10"
        ]
      ],
      "whole": true,
      "fieldOrder": [
        "grid",
        "whole",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "integer",
      "objective": 9150
    }
  },
  {
    "key": "lp-basics",
    "slug": "linear-optimisation-basics",
    "category": "start",
    "type": "continuous",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Linear optimisation basics",
        "desc": "A small two-product plan to learn variables, an objective and constraints"
      },
      "es": {
        "title": "Fundamentos de optimización lineal",
        "desc": "Un pequeño plan de dos productos para aprender variables, un objetivo y restricciones"
      },
      "pt": {
        "title": "Fundamentos de otimização linear",
        "desc": "Um pequeno plano de dois produtos para aprender variáveis, um objetivo e restrições"
      },
      "de": {
        "title": "Grundlagen der linearen Optimierung",
        "desc": "Ein kleiner Zwei-Produkt-Plan, um Variablen, ein Ziel und Nebenbedingungen zu lernen"
      },
      "fr": {
        "title": "Bases de l'optimisation linéaire",
        "desc": "Un petit plan à deux produits pour apprendre les variables, un objectif et des contraintes"
      }
    },
    "model": {
      "grid": [
        [
          "Product",
          "Units",
          "Term",
          "",
          ""
        ],
        [
          "Tables",
          "0",
          "",
          "",
          ""
        ],
        [
          "Chairs",
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
          "=25*B2+20*B3",
          "",
          ""
        ],
        [
          "Wood (m2)",
          "",
          "=3*B2+2*B3",
          "<=",
          "48"
        ],
        [
          "Workshop hours",
          "",
          "=2*B2+4*B3",
          "<=",
          "56"
        ]
      ],
      "fieldOrder": [
        "grid",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 430
    }
  }
];

module.exports = { CATALOGUE: CATALOGUE };
