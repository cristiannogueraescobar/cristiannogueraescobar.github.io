# F7a Example Catalogue Audit

Derived directly from the final source (catalogue.js, f5/metadata.js, f5/derive.js, canonical loader) at 24 examples. Not copied from prior documentation.

## Totals

- 24 examples (9 historical + 15 F7a)
- 10/10 categories populated
- Model types: continuous 11, integer 8, binary 3, mixed 2
- Directions: max 12, min 12
- Difficulty: beginner 5, intermediate 13, advanced 6

## 9 historical examples (existing, pre-F7a)

| key | slug | category | EN title | type | dir | diff | min | vars | cons | status | objective | policy | chart | tags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| production | production-plan | production-operations | Production plan | continuous | max | beginner | 5 | 3 | 2 | optimal | 1760 | objective-feasible | no | production\|capacity\|profit |
| workshop | workshop-chart | production-operations | Workshop chart | continuous | max | beginner | 6 | 2 | 2 | optimal | 900 | objective-feasible | yes | production\|chart\|two-variables |
| blend | cheapest-feed-blend | blending-formulation | Cheapest feed blend | continuous | min | intermediate | 8 | 3 | 3 | optimal | 27.352941176470587 | objective-feasible | no | blending\|nutrition\|cost |
| marketing | marketing-budget | marketing-finance | Marketing budget | continuous | max | intermediate | 7 | 3 | 1 | optimal | 21350 | objective-feasible | no | budget\|allocation\|return |
| workforce | workforce-scheduling | workforce-scheduling | Workforce scheduling | integer | min | advanced | 10 | 7 | 7 | optimal | 23 | objective-feasible | no | staffing\|coverage\|weekly |
| shipping | shipping-plan | logistics-transport | Shipping plan | integer | min | advanced | 10 | 6 | 5 | optimal | 450 | objective-feasible | no | transport\|network\|cost |
| project | project-selection | marketing-finance | Project selection | binary | max | intermediate | 7 | 4 | 2 | optimal | 125 | objective-feasible | no | selection\|budget\|yes-no |
| delivery | delivery-load | logistics-transport | Delivery load | binary | max | intermediate | 7 | 5 | 2 | optimal | 240 | objective-feasible | no | loading\|capacity\|yes-no |
| supplier | supplier-activation | purchasing-suppliers | Supplier activation | mixed | min | advanced | 12 | 6 | 4 | optimal | 830 | objective-feasible | no | sourcing\|fixed-cost\|activation |

## 15 F7a examples (new)

| key | slug | category | EN title | type | dir | diff | min | vars | cons | status | objective | policy | chart | tags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bakery-mix | bakery-production-mix | production-operations | Bakery production mix | continuous | max | beginner | 4 | 3 | 4 | optimal | 375 | exact | no | production\|bakery\|capacity\|mix |
| factory-batches | factory-batch-plan | production-operations | Factory batch plan | integer | max | intermediate | 6 | 3 | 4 | optimal | 2370 | objective-feasible | no | production\|batches\|integer\|capacity |
| clinic-staffing | clinic-staffing-plan | workforce-scheduling | Clinic staffing plan | integer | min | intermediate | 6 | 3 | 4 | optimal | 2200 | objective-feasible | no | staffing\|shifts\|coverage\|healthcare |
| call-centre | call-centre-shift-plan | workforce-scheduling | Call centre shift plan | integer | min | intermediate | 7 | 4 | 5 | optimal | 4650 | objective-feasible | no | staffing\|shifts\|scheduling\|coverage |
| purchase-split | purchase-order-split | purchasing-suppliers | Purchase order split | continuous | min | beginner | 4 | 3 | 4 | optimal | 4165 | exact | no | suppliers\|procurement\|sourcing\|cost |
| ingredient-sourcing | ingredient-sourcing-plan | purchasing-suppliers | Ingredient sourcing plan | mixed | min | advanced | 11 | 6 | 5 | optimal | 5135 | objective-feasible | no | suppliers\|sourcing\|activation\|blend |
| fleet-assignment | fleet-assignment-plan | logistics-transport | Fleet assignment plan | binary | min | advanced | 9 | 5 | 1 | optimal | 355 | objective-feasible | no | fleet\|logistics\|selection\|capacity |
| media-mix | media-channel-mix | marketing-finance | Media channel mix | continuous | max | intermediate | 5 | 4 | 5 | optimal | 416 | objective-feasible | no | campaign\|budget\|allocation\|reach |
| fertiliser-blend | fertiliser-blend-plan | blending-formulation | Fertiliser blend plan | continuous | min | intermediate | 7 | 3 | 3 | optimal | 47.602739726 | exact | no | blend\|nutrients\|formulation\|cost |
| scholarships | scholarship-allocation | education-social | Scholarship allocation | integer | max | intermediate | 7 | 3 | 6 | optimal | 45 | objective-feasible | no | education\|allocation\|budget\|funding |
| food-bank | food-bank-allocation | education-social | Food bank allocation | integer | max | intermediate | 6 | 3 | 5 | optimal | 711 | objective-feasible | no | allocation\|community\|distribution\|capacity |
| renewable-mix | renewable-energy-mix | energy-sustainability | Renewable energy mix | continuous | min | intermediate | 6 | 3 | 4 | optimal | 41500 | objective-feasible | no | energy\|renewable\|cost\|demand |
| microgrid-capacity | microgrid-capacity-plan | energy-sustainability | Microgrid capacity plan | continuous | min | advanced | 10 | 3 | 4 | optimal | 23126.315789474 | objective-feasible | no | energy\|capacity\|planning\|resilience |
| hotel-rooms | hotel-room-allocation | hospitality-retail | Hotel room allocation | integer | max | intermediate | 6 | 3 | 4 | optimal | 9150 | objective-feasible | no | hotel\|revenue\|allocation\|channels |
| lp-basics | linear-optimisation-basics | learning-engine | Linear optimisation basics | continuous | max | beginner | 3 | 2 | 2 | optimal | 430 | exact | yes | learning\|basics\|two-variables\|chart |

## Category population (10/10)

- **blending-formulation** (2): blend, fertiliser-blend
- **education-social** (2): scholarships, food-bank
- **energy-sustainability** (2): renewable-mix, microgrid-capacity
- **hospitality-retail** (1): hotel-rooms
- **learning-engine** (1): lp-basics
- **logistics-transport** (3): shipping, delivery, fleet-assignment
- **marketing-finance** (3): marketing, project, media-mix
- **production-operations** (4): production, workshop, bakery-mix, factory-batches
- **purchasing-suppliers** (3): supplier, purchase-split, ingredient-sourcing
- **workforce-scheduling** (3): workforce, clinic-staffing, call-centre

