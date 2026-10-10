---
id: ai-risk-compliance
title: AI risk and compliance
category: kits
summary: A built-in Kit for a register of AI systems, with their intended purpose, a risk tier, risks and controls, obligations, assessments, incidents, owners and evidence.
keywords: [ai risk, ai compliance, ai register, ai system, risk tier, intended purpose, obligation, control, residual risk, ai impact assessment, ai incident, evidence, owner, governance]
contexts: []
order: 120
---

**AI risk and compliance** is a built-in Kit for keeping a register of the AI systems an organisation builds or uses: what each is for, how risky it is, what reduces the risk, which obligations apply and how they are met, and the evidence for all of it.

## What it is

Each **AI system** has an intended purpose and a **risk tier**: Minimal, Limited, High or Unacceptable. The tiers are generic; map them to the rules that apply to your organisation. A system **has risks**, which **controls** mitigate. It is **subject to obligations**, which controls **satisfy**. **Evidence** proves that controls work. **Assessments** review a system, **incidents** record what went wrong, and **people** own systems, risks, controls and obligations.

The Kit helps you organise the work. It does not decide which tier a system is in or what the law requires, and it is not legal advice.

| Class | What it stands for |
| --- | --- |
| **AI system** | A system that uses AI, with its intended purpose, foreseeable misuse, risk tier, lifecycle stage and sourcing. |
| **Risk** | Something that may go wrong, with a category, likelihood and impact from 1 to 5, an owner and a status. |
| **Control** | A measure that prevents or detects a problem, with its effectiveness and when it was last tested. |
| **Obligation** | A requirement from a law or regulation, an industry standard, a contract or an internal policy, with a free-text reference. |
| **Assessment** | A review such as an impact assessment or a fairness test, with its status and outcome. |
| **Incident** | Something that went wrong, with its severity, status and root cause. |
| **Evidence** | A record such as a test result, log, sign-off or screenshot, with a link. |
| **Person** | Someone who owns systems, risks, controls or obligations. |

| Relation class | From | To |
| --- | --- | --- |
| **Has risk** | AI system | Risk |
| **Mitigates** | Control | Risk |
| **Subject to** | AI system | Obligation |
| **Satisfies** | Control | Obligation |
| **Proves** | Evidence | Control, Assessment |
| **Assesses** | Assessment | AI system |
| **Concerns** | Incident | AI system |
| **Owns** | Person | AI system, Risk, Control, Obligation |

Risk, Control, Person, **Mitigates** and **Owns** come from the class catalog ([[class-catalog]]).

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "AI register 2027" is `kits/ai-risk-compliance/recruitment-register.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **AI risk register**, or import the sample ([[import-export]]).
3. Add each **AI system**, describe its intended purpose and choose its **risk tier** and **lifecycle stage**. Connect its owner with **Owns**.
4. Add its **risks** with **Has risk**, and score their likelihood and impact.
5. Add **controls**, connect them to the risks they reduce with **Mitigates**, and set how effective they are.
6. Add the **obligations** a system is **subject to**, and connect the controls that **satisfy** them.
7. Attach **evidence** to controls with **Proves**, record **assessments** and **incidents**.
8. Open the Problems panel ([[problems-panel]]) to see the gaps.

## Every option explained

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Score**, **Rating** | Risk | Likelihood × impact, from 1 to 25. High from 15, Medium from 8, otherwise Low. |
| **Reduction** | Control | 2 when effective, 1 when partly effective, otherwise 0. |
| **Residual likelihood** | Risk | The likelihood minus the reductions of the controls that mitigate it, at least 1. |
| **Residual score**, **Residual rating** | Risk | Residual likelihood × impact, rated in the same way. The fill of the risk shows the residual rating. |
| **Highest risk before controls**, **after controls** | AI system | The highest score and residual score of its risks. |
| **Open obligations** | AI system | How many of its obligations no control satisfies yet. |
| **Assessed** | AI system | Yes when at least one assessment of it is completed. |
| **Owner**, **Open incidents** | AI system | Its owners, and how many of its incidents are not closed. |
| **Covered** | Obligation | Yes when a control satisfies it; the fill turns green, otherwise red. |
| **Evidence** | Control | How many pieces of evidence prove it. |
| **Systems**, **Open incidents**, **Uncovered obligations** | The model | Counts over the whole register. |

The fill of an AI system shows its tier: green for minimal, yellow for limited, orange for high and red for unacceptable.

### Checks in the Problems panel

- an AI system in the **unacceptable** tier that is in development or in use (an error);
- an AI system in the **high** tier with no completed assessment;
- an AI system with no risk tier, no owner, or above the minimal tier with no recorded risk (while it is in development or in use);
- a risk rated medium or high that no control mitigates, or that is still high after its controls and not accepted;
- a control marked effective without evidence, or one that mitigates no risk and satisfies no obligation;
- an obligation of a system that no control satisfies;
- an assessment that assesses no system, or is completed without an outcome;
- an incident that concerns no system, or is closed without a root cause;
- evidence that proves nothing.

All but the first are warnings ([[constraints]]).

### Model type and views

**AI risk register** holds all classes. Its views are **Risks and controls**, **Compliance** and **Incidents** ([[model-types]]).

## Examples

In the sample, a recruitment agency keeps four AI systems in its register. "Candidate ranking" is in the high tier: its risk of unfair ranking scores 20, but two effective controls, a recruiter reviewing every shortlist and a quarterly fairness test, bring it down to 5. Both obligations of the system are covered. The chat assistant is in the limited tier, and a notice at the start of each chat satisfies the obligation to tell people they talk to AI. "Emotion reading in video interviews" is in the unacceptable tier; it stays an idea, so there is no error.

The sample shows one warning on purpose: the impact assessment of "Candidate ranking" is only planned, so the high-tier system has no completed assessment.

## Good to know

- **The tiers are generic.** Decide with your legal and compliance experts which tier a system is in and which obligations apply; record the source as free text in **Reference**.
- **Residual scores are a rule of thumb**, so that controls show their effect. Adjust likelihood and impact by hand when you know better.
- Use the [[ml-lifecycle]] and [[genai-solution]] Kits to model how the systems are built and run.

## Related

[[built-in-kits]] · [[ml-lifecycle]] · [[genai-solution]] · [[data-governance]] · [[constraints]] · [[computed-values]]
