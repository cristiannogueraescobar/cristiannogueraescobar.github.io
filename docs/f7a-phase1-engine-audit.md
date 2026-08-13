# F7a Phase 1 — Engine validation of the 15 new models (external-audit corrections applied)

**Phase-1 working environment: Node v22.22.2**  
**Final acceptance runtime required: Node 24.15.0** (validated on Windows before merge; `engines` not relaxed).

This revision applies every correction from the external audit. Each model was re-run through the REAL pipeline (authored grid → engine detect → classify → solve #1 → independent verify → solve #2 → strict compare). An **independent feasibility verifier** recomputes every constraint and the objective from the returned decision vector (it does not trust the engine status). Chart eligibility uses the **real F5 derivation** (`deriveChartEligible`), not a proxy.

## A. Summary

- **15/15 optimal:** true
- **15/15 detected type == authored type == reserved type:** true
- **15/15 independently verified** (constraints + objective recomputed from the decision vector, domains checked): true
- **15/15 double-solve deterministic** (identical status, objective within 1e-6, strict vector equality — no zero fallback): true
- Type spread: continuous 7, integer 6, binary 1, mixed 1. Direction: max 7, min 8.
- All solved at the **default tolerance 1e-6**; no author tolerance required.

## B. Master table

| key | slug | category | type | dir | vars | cons | grid | funcs | objective | verified | determ | chart |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bakery-mix | bakery-production-mix | production-operations | continuous | max | 3 | 4 | 10x5 | - | 375 | yes | yes | no |
| factory-batches | factory-batch-plan | production-operations | integer | max | 3 | 4 | 10x5 | - | 2370 | yes | yes | no |
| clinic-staffing | clinic-staffing-plan | workforce-scheduling | integer | min | 3 | 4 | 10x5 | - | 2200 | yes | yes | no |
| call-centre | call-centre-shift-plan | workforce-scheduling | integer | min | 4 | 5 | 12x5 | - | 4650 | yes | yes | no |
| purchase-split | purchase-order-split | purchasing-suppliers | continuous | min | 3 | 4 | 10x5 | - | 4165 | yes | yes | no |
| ingredient-sourcing | ingredient-sourcing-plan | purchasing-suppliers | mixed | min | 6 | 5 | 14x6 | SUM+SUMPRODUCT | 5135 | yes | yes | no |
| fleet-assignment | fleet-assignment-plan | logistics-transport | binary | min | 5 | 1 | 9x6 | SUM+SUMPRODUCT | 355 | yes | yes | no |
| media-mix | media-channel-mix | marketing-finance | continuous | max | 4 | 5 | 12x6 | SUM | 416 | yes | yes | no |
| fertiliser-blend | fertiliser-blend-plan | blending-formulation | continuous | min | 3 | 3 | 9x7 | SUM+SUMPRODUCT | 47.602739726 | yes | yes | no |
| scholarships | scholarship-allocation | education-social | integer | max | 3 | 6 | 12x5 | - | 45 | yes | yes | no |
| food-bank | food-bank-allocation | education-social | integer | max | 3 | 5 | 11x6 | SUM+SUMPRODUCT | 711 | yes | yes | no |
| renewable-mix | renewable-energy-mix | energy-sustainability | continuous | min | 3 | 4 | 10x6 | SUM | 41500 | yes | yes | no |
| microgrid-capacity | microgrid-capacity-plan | energy-sustainability | continuous | min | 3 | 4 | 10x6 | SUM+SUMPRODUCT | 23126.315789474 | yes | yes | no |
| hotel-rooms | hotel-room-allocation | hospitality-retail | integer | max | 3 | 4 | 10x5 | - | 9150 | yes | yes | no |
| lp-basics | linear-optimisation-basics | learning-engine | continuous | max | 2 | 2 | 7x5 | - | 430 | yes | yes | yes |

## C. 15 model audit cards

### bakery-mix — `bakery-production-mix`  [unchanged]

- **Scenario:** A bakery decides how many loaves, rolls and pastries to bake today to maximise contribution.
- **Variables:** Units of loaves/rolls/pastries (continuous).
- **Synthetic inputs:** Contribution/unit £1.80/£0.70/£1.30. Flour kg 0.50/0.12/0.20. Labour min 4/2/5. Oven min 3/1/2.
- **Objective:** Maximise 1.80·L + 0.70·R + 1.30·P.
- **Constraints:** Flour ≤120kg; Labour ≤900min; Oven ≤600min; Pastries ≤80.
- **Engine result:** status `optimal`, objective **375**, detected type `continuous` (3 vars, 4 constraints, grid 10x5, functions none, bounds false).
- **Decision vector:** Loaves=150, Rolls=150, Pastries=0
- **Independent verification:** passed (recomputed objective 375 matches engine 375; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** Two products enter under three shared caps; pastries correctly excluded on economics — a real optimisation call.
- **Policy recommendation:** `exact` — externally confirmed unique optimum.
- **Learning value:** Classic production mix / continuous LP.

### factory-batches — `factory-batch-plan`  [unchanged]

- **Scenario:** A small factory schedules whole batches of three products to maximise margin.
- **Variables:** Integer batches of widgets/gadgets/gizmos.
- **Synthetic inputs:** Margin/batch 120/90/150. Machine h 3/2/4. Labour h 2/2/3.
- **Objective:** Maximise 120·w + 90·g + 150·z.
- **Constraints:** Machine ≤60h; Labour ≤44h; widgets ≤10; gizmos ≤8.
- **Engine result:** status `optimal`, objective **2370**, detected type `integer` (3 vars, 4 constraints, grid 10x5, functions none, bounds false).
- **Decision vector:** Widgets=10, Gadgets=3, Gizmos=6
- **Independent verification:** passed (recomputed objective 2370 matches engine 2370; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** All three products enter (10/3/6) under two shared capacities and per-product caps.
- **Policy recommendation:** `objective-feasible` — alternative integer optima plausible.
- **Learning value:** Integer production / batch decisions.

### clinic-staffing — `clinic-staffing-plan`  [unchanged]

- **Scenario:** A clinic covers four consecutive care blocks with three overlapping shift patterns at least cost.
- **Variables:** Integer staff on Morning/Midday/Evening patterns.
- **Synthetic inputs:** Cost/staff 160/170/180. Morning→08-11 & 11-14; Midday→11-14 & 14-17; Evening→14-17 & 17-20.
- **Objective:** Minimise 160·M + 170·Mid + 180·E.
- **Constraints:** 08-11 ≥5; 11-14 ≥9; 14-17 ≥8; 17-20 ≥4.
- **Engine result:** status `optimal`, objective **2200**, detected type `integer` (3 vars, 4 constraints, grid 10x5, functions none, bounds false).
- **Decision vector:** Morning (08-14)=5, Midday (11-17)=4, Evening (14-20)=4
- **Independent verification:** passed (recomputed objective 2200 matches engine 2200; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** Overlap makes cover non-trivial; solver balances 5/4/4.
- **Policy recommendation:** `objective-feasible`.
- **Learning value:** Set-covering / integer workforce planning.

### call-centre — `call-centre-shift-plan`  [FIXED (shift duration semantics)]

- **Scenario:** A call centre chooses agents per staggered shift to cover five periods.
- **Variables:** Integer agents at 06:00(8h)/10:00(8h)/14:00(8h)/18:00(6h).
- **Synthetic inputs:** Cost/shift 200/200/200/150. Each 8h shift spans two 4h periods; the 18:00 shift is 6h and spans 18-22 & 22-24.
- **Objective:** Minimise 200·s1 + 200·s2 + 200·s3 + 150·s4.
- **Constraints:** 06-10 ≥6; 10-14 ≥12; 14-18 ≥15; 18-22 ≥10; 22-24 ≥3.
- **Engine result:** status `optimal`, objective **4650**, detected type `integer` (4 vars, 5 constraints, grid 12x5, functions none, bounds false).
- **Decision vector:** 06:00 (8h)=6, 10:00 (8h)=8, 14:00 (8h)=7, 18:00 (6h)=3
- **Independent verification:** passed (recomputed objective 4650 matches engine 4650; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** **FIXED:** the 14:00 shift is now 8h, so it honestly covers 14-18 and 18-22 (previously labelled 6h while covering 8h). One real duration difference remains (18:00 is 6h). New optimum 6/8/7/3, obj 4650.
- **Policy recommendation:** `objective-feasible`.
- **Learning value:** Staggered-start shift scheduling; distinct from the clinic covering model.

### purchase-split — `purchase-order-split`  [unchanged]

- **Scenario:** A buyer splits one order across three suppliers to meet demand at least cost.
- **Variables:** Continuous units from A/B/C.
- **Synthetic inputs:** Unit cost 8.5/7.9/9.2. Capacities 250/200/300.
- **Objective:** Minimise 8.5·A + 7.9·B + 9.2·C.
- **Constraints:** A+B+C ≥500; A ≤250; B ≤200; C ≤300.
- **Engine result:** status `optimal`, objective **4165**, detected type `continuous` (3 vars, 4 constraints, grid 10x5, functions none, bounds false).
- **Decision vector:** Supplier A=250, Supplier B=200, Supplier C=50
- **Independent verification:** passed (recomputed objective 4165 matches engine 4165; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** Cheapest (B) capped at 200, then A to 250, then C tops up (250/200/50).
- **Policy recommendation:** `exact` — externally confirmed unique optimum.
- **Learning value:** Least-cost sourcing with capacities.

### ingredient-sourcing — `ingredient-sourcing-plan`  [FIXED (units: dimensionally coherent fractions)]

- **Scenario:** A mill activates suppliers and buys tonnage to meet two ingredient requirements at least total cost.
- **Variables:** Binary activation Farm/Mill/Coop + continuous tonnage from each (mixed).
- **Synthetic inputs:** Activation £900/£700/£1100. Unit £40/£52/£35. **Composition FRACTIONS per tonne purchased** — Farm 0.75 wheat / 0.25 barley; Mill 0.25 / 0.75; Coop 0.50 / 0.50. Link cap M=60t.
- **Objective:** Minimise activation + purchase cost.
- **Constraints:** Wheat ≥40t; Barley ≥37.5t; Farm/Mill/Coop link (qty ≤ 60·active).
- **Engine result:** status `optimal`, objective **5135**, detected type `mixed` (6 vars, 5 constraints, grid 14x6, functions SUM+SUMPRODUCT, bounds true).
- **Decision vector:** Use Farm=1, Use Mill=1, Use Coop=0, Qty Farm (t)=41.25, Qty Mill (t)=36.25, Qty Coop (t)=0
- **Independent verification:** passed (recomputed objective 5135 matches engine 5135; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** **FIXED:** composition is now physically coherent (fractions of component produced per tonne purchased, summing to 1 per supplier) with requirements scaled accordingly. The optimum is preserved exactly and re-solved: Farm+Mill activate, 41.25/36.25 tonnes.
- **Policy recommendation:** `objective-feasible`.
- **Learning value:** Mixed-integer sourcing with fixed activation + linking + multi-requirement blend.

### fleet-assignment — `fleet-assignment-plan`  [unchanged]

- **Scenario:** A depot picks which vehicles to run to cover the workload at least operating cost.
- **Variables:** Binary use of 5 vehicles.
- **Synthetic inputs:** Cost 80/95/140/170/120. Capacity 120/160/300/380/250.
- **Objective:** Minimise total operating cost.
- **Constraints:** Total selected capacity ≥700.
- **Engine result:** status `optimal`, objective **355**, detected type `binary` (5 vars, 1 constraints, grid 9x6, functions SUM+SUMPRODUCT, bounds true).
- **Decision vector:** Van 1=0, Van 2=1, Truck 1=1, Truck 2=0, Truck 3=1
- **Independent verification:** passed (recomputed objective 355 matches engine 355; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** 0/1 selection; picks Van2+Truck1+Truck3 (710, £355).
- **Policy recommendation:** `objective-feasible`.
- **Learning value:** Binary selection with a capacity floor; no routing.

### media-mix — `media-channel-mix`  [unchanged]

- **Scenario:** A campaign allocates a fixed budget across four channels to maximise reach.
- **Variables:** Continuous spend Search/Social/TV/Radio.
- **Synthetic inputs:** Reach per £ 5.0/4.2/3.0/2.5. Budget 100. Caps Search 40, Social 35, TV 50.
- **Objective:** Maximise reach.
- **Constraints:** Budget ≤100; Search ≤40; Social ≤35; TV ≤50; traditional (TV+Radio) ≥30.
- **Engine result:** status `optimal`, objective **416**, detected type `continuous` (4 vars, 5 constraints, grid 12x6, functions SUM, bounds false).
- **Decision vector:** Search=40, Social=30, TV=30, Radio=0
- **Independent verification:** passed (recomputed objective 416 matches engine 416; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** Mix floor forces a non-greedy allocation (40/30/30/0).
- **Policy recommendation:** `objective-feasible`.
- **Learning value:** Budget allocation with caps and a policy mix floor.

### fertiliser-blend — `fertiliser-blend-plan`  [FIXED (units: nutrient fractions kg/kg)]

- **Scenario:** A grower finds the cheapest blend of three fertilisers meeting N/P/K minimums.
- **Variables:** Continuous kg of X/Y/Z.
- **Synthetic inputs:** Cost/kg 0.9/1.1/0.8. **Nutrient FRACTIONS kg/kg** — N 0.12/0.06/0.10; P 0.08/0.14/0.05; K 0.06/0.10/0.16.
- **Objective:** Minimise 0.9·X + 1.1·Y + 0.8·Z.
- **Constraints:** N ≥6kg; P ≥4kg; K ≥5kg (per the fraction·kg totals).
- **Engine result:** status `optimal`, objective **47.602739726**, detected type `continuous` (3 vars, 3 constraints, grid 9x7, functions SUM+SUMPRODUCT, bounds false).
- **Decision vector:** Blend X=34.932, Blend Y=2.74, Blend Z=16.438
- **Independent verification:** passed (recomputed objective 47.602739725000006 matches engine 47.602739726; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** **FIXED:** nutrient coefficients are now fractions (kg nutrient per kg fertiliser) with requirements scaled /100. Same optimum, re-solved: 34.9/2.7/16.4, £47.60.
- **Policy recommendation:** `exact` — externally confirmed unique optimum.
- **Learning value:** Blending/diet LP with a nutrient matrix.

### scholarships — `scholarship-allocation`  [FIXED (added consequential balance rule; new obj 45)]

- **Scenario:** A programme funds whole scholarships of three types to maximise students within budget and policy.
- **Variables:** Integer counts UG/Voc/PG.
- **Synthetic inputs:** Cost each 3000/2000/5000. Budget 120000. Floors UG≥8, Voc≥8, PG≥5. PG≤12. **Vocational ≤ 2·Undergraduate** (vocational places need undergraduate mentoring capacity).
- **Objective:** Maximise UG + Voc + PG.
- **Constraints:** Budget; floors; PG cap; the balance rule.
- **Engine result:** status `optimal`, objective **45**, detected type `integer` (3 vars, 6 constraints, grid 12x5, functions none, bounds false).
- **Decision vector:** Undergraduate=15, Vocational=25, Postgraduate=5
- **Independent verification:** passed (recomputed objective 45 matches engine 45; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** **FIXED:** added a programme-balance rule that materially changes the optimum. WITHOUT it the answer is 9/34/5 (obj 48); WITH it the solver must raise UG to unlock vocational places → 15/25/5 (obj 45). No protected attributes.
- **Policy recommendation:** `objective-feasible`.
- **Learning value:** Integer allocation with budget + a real programme-balance rule.

### food-bank — `food-bank-allocation`  [FIXED (both resources now consequential; new obj 711)]

- **Scenario:** A food bank distributes stock across three centres to maximise households served.
- **Variables:** Integer parcels North/East/South.
- **Synthetic inputs:** Food kg/parcel 2/4/3. Volunteer h/parcel 0.20/0.10/0.30. Centre caps 300/250/280.
- **Objective:** Maximise parcels (households).
- **Constraints:** Food ≤2000kg; Volunteer ≤150h; centre caps.
- **Engine result:** status `optimal`, objective **711**, detected type `integer` (3 vars, 5 constraints, grid 11x6, functions SUM+SUMPRODUCT, bounds false).
- **Decision vector:** North=300, East=167, South=244
- **Independent verification:** passed (recomputed objective 711 matches engine 711; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** **FIXED:** coefficients and caps recalibrated so **both** resources bind at the optimum (food used 2000/2000, volunteers 149.9/150). Removing either changes the optimum (food 711→766, volunteers 711→720). Optimum 300/167/244.
- **Policy recommendation:** `objective-feasible` — alternative equal-objective vectors exist.
- **Learning value:** Resource-constrained allocation where two distinct resources genuinely trade off.

### renewable-mix — `renewable-energy-mix`  [FIXED (renewable target now binds; new obj 41500)]

- **Scenario:** An energy buyer meets demand from solar/wind/grid at least cost while hitting a renewable target.
- **Variables:** Continuous MWh solar/wind/grid.
- **Synthetic inputs:** Cost/MWh **55/48/30** (grid is cheapest). Solar cap 450, wind cap 500.
- **Objective:** Minimise 55·S + 48·W + 30·G.
- **Constraints:** Demand ≥1000; renewable share (0.4·S+0.4·W−0.6·G ≥0, i.e. ≥60% renewable); caps.
- **Engine result:** status `optimal`, objective **41500**, detected type `continuous` (3 vars, 4 constraints, grid 10x6, functions SUM, bounds false).
- **Decision vector:** Solar=100, Wind=500, Grid=400
- **Independent verification:** passed (recomputed objective 41500 matches engine 41500; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** **FIXED:** grid is now the cheapest source, so WITHOUT the renewable target the least-cost plan is all grid (1000, £30000). WITH the 60% target the solver must add solar+wind (100/500/400, £41500). The target binds exactly at 60%.
- **Policy recommendation:** `objective-feasible`.
- **Learning value:** Least-cost energy mix where a renewable-share policy genuinely reshapes the plan.

### microgrid-capacity — `microgrid-capacity-plan`  [FIXED (constraint honestly renamed; rule shown consequential)]

- **Scenario:** A site sizes solar/battery/backup capacity to meet a firm-capacity requirement at least annualised cost.
- **Variables:** Continuous kW solar/battery/backup.
- **Synthetic inputs:** Annualised £/kW 70/110/95. Firm credit 0.35/0.9/1.0. Min solar 80kW, max backup 150kW.
- **Objective:** Minimise 70·S + 110·B + 95·K.
- **Constraints:** Firm capacity ≥200kW; **Backup dependence** (Backup ≤ Solar+Battery); min solar; max backup.
- **Engine result:** status `optimal`, objective **23126.315789474**, detected type `continuous` (3 vars, 4 constraints, grid 10x6, functions SUM+SUMPRODUCT, bounds false).
- **Decision vector:** Solar=80, Battery=48.421, Backup=128.421
- **Independent verification:** passed (recomputed objective 23126.31578956 matches engine 23126.315789474; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** **FIXED (honest semantics):** the disputed constraint is renamed **Backup dependence** — backup capacity may not exceed non-backup capacity (a resilience/diversification limit). No claim that a battery is renewable generation. Maths preserved; WITHOUT the rule the optimum shifts to 80/24.4/150 (£22539), WITH it 80/48.4/128.4 (£23126).
- **Policy recommendation:** `objective-feasible`.
- **Learning value:** Capacity-planning LP trading cost against a firmness requirement and a backup-dependence limit; strictly linear.

### hotel-rooms — `hotel-room-allocation`  [FIXED (OTA commitment now consequential; new obj 9150)]

- **Scenario:** A hotel allocates rooms across three channels to maximise revenue within inventory and channel rules.
- **Variables:** Integer rooms Direct/OTA/Corporate.
- **Synthetic inputs:** Rate 110/95/130. Inventory 80. **Direct ≤60**, Corporate ≤25, OTA ≥10.
- **Objective:** Maximise 110·D + 95·O + 130·C.
- **Constraints:** Inventory ≤80; Direct ≤60; Corporate ≤25; OTA commitment ≥10.
- **Engine result:** status `optimal`, objective **9150**, detected type `integer` (3 vars, 4 constraints, grid 10x5, functions none, bounds false).
- **Decision vector:** Direct=45, OTA=10, Corporate=25
- **Independent verification:** passed (recomputed objective 9150 matches engine 9150; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** **FIXED:** the Direct cap is raised to 60 so the OTA commitment genuinely changes the decision. WITHOUT the OTA floor the solver prefers more Direct (55/0/25, £9300); WITH it, it must reserve 10 in the lowest-rate channel (45/10/25, £9150).
- **Policy recommendation:** `objective-feasible`.
- **Learning value:** Integer revenue allocation with a contractual channel minimum that bites.

### lp-basics — `linear-optimisation-basics`  [unchanged]

- **Scenario:** A small maker produces two products from limited wood and workshop hours — the teaching anchor.
- **Variables:** Continuous units Tables/Chairs (exactly 2 → 2D).
- **Synthetic inputs:** Profit £25/£20. Wood m² 3/2. Workshop h 2/4.
- **Objective:** Maximise 25·T + 20·C.
- **Constraints:** Wood ≤48; Workshop ≤56.
- **Engine result:** status `optimal`, objective **430**, detected type `continuous` (2 vars, 2 constraints, grid 7x5, functions none, bounds false).
- **Decision vector:** Tables=10, Chairs=9
- **Independent verification:** passed (recomputed objective 430 matches engine 430; all constraints and domains satisfied within 1e-6).
- **Why the result makes sense:** Both constraints bind at the unique vertex (10 tables, 9 chairs → £430).
- **Policy recommendation:** `exact` — externally confirmed unique optimum; **chart eligible (real F5 derivation = true)**.
- **Learning value:** The pedagogical anchor: 2D feasible region, unique optimum.

## D. Duplication audit (critical comparisons)

**ingredient-sourcing vs supplier-activation (existing).** supplier-activation is single-requirement (binary activation + integer quantities meeting one total demand). ingredient-sourcing keeps binary activation + **continuous** quantities and adds **two composition requirements** (wheat, barley) with different per-supplier fractions, so it is a blend-and-activate problem, not a demand fill. Different variable domains, different constraint family, different economic tension. **Materially distinct.**

**media-mix vs marketing-budget (existing).** media-mix adds a policy mix floor (traditional ≥30) that forces a non-greedy allocation, with reach (not return) coefficients and a different binding structure. **Materially distinct.**

**fertiliser-blend vs cheapest-feed-blend (existing).** Same blend family by design; distinct N/P/K three-requirement matrix (now expressed as coherent kg/kg fractions) where no single ingredient satisfies all three floors. **Materially distinct in structure and teaching value.**

**clinic-staffing vs call-centre vs workforce-scheduling (existing).** workforce is a 7-day start-day model; clinic is a 4-block overlapping-shift covering model; call-centre is a 5-period staggered-start model with unequal shift durations (8h vs 6h). Different period structures and coverage matrices; the two new ones are not each other relabelled. **All three materially distinct.**

**fleet-assignment vs shipping-plan / delivery-load (existing).** fleet-assignment is pure binary selection with a single capacity floor (0/1 knapsack-style), no quantity allocation, no routing. **Materially distinct.**

## E. Corrections applied in this revision

- **call-centre — shift duration semantics.** The 14:00 shift was labelled 6h while covering 14-18 and 18-22 (8h). Changed to 14:00 (8h) so coverage is honest; kept staggered starts and a real duration difference (18:00 is 6h). Re-solved: obj 4650, vector 6/8/7/3.
- **ingredient-sourcing — dimensional coherence.** Composition changed from impossible per-tonne yields (>1 t component per t input) to **fractions per tonne purchased** (Farm 0.75/0.25, Mill 0.25/0.75, Coop 0.50/0.50), requirements scaled to wheat ≥40 / barley ≥37.5. Mixed architecture (binary activation, continuous quantities, fixed costs, M=60 links, two composition requirements) preserved. Re-solved through the engine: optimum unchanged (Farm+Mill, 41.25/36.25, £5135). Headers now read as composition fractions.
- **fertiliser-blend — unit coherence.** Nutrient coefficients changed from absurd per-kg values (12kg N per 1kg) to **fractions kg/kg** (0.12, 0.08, ...), requirements scaled 600→6, 400→4, 500→5. Re-solved: optimum unchanged (34.9/2.7/16.4, £47.60).
- **scholarships — added a consequential rule.** Added **Vocational ≤ 2·Undergraduate** (neutral programme-balance: vocational places need undergraduate mentoring capacity). This materially changes the optimum (WITHOUT 9/34/5 obj 48 → WITH 15/25/5 obj 45). New real objective accepted: 45.
- **food-bank — both resources made consequential.** Recalibrated food/volunteer coefficients and caps so both bind and each, when removed, changes the optimum (food 711→766, volunteers 711→720). Kept integer parcels, neutral operational allocation, centre capacities. New objective: 711.
- **renewable-mix — renewable target now binds.** Grid made the cheapest source (30 vs 55/48), so WITHOUT the target the plan is all-grid (£30000) and WITH it the 60% target forces solar+wind (100/500/400, £41500), binding exactly at 60%. New objective: 41500.
- **hotel-rooms — OTA commitment now bites.** Direct cap raised to 60 so WITHOUT the OTA floor the solver prefers 55/0/25 (£9300) and WITH it must reserve 10 OTA (45/10/25, £9150). New objective: 9150.
- **microgrid-capacity — honest constraint semantics.** The Solar+Battery ≥ Backup constraint is renamed **Backup dependence** (backup ≤ non-backup capacity, a resilience limit); no claim that a battery is renewable generation. Maths preserved and the rule is shown consequential (WITHOUT 80/24.4/150 £22539 → WITH 80/48.4/128.4 £23126).

## F. Rule-consequence checks (WITH vs WITHOUT)

Each disputed constraint was removed and the model re-solved. All are consequential (not decoration):

| model | rule | WITH obj | WITH vector | WITHOUT obj | WITHOUT vector | matters |
|---|---|---|---|---|---|---|
| scholarships | Vocational capacity | 45 | Undergraduate=15, Vocational=25, Postgraduate=5 | 48 | Undergraduate=9, Vocational=34, Postgraduate=5 | yes |
| food-bank | Food stock (kg) | 711 | North=300, East=167, South=244 | 766 | North=300, East=249, South=217 | yes |
| food-bank | Volunteer hours | 711 | North=300, East=167, South=244 | 720 | North=300, East=140, South=280 | yes |
| renewable-mix | Min renewable | 41500 | Solar=100, Wind=500, Grid=400 | 30000 | Solar=0, Wind=0, Grid=1000 | yes |
| hotel-rooms | Min OTA | 9150 | Direct=45, OTA=10, Corporate=25 | 9300 | Direct=55, OTA=0, Corporate=25 | yes |
| microgrid-capacity | Backup dependence | 23126.315789474 | Solar=80, Battery=48.421, Backup=128.421 | 22538.888888889 | Solar=80, Battery=24.444, Backup=150 | yes |

## G. Exact-candidate uniqueness

The four `exact` candidates (bakery-mix, purchase-split, fertiliser-blend, lp-basics) had their **uniqueness confirmed externally** (a second optimiser found no equal-objective alternate vertex). The Phase-1 harness additionally confirms the returned vertex is stable/deterministic across repeated solves. We do **not** infer `exact` from determinism alone — deterministic tie-breaking is not mathematical uniqueness; the `exact` recommendation rests on the external uniqueness confirmation, and every other model stays `objective-feasible`.

- bakery-mix: obj 375, vector [Loaves=150, Rolls=150, Pastries=0] — stable across repeated solves.
- purchase-split: obj 4165, vector [Supplier A=250, Supplier B=200, Supplier C=50] — stable across repeated solves.
- fertiliser-blend: obj 47.602739726, vector [Blend X=34.932, Blend Y=2.74, Blend Z=16.438] — stable across repeated solves.
- lp-basics: obj 430, vector [Tables=10, Chairs=9] — stable across repeated solves.

## H. Independent verification, chart eligibility, numerical/unit audit

- **Verification (15/15):** an independent verifier recomputes every complete constraint (coefficients·values + constant vs limit) and the objective (by substituting solved values into the objective cell and evaluating its arithmetic), and checks domain compliance (finite, non-negative, integer where integer, 0/1 where binary, bounds respected). All 15 pass within 1e-6. This does not trust the engine status.
- **Chart eligibility:** uses the real F5 `deriveChartEligible` (modelType continuous AND exactly 2 decision cells). Only **lp-basics** qualifies (true); the other 14 are false. No proxy on `variables.length`.
- **Double-solve determinism (15/15):** strict comparison — identical variable key set, all values finite, every value equal within 1e-6, same status, objective within 1e-6. No `|| 0` fallback that could hide a missing or NaN decision.
- **Numerical/unit audit:** no negative decisions, no 1e-12 noise presented as a quantity, no absurd magnitudes. Composition and nutrient coefficients are now dimensionally coherent fractions. The only Big-M (ingredient-sourcing links) uses M=60 = the real per-supplier tonnage cap.
- **Type contract:** for each model the engine-detected type, the authored `rec.type`, and an independent reserved-type map must all agree (guards against authored metadata drifting from the engine or from the checkpoint contract).
