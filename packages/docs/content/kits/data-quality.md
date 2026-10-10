---
id: data-quality
title: Data quality management
category: kits
summary: A built-in Kit for data quality, with rules and thresholds on data assets, quality dimensions, the results of the last checks, issues with severity, status and owner, and the actions that resolve them.
keywords: [data quality, quality rule, threshold, quality dimension, completeness, validity, uniqueness, timeliness, pass rate, data quality issue, remediation, data asset]
contexts: []
order: 70
---

**Data quality management** is a built-in Kit for managing the quality of important data: which rules check it, how the last checks went, which problems were found, who owns them and what is being done about them.

## What it is

A **data quality rule** checks the records of a **data asset** and measures a **quality dimension**. Its last check gives a result: the share of records that passed. When the result reaches the rule's threshold, the rule passes and is drawn green; otherwise it is drawn red. Data assets and dimensions add up the results of their rules. **Issues** found by the rules have a severity, a status and an owner, and **remediation actions** resolve them.

| Class | What it stands for |
| --- | --- |
| **Quality dimension** | An aspect of quality, such as completeness, validity, uniqueness or timeliness, with a target score. Green when its score reaches the target, red when not. |
| **Data quality rule** | A check every record must pass, with its expression, threshold, owner and frequency, and the last check: its date, the records checked and the records that failed. From the class catalog ([[class-catalog]]). |
| **Data asset** | A table, file or other set of data, with its owner and how critical it is. The header colour shows its quality level. The catalog's **Dataset**. |
| **Data quality issue** | A problem in the data, with severity, status, owner, due date, the records affected and the root cause. The fill shows the status: red open, yellow in progress, green resolved, grey closed. The catalog's **Issue**. |
| **Remediation action** | Work that resolves an issue: fix the data, fix the source, change the process or change the rule, with owner, status, due date and effort. |
| **Data steward** | The person who looks after a set of data day to day. From the class catalog. |

| Relation class | From | To |
| --- | --- | --- |
| **Checks** | Data quality rule | Data asset |
| **Measures** | Data quality rule | Quality dimension |
| **Found by** | Data quality issue | Data quality rule |
| **Affects** | Data quality issue | Data asset |
| **Resolves** | Remediation action | Data quality issue |
| **Stewards** | Data steward | Data asset |
| **Flows to** | Data asset | Data asset |

**Stewards** and **Flows to** come from the class catalog with the data asset; draw **Flows to** to show which asset is made from which.

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Customer and account data quality" is `kits/data-quality/bank-customer-data.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Data quality**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Place the **Quality dimensions** you use at the top and give each a **Target score**.
4. Add a **Data quality rule** for each check, with its **Threshold**. Connect it to the data asset it checks with **Checks** and to its dimension with **Measures**.
5. After each check, enter the **Last check** date, the **Records checked** and the **Records failed** on the **Last check** tab ([[attribute-panel]]). The result and the colour follow.
6. Record each **Data quality issue**, connect it to the rule that found it and the assets it affects, and give it an owner.
7. Add **Remediation actions** and connect them to the issues they resolve.
8. Open the Problems panel ([[problems-panel]]) to find serious issues that nobody is working on.

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Data quality rule | **Dimension** | The names of the dimensions it measures. |
| Data quality rule | **Last result (%)** | (records checked − records failed) ÷ records checked × 100. |
| Data quality rule | **Passing** | Yes when the last result reaches the threshold. |
| Data quality rule | **Counts as passed** | 1 when it passes and 0 when it fails, so data assets can count passing rules. |
| Data asset | **Rules**, **Rules passed** | How many rules check it, and how many of them pass. |
| Data asset | **Pass rate (%)** | Passing rules ÷ checked rules × 100. |
| Data asset | **Quality score (%)** | The average last result of its rules. |
| Data asset | **Quality level** | Good when every rule passes, Fair when at least half pass, otherwise Poor. |
| Data asset | **Open issues** | How many issues affecting it are not resolved or closed. |
| Quality dimension | **Score**, **On target** | The average last result of its rules, and whether it reaches the target. |
| Data quality issue | **Counts as open**, **Actions** | 1 while it is open; how many actions work on it. |
| Data quality issue | **Overdue** | Yes when the due date has passed and it is still open. |
| The model | **Overall pass rate (%)**, **Open issues** | Over all rules and all issues. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- an open issue has an owner;
- an open issue of high or critical severity has at least one remediation action;
- a data asset of high criticality is checked by at least one rule;
- a rule checks a data asset;
- a rule has no more failed records than checked ones;
- a remediation action resolves an issue.

### Model type and views

**Data quality** holds all classes. Its palette views are **Rules and results** (dimensions, rules and data assets) and **Issues and actions** (issues, actions, data assets and stewards) ([[model-types]]).

### Panels

A rule has **Rule** and **Last check** tabs; an issue **Issue** and **Details** ([[panel-layout]]).

## Examples

The sample is the customer and account data of a retail bank. **Email is well formed** checked 980,000 records and 31,000 failed: a result of 96.84%, below its threshold of 98%, so it is red. With **One customer per national id** also failing, only one of the three rules on **Customers** passes: a pass rate of 33.3% and the quality level Poor, although the quality score is 98.9%. The pass rate says how many promises are kept; the score says how close the data is overall.

The sample shows one warning on purpose: **Duplicate customers after a branch merger** is critical and no remediation action works on it yet.

## Good to know

- **Results are entered, not measured.** MetaKit does not run the checks. Enter the counts of the last run, or copy them from your quality tool.
- **Thresholds are percentages** from 0 to 100. A threshold of 100 means no record may fail.
- **Overdue** compares the due date with today, so it can change from one day to the next; it is shown, not checked.
- To show where the checked data comes from, use the [[data-pipelines-lineage]] Kit; for ownership and policies, see the Data governance tutorial ([[data-governance]]).

## Related

[[built-in-kits]] · [[data-governance]] · [[data-pipelines-lineage]] · [[data-mesh]] · [[computed-values]] · [[constraints]]
