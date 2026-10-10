---
id: privacy-ropa
title: Privacy and records of processing
category: kits
summary: A built-in Kit for records of processing activities, with purposes and legal bases, data categories including special categories, data subjects, recipients and transfers to other countries, retention, systems and an indication of when an impact assessment is likely needed.
keywords: [privacy register, records of processing, ropa, processing activity, personal data, purpose, legal basis, special category, data subject, recipient, transfer, safeguard, retention period, impact assessment, dpia, data protection]
contexts: []
order: 100
---

**Privacy and records of processing** is a built-in Kit for keeping a record of what an organisation does with personal data: why, on what basis, about whom, who receives it, where it goes, how long it is kept and in which systems.

## What it is

Each **processing activity** is one entry of the records. It serves one or more **purposes**, each resting on a **legal basis**; it **processes** categories of personal data **about** groups of people; it **discloses** data to **recipients**, some of them in other countries; it is **kept for** a time set by a **retention rule**; and it **uses** systems.

The Kit also counts the criteria that, in many privacy guidelines, call for a data protection impact assessment when two or more apply. The result is an indication for the privacy team, **not legal advice**: check what the law that applies to you requires.

| Class | What it stands for |
| --- | --- |
| **Processing activity** | Something done with personal data, with its owner, role (controller, joint controller or processor), the impact criteria and the status of the impact assessment. The fill shows the indication: red likely needed, yellow consider, green unlikely. |
| **Purpose** | Why the data is used. Its legal basis is shown under its name. |
| **Legal basis** | Consent, contract, legal obligation, vital interests, public task or legitimate interests, with the rule it rests on and notes. |
| **Data category** | A kind of personal data, with its **Sensitivity**: ordinary, special category (such as health or religion) or criminal offence data. Special categories are drawn red. |
| **Data subject** | A group of people the data is about, such as patients, and whether they are vulnerable. |
| **Recipient** | Who receives the data: internal, a processor, another controller or a public authority, with the country, whether it is a transfer to another country and the safeguard. A transfer has a red border. |
| **Retention rule** | How long data is kept, counted from when, and whether it is then deleted, anonymised or archived. |
| **System** | A system in which the data is kept or used. The catalog's **Application** ([[class-catalog]]). |

| Relation class | From | To |
| --- | --- | --- |
| **For purpose** | Processing activity | Purpose |
| **Relies on** | Purpose | Legal basis |
| **Processes** | Processing activity | Data category |
| **About** | Processing activity | Data subject |
| **Discloses to** | Processing activity | Recipient |
| **Kept for** | Processing activity | Retention rule |
| **Uses system** | Processing activity | System |

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Records of processing" is `kits/privacy-ropa/hospital-records.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Records of processing**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Place one **Processing activity** per row. Fill in its owner and role.
4. On the left, add its **Purposes** and their **Legal bases**, connected with **For purpose** and **Relies on**.
5. On the right, add the **Data categories** and **Data subjects**, connected with **Processes** and **About**. Use one object per category and group, and connect it to every activity that uses it.
6. Below, add the **Recipients**, the **Retention rule** and the **Systems**. For a recipient abroad tick **Transfer to another country** and choose the **Safeguard**.
7. On the **Impact assessment** tab of the activity ([[attribute-panel]]), tick the criteria that apply and set the status of the assessment.
8. Open the Problems panel ([[problems-panel]]) to see what is missing.

## Every option explained

### The impact criteria

Two of the six criteria come from the connected objects; four are ticked on the activity.

| Criterion | Where it comes from |
| --- | --- |
| **Sensitive data** | A connected data category is a special category or criminal offence data. |
| **Vulnerable subjects** | A connected data subject is marked vulnerable. |
| **Large scale** | Ticked on the activity. |
| **Automated decisions** | Ticked: decisions with legal or similarly important effects are made without a person. |
| **Systematic monitoring** | Ticked: people are observed or tracked in a planned way. |
| **New technology** | Ticked: new or innovative technology is used. |

**Impact criteria met** counts them. **Impact assessment indication** is "Likely needed" from two, "Consider" with one and "Unlikely" with none.

### Other calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Processing activity | **Purposes**, **Legal bases**, **Retention** | Read from the connected purposes, their legal bases and the retention rules. |
| Processing activity | **Transfers to other countries** | Yes when a recipient is marked as a transfer. |
| Purpose | **Legal basis** | The basis of the legal bases it relies on. |
| Recipient | **Transfer text** | The country and the safeguard of a transfer, or the type of recipient. |
| The model | **Activities** | How many processing activities are recorded. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a processing activity has a purpose, a data category and a retention rule;
- an activity whose indication is "Likely needed" has an impact assessment in progress or done;
- a purpose relies on a legal basis;
- a recipient that receives data in another country has a safeguard other than "None yet".

### Model type and views

**Records of processing** holds all classes. Its palette views are **Purposes and legal bases** and **Data, people and recipients** ([[model-types]]).

### Panels

A processing activity has **Activity** and **Impact assessment** tabs ([[panel-layout]]).

## Examples

The sample is the records of a hospital group. **Patient care records** processes health data (a special category) about patients (vulnerable) on a large scale: three criteria, so an impact assessment is likely needed, and it is done. **Staff payroll** meets none; its payroll provider in a neighbouring country is covered by standard contractual clauses.

The sample shows two warnings on purpose: **Appointment reminders** meets three criteria but its impact assessment has not started, and the **Text message service** receives data overseas without a safeguard.

## Good to know

- **Not legal advice.** The criteria and the indication help to spot what to look at. Whether an assessment is required, and which legal basis fits, is for your privacy officer or lawyer to decide.
- **Generic wording.** Names of laws and authorities are free text in **Reference** and **Country**; the Kit names none.
- **Systems** links the records to your application landscape. For data flows between systems, use the [[data-pipelines-lineage]] Kit; for classifications and policies, see the Data governance tutorial ([[data-governance]]).

## Related

[[built-in-kits]] · [[data-governance]] · [[data-pipelines-lineage]] · [[computed-values]] · [[constraints]] · [[attribute-panel]]
