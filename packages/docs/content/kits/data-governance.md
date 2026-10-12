---
id: data-governance
title: Data governance and ownership
category: kits
summary: A built-in Kit for who owns, stewards and looks after which data, with data domains, data products and assets, policies, classifications, glossary terms and quality rules, and checks for what is still missing.
keywords: [governance kit, glossary term, business glossary, governed by, classified as, custodian of, data owner]
contexts: []
order: 36
---

**Data governance and ownership** is a built-in Kit for recording who is responsible for which data, which rules apply to it, what its words mean and how good it is. Its checks point out data without an owner, sensitive data without a policy and quality rules that fail.

## What it is

| Class | What it stands for |
| --- | --- |
| **Data domain** | An area of the business that is responsible for its own data, such as Sales or Finance, with a domain lead. A dashed container for its data products, data assets and glossary terms. |
| **Data product** | Data a team publishes for others, with a status (Draft, Published or Deprecated), a service level, its consumers and a classification. A blue hexagon coloured by its status. |
| **Data asset** | A table, file, stream, report or model, with a classification, whether it contains personal data, and a retention period. A box with a header coloured by its classification, listing its kind and quality score; the border is red when it holds personal data. |
| **Person** | Someone who takes part in governance, with an email and a team. Their roles come from their connectors. |
| **Glossary term** | A business word with a definition, synonyms and a status (Draft or Approved). A document. |
| **Policy** | An access, retention, privacy, quality or usage rule, with an effective date and a review date. A violet document. |
| **Classification** | A sensitivity level (Public, Internal, Confidential or Restricted) and how to handle it. A pill with a lock. |
| **Quality rule** | A measurable check in one dimension (completeness, validity, uniqueness, timeliness, accuracy or consistency), with a threshold and the last result. Green when it passes, red with a "Fail" mark when it fails. |

| Relation class | From | To |
| --- | --- | --- |
| **Owns** | Person | Data product, Data asset, Data domain |
| **Stewards** | Person | Data product, Data asset |
| **Custodian of** | Person | Data asset |
| **Governed by** | Data product, Data asset | Policy |
| **Classified as** | Data asset | Classification |
| **Defines** | Glossary term | Data asset, Data product |
| **Checks** | Quality rule | Data asset |
| **Consumes** | Data product | Data product |
| **Contains** | Data product | Data asset |

**Consumes** has a **Purpose**, shown on the line.

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Sales and finance domains" is `kits/data-governance/sales-finance.mkmodel.json` in the MetaKit repository. The tutorial [[tutorial-data-governance]] fixes the warnings of the sample step by step.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Governance**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Draw a **Data domain** for each area of the business ([[containers-swimlanes]]).
4. Inside each domain place its **Data products**, **Data assets** and **Glossary terms**. Connect each product to the assets it is made of with **Contains**.
5. Place the **People** and connect them with **Owns**, **Stewards** and **Custodian of** ([[connecting-objects]]).
6. Add the **Policies** and **Classifications** and connect the sensitive assets to them with **Governed by** and **Classified as**.
7. Add **Quality rules**, connect each to the assets it checks, and fill in **Last result** when a check has run.
8. Open the Problems panel ([[problems-panel]]) and run **Check governance** from the **Commands** menu to see what is still missing ([[menu-commands]]).

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Data product | **Owner**, **Steward** | The names of the people with an **Owns** or a **Stewards** connector to it. |
| Data asset | **Quality score** | The share of the quality rules that check it and pass, from 0 to 100. Empty when no rule checks it. |
| Person | **Responsibilities** | How many things the person owns, stewards or is custodian of. |
| Quality rule | **Passing**, **Outcome** | Passing when **Last result** is at least **Threshold**; Outcome is "Passing", "Failing" or "Not run". |

See [[computed-values]].

### Checks in the Problems panel

All are warnings ([[constraints]], [[model-types]]):

- every data product has exactly one owner;
- a published data product has a steward;
- a restricted data asset, or a confidential one with personal data, is governed by a policy;
- a data asset with personal data says how long it is kept;
- the classification of a data asset matches the classification it is linked to;
- a quality rule checks at least one data asset;
- an approved glossary term has a definition;
- the review date of a policy comes after its effective date.

A **Business glossary** model also warns while it has no glossary term.

### Behaviour

| Command or rule | Where | What it does |
| --- | --- | --- |
| **Check governance** | **Commands** menu | A script ([[scripts]]): lists data products without exactly one owner, sensitive assets without a policy, quality rules that fail or check nothing, and glossary terms that define nothing. |
| **Warn when a quality rule fails** | When **Last result** changes | A rule ([[rules]]): a warning names the rule when the result is below its threshold. |

### Model types and views

- **Governance** holds all classes. A data domain accepts data products, data assets and glossary terms. Its palette views are **RACI** (people, data products and data assets with the three role relations) and **Quality** (domains, data assets and quality rules with **Checks**) ([[model-types]]). The model has a **Title** and a **Scope**.
- **Business glossary** holds data domains, glossary terms, data products and data assets with **Defines**.

### Panels

A data product shows the tabs **Product** and **Use**, a data asset **Asset** and **Protection**; the other classes have one tab each ([[panel-layout]]).

## Examples

The sample has two domains, Sales and Finance, with four data products, eight data assets, five people and five quality rules. **General ledger** is checked by two rules: "Ledger balances" passes and "Dashboard matches ledger" fails, so its quality score is 50.

The sample shows two warnings on purpose: the data product **Sales pipeline** has no owner, and the restricted **Payroll file** has no policy. Draw **Owns** from a person to Sales pipeline and **Governed by** from Payroll file to a policy, and the Problems panel is empty.

## Good to know

- **Roles are connectors.** A person is an owner of what their **Owns** connectors point to, not by an attribute. One person can own one product and steward another.
- **Classification twice.** The **Classification** attribute colours an asset; the **Classified as** connector links it to the handling rules. The check makes sure the two agree.
- For data products with ports and contracts, see the [[data-mesh]] Kit; for quality issues and their remediation, the [[data-quality]] Kit.

## Related

[[built-in-kits]] · [[tutorial-data-governance]] · [[data-mesh]] · [[data-quality]] · [[privacy-ropa]] · [[constraints]]
