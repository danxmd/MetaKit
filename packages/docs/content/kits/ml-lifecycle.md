---
id: ml-lifecycle
title: ML lifecycle (MLOps)
category: kits
summary: A built-in Kit for the life of a machine learning model, from data and experiments to versions, evaluations, approvals, deployments, monitoring and retraining.
keywords: [mlops, machine learning, ml lifecycle, model registry, model version, training run, experiment, feature store, evaluation, threshold, approval gate, deployment, environment, monitor, drift, latency, incident, retraining]
contexts: []
order: 100
---

**ML lifecycle (MLOps)** is a built-in Kit for showing how a machine learning model is built, released and kept healthy: which data it learns from, which run made which version, whether that version passed its tests and was approved, where it runs and what watches it.

## What it is

The Kit follows a model through its life. A **use case** states the business problem. **Datasets** and **features** feed **training runs**, which sit inside an **experiment**. A run produces a **model version** in the **model registry**. **Evaluations** test the version against thresholds and **approval gates** record who allowed it to go further. A **deployment** runs one version inside an **environment**. **Monitors** watch the deployment and raise **incidents**, which can lead to retraining.

| Class | What it stands for |
| --- | --- |
| **AI use case** | The business problem the model is for, with value and feasibility from 1 to 5, a business metric and an owner. |
| **Dataset** | A table or set of files, with format, refresh, classification and version. |
| **Feature store** | A container for features shared between training and predictions. |
| **Feature** | One input value a model learns from. |
| **Experiment** | A container for training runs that are compared on one metric, such as AUC. |
| **Training run** | One training with an algorithm, parameters, a duration, a compute cost and a score. |
| **Model registry** | A container for models and their versions. |
| **ML model** | A model in the registry: one prediction task, such as classification. |
| **Model version** | One trained version, with its stage: Candidate, Staging, Production or Archived. |
| **Evaluation** | A test of a version, such as accuracy or fairness, with a score, a threshold and a direction. |
| **Approval gate** | A decision by a person or board about a version: Pending, Approved or Rejected. |
| **Environment** | A container for the deployments of one stage, such as test or production. |
| **Model deployment** | A version running where others can call it, with its status and endpoint. |
| **Monitor** | A watch on a deployment for drift, latency, cost or quality, with a threshold and the current value. |
| **Incident** | Something that went wrong with a running model, with its severity, status and response. |

| Relation class | From | To |
| --- | --- | --- |
| **Uses model** | AI use case | ML model |
| **Addresses** | Experiment | AI use case |
| **Derived from** | Feature | Dataset |
| **Trains on** | Training run | Dataset, Feature |
| **Produces** | Training run | Model version |
| **Version of** | Model version | ML model |
| **Evaluates** | Evaluation | Model version |
| **Approves** | Approval gate | Model version |
| **Deployed as** | Model version | Model deployment |
| **Monitors** | Monitor | Model deployment |
| **Raises** | Monitor | Incident |
| **Leads to** | Incident | Experiment, Training run |

AI use case, Dataset, Feature, ML model, Evaluation, Model deployment, Monitor and Environment come from the class catalog ([[class-catalog]]), with attributes added for this Kit.

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Customer churn model" is `kits/ml-lifecycle/churn-model.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **ML lifecycle**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Place the **AI use case**, the **datasets** and a **feature store** with its **features**. Connect each feature to its dataset with **Derived from**.
4. Draw an **experiment**, set its **Metric** and **Direction**, and place the **training runs** inside it ([[containers-swimlanes]]). Connect each run to its data with **Trains on** and fill in its **Score**.
5. Draw a **model registry** with the **ML model** and its **model versions** inside. Connect the run that made a version with **Produces**, and the version to its model with **Version of**.
6. Add **evaluations** and **approval gates** and connect them to the version.
7. Draw an **environment** for each stage with its **deployments** inside, and connect the version that runs there with **Deployed as**.
8. Add **monitors** to the production deployments. When one goes above its threshold, add an **incident** with **Raises**, and connect the retraining it leads to.
9. Open the Problems panel ([[problems-panel]]) to see what is missing.

## Every option explained

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Runs**, **Best score** | Experiment | How many runs sit inside, and the best of their scores in the direction of the metric. The heading shows it, for example "Churn prediction, best AUC 0.87". |
| **Best run** | Training run | Yes when its score is the best of its experiment. Its fill turns green. |
| **Passed** | Evaluation | The score against the threshold: at least the threshold for "Higher is better", at most for "Lower is better". The border turns green or red. |
| **Outcome**, **Reading** | Evaluation | Passed, Failed or Not run, and a line such as "AUC 0.87, at least 0.8". |
| **Trained by** | Model version | The run that produced it. |
| **Evaluation** | Model version | Passed when every evaluation passed, Failed when one failed, Incomplete when one has no score, Not evaluated when there is none. |
| **Approval** | Model version | Approved when every gate approved it, Rejected or Pending otherwise, Not requested when there is no gate. |
| **Ready for production** | Model version | Yes when the evaluation is Passed and the approval is Approved. |
| **Environment** | Model deployment | The stage of the environment it sits in. |
| **Deployed version**, **Version ready for production** | Model deployment | The version that runs there, and whether it is ready. |
| **Breached**, **Reading** | Monitor | Yes when the current value is above the threshold; the fill turns red. |
| **Versions** | ML model | How many versions are registered. |
| **Training runs**, **Training cost** | The model | How many runs there are and what their compute cost. |

The fill of a model version shows its stage, and the fill of an incident its status.

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a production deployment runs a version that did not pass every evaluation or was not approved;
- a deployment runs no version or more than one, sits in no environment, or runs in production without a monitor;
- a monitor is above its threshold but raised no incident, or watches nothing;
- an incident asks for retraining but leads to no experiment or run;
- a model version belongs to no model or was produced by no run;
- a training run sits in no experiment or trains on no data;
- a feature comes from no dataset, an experiment addresses no use case;
- an evaluation tests nothing, an approval gate is for no version or has a decision but no approver.

### Behaviour

**Warn when a version that is not ready moves to production** (a rule, [[rules]]): when someone sets the stage of a version to Production while it is not ready, a warning names its evaluation and approval.

### Model type and views

**ML lifecycle** holds all classes. Its views are **Data and training**, **Evaluation and release** and **Operations** ([[model-types]]).

## Examples

In the sample, a telecom provider predicts which customers will leave. Four runs sit in the experiment "Churn prediction"; run 14, retrained on newer data, has the best AUC (0.87) and is green. It produced version 4, which passed its accuracy and fairness evaluations but still waits for the risk board, so it runs only in staging. Version 3 is in production: it passed and was approved. The data drift monitor went above its threshold and raised the incident "Usage pattern changed", which led to run 14.

The sample shows one warning on purpose: the "Prediction latency" monitor is above its threshold and no incident was raised for it.

## Good to know

- **One version per deployment.** To roll out a new version, connect it to a new deployment or move the **Deployed as** connector.
- **Fairness metrics are often "lower is better"**, such as a gap between groups. Set the **Direction** of the evaluation, or it fails.
- Use the [[data-ai-strategy]] Kit for the use cases and their value, and the [[ai-risk-compliance]] Kit for risk tiers, controls and obligations.

## Related

[[built-in-kits]] · [[genai-solution]] · [[ai-risk-compliance]] · [[computed-values]] · [[constraints]] · [[rules]]
