---
id: data-governance
title: Set up data ownership and governance
category: tutorials
summary: Use the Data governance and ownership tool to record who owns and looks after your data, check it for gaps, and read the quality score of each data asset.
keywords: [data governance tutorial, data ownership, data steward, data custodian, check governance, quality score, raci view]
contexts: []
order: 370
---

**Goal:** model two business domains with their data, give every data product an owner, and let MetaKit find what is still missing.

## What it is

**Data governance and ownership** is a tool library that comes with MetaKit, in the repository folder `tools/data-governance/`. It describes who is responsible for which data, which rules apply to it and how good it is.

| Class | What it stands for |
| --- | --- |
| **Data domain** | An area of the business, such as Sales. A container for its products, assets and glossary terms. |
| **Data product** | Data a team publishes for others, with a status, a service level and consumers. |
| **Data asset** | A table, file, stream, report or model. Its fill shows its classification; a red border means it holds personal data. |
| **Person** | Someone who takes part. Their roles come from their connectors. |
| **Glossary term** | A business word with an agreed meaning. |
| **Policy** | An access, retention, privacy, quality or usage rule. |
| **Classification** | A sensitivity level (Public, Internal, Confidential, Restricted) and how to handle it. |
| **Quality rule** | A measurable check with a threshold and the last result. |

The relation classes are **Owns**, **Stewards** and **Custodian of** (the three roles), **Governed by**, **Classified as**, **Defines**, **Checks**, **Consumes** and **Contains**.

## Where to find it

The tool library is built in ([[built-in-tools]]): its card is in the **Built-in** section of the Tool libraries page. The sample model "Sales and finance domains" is `tools/data-governance/sales-finance.mkmodel.json`.

## How to use it

**Before you start:** a workspace folder is open (see [[concepts-workspace]]).

1. On the Tool libraries page, on the **Data governance and ownership** card under **Built-in**, choose **Use in this workspace** ([[page-tool-libraries]]).
2. On the Models page choose **Import / Export**, then **Import file(s)…**, and pick `sales-finance.mkmodel.json` ([[import-export]]). Open the model.
3. Open the Problems panel ([[problems-panel]]). It shows two warnings:
   - "Data product "Sales pipeline" has 0 Owns entering it, but needs at least 1." The model type asks for exactly one owner per data product.
   - "A restricted data asset, or a confidential one with personal data, needs a policy ("Governed by")." This is about **Payroll file**.
4. Fix the first one. Pick **Owns** in the palette and draw a connector from **Amira Haddad** to **Sales pipeline** ([[connecting-objects]]). The warning goes away.
5. Fix the second one. Draw a **Governed by** connector from **Payroll file** to **Financial records access**.
6. Choose **Commands**, then **Check governance** ([[menu-commands]]). The message lists what is still open: the failing quality rule "Dashboard matches ledger" and the glossary term "Fiscal period", which defines no data yet.
7. Select **Dashboard matches ledger** and set **Last result** to 99.5. Its "Fail" badge goes away, and the **Quality score** of **Revenue dashboard** changes from 0 to 100 ([[computed-values]]).
8. Choose **View**, then **Palette view**, then **RACI** ([[menu-view]]). The palette now offers only **Person**, **Data product**, **Data asset** and the three role relations, which is all you need to assign responsibilities. Objects already on the canvas stay visible.

**Check:** the Problems panel is empty, and **Check governance** reports the unused term only.

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Data asset | **Quality score** | The share of the quality rules that check the asset and pass, from 0 to 100. Empty when no rule checks it. |
| Data product | **Owner**, **Steward** | The names of the people with an Owns or a Stewards connector to it. |
| Person | **Responsibilities** | How many things the person owns, stewards or looks after. |
| Quality rule | **Passing**, **Outcome** | Passing when **Last result** is at least **Threshold**. Outcome is "Passing", "Failing" or "Not run". |

### Checks in the Problems panel

All are warnings ([[constraints]], [[model-types]]):

- every data product has exactly one owner;
- a published data product has a steward;
- a restricted data asset, or a confidential one with personal data, is governed by a policy;
- a data asset with personal data has a retention period;
- the Classification attribute of an asset matches the classification it is linked to;
- a quality rule checks at least one data asset;
- an approved glossary term has a definition;
- the review date of a policy comes after its effective date.

### Behaviour

- **Check governance** (a script, [[scripts]]): lists data products without one owner, sensitive assets without a policy, quality rules that fail or check nothing, and unused glossary terms.
- **Warn when a quality rule fails** (a rule, [[rules]]): when someone enters a **Last result** below the threshold, a warning names the rule.

### Model types and views

- **Governance** holds all classes. A data domain accepts data products, data assets and glossary terms. Palette views: **RACI** (people, data products, data assets and the role relations) and **Quality** (domains, assets and quality rules with **Checks**).
- **Business glossary** holds glossary terms and the data they define.

## Examples

In the sample, **General ledger** is checked by two rules: "Ledger balances" passes and "Dashboard matches ledger" fails, so its quality score is 50.

## Good to know

- **Roles are connectors.** A person is not an owner by an attribute; they are an owner of what their Owns connectors point to. One person can own one product and steward another.
- **Change the look.** Every shape is a simple look, so Build mode's simple look editor can change forms and colours ([[appearance-editor]]).

## Related

[[tutorials-index]] · [[problems-panel]] · [[computed-values]] · [[constraints]] · [[scripts]] · [[menu-commands]]
