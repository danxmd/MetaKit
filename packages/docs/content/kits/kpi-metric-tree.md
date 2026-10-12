---
id: kpi-metric-tree
title: KPI and metric tree
category: kits
summary: A built-in Kit for metric trees, where outcome KPIs are explained by driver metrics and operational metrics, each with a target, a current value and a direction.
keywords: [kpi, metric, metric tree, kpi tree, driver tree, outcome, driver metric, operational metric, target, baseline, on track, attainment, weight]
contexts: []
order: 30
---

**KPI and metric tree** is a built-in Kit for showing how the numbers an organisation is judged by depend on the numbers its teams can change.

## What it is

A metric tree has three levels. **Outcome KPIs** are the results that matter, such as revenue. **Driver metrics** explain them, such as conversion rate. **Operational metrics** are measures of daily work that a team can change directly, such as page load time. **Drives** connectors link each metric to the one it explains. A goal at the top can be measured by the outcome KPIs.

Every metric has a target, a current value and a direction (higher or lower is better). Its fill is green when it is on track, red when it is not, and grey when a value is missing.

| Class | What it stands for |
| --- | --- |
| **Goal** | Something the organisation wants to achieve. From the class catalog ([[class-catalog]]). |
| **Outcome KPI** | A result the organisation is judged by. A large hexagon. |
| **Driver metric** | A metric that explains an outcome KPI or another driver. A rounded box. |
| **Operational metric** | A measure of day-to-day work. A pill. |

The three kinds of metric share the attributes of **KPI**, an abstract class from the catalog that is never drawn itself: **Unit**, **Owner**, **Frequency**, **Direction**, **Baseline**, **Planned change**, **Target** and **Current**.

| Relation class | From | To | Attributes |
| --- | --- | --- | --- |
| **Drives** | Driver metric, Operational metric | Outcome KPI, Driver metric | **Weight** (%), shown on the line, and **Effect** (Raises or Lowers) |
| **Measures** | Any metric | Goal | |

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Online store growth" is `kits/kpi-metric-tree/online-store.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Metric tree**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Place a **Goal** and the **Outcome KPIs** that measure it; connect them with **Measures**.
4. Add **Driver metrics** below and connect each to the KPI it explains with **Drives**. Set the **Weight** to say how much of it the driver explains.
5. Add **Operational metrics** below the drivers in the same way.
6. For each metric fill in **Unit**, **Direction** and either a fixed **Target**, or a **Baseline** and a **Planned change** in percent. Then enter the **Current** value on the **Target** tab ([[attribute-panel]]).
7. Open the Problems panel ([[problems-panel]]) to find metrics that drive nothing or have no target.

## Every option explained

### Calculated values

| Value | How it is calculated |
| --- | --- |
| **Target used** | The **Target** when it is filled in; otherwise the **Baseline** changed by the **Planned change**. A baseline of 40 with a planned change of 15 gives 46. |
| **On track** | Yes when **Current** has reached the target used, in the direction of the metric. |
| **Attainment (%)** | How much of the target is reached. For "Lower is better" it is target divided by current, so above 100 is always better than the target. |
| **Current and target** | For example "43.5 million, target 46". It is shown under the name on the diagram. |
| **Drivers** | How many metrics drive this one. |

### Checks in the Problems panel

All are warnings ([[constraints]], [[model-types]]):

- every metric has a target, fixed or derived;
- an outcome KPI has at least one driver metric;
- a driver metric and an operational metric drive something;
- the model has at least one outcome KPI.

### Behaviour

**Warn when a metric goes off track** (a rule, [[rules]]): when someone enters a **Current** value that is off track, a warning names the metric, for example ""Conversion rate" is off track: 2.9 %, target 3.2."

### Model type and views

**Metric tree** holds all classes. Its palette view **Outcomes** offers goals, outcome KPIs and driver metrics, with **Measures** and **Drives**.

## Examples

In the sample, **Online revenue** has a baseline of 40 million and a planned change of 15%, so its target is 46. The current value is 43.5: it is off track, at 94.6% of target, and drawn red. Its drivers show why: **Conversion rate** is off track, while **Average order value** and **Returning customers** are on track. Below conversion, **Checkout page load time** (2.6 seconds against a target of 2, lower is better) is off track too.

The sample shows one warning on purpose: **Social media followers** drives nothing. A metric that explains nothing above it may not be worth reporting; connect it to what it drives, or remove it.

## Good to know

- **Weights are not checked.** The weights of the drivers of one metric do not have to add up to 100; they are there to read.
- **Effect** says whether more of a metric raises or lowers the one it drives. "Checkout page load time" lowers "Conversion rate".
- Use the [[data-ai-strategy]] Kit to connect the goals to initiatives and benefits.

## Related

[[built-in-kits]] · [[data-ai-strategy]] · [[data-ai-maturity]] · [[computed-values]] · [[formula-reference]] · [[rules]]
