import type { KitId } from '@metakit-app/core';
import {
  choice,
  date,
  formula,
  line,
  long,
  look,
  num,
  text,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * ML lifecycle (MLOps): a use case, the datasets and features a model learns from, experiments
 * with training runs, models and their versions in a registry, evaluations against thresholds,
 * approval gates, deployments per environment, monitors, and the incidents that lead to
 * retraining.
 */

const AI = { fill: '#eebefa', border: '#9c36b5' };
/** Containers are see-through, so connectors to the objects inside them stay visible. */
const SEE_THROUGH = '#f1f3f566';

const e = (
  id: string,
  cls: string,
  x: number,
  y: number,
  attributes: SampleElement['attributes'],
  extra: Partial<SampleElement> = {},
): SampleElement => ({ id, class: cls, x, y, attributes, ...extra });
const c = (relation: string, from: string, to: string): SampleConnector => ({
  relation,
  from,
  to,
});

/** "Passed" when every evaluation passed, "Failed" when one failed, "Incomplete" when one has no score. */
const EVALUATION_STATUS =
  "count(incoming('Evaluates')) == 0 ? 'Not evaluated' : contains(join(incoming('Evaluates').Outcome, ','), 'Failed') ? 'Failed' : contains(join(incoming('Evaluates').Outcome, ','), 'Not run') ? 'Incomplete' : 'Passed'";
const APPROVAL_STATUS =
  "count(incoming('Approves')) == 0 ? 'Not requested' : contains(join(incoming('Approves').Decision, ','), 'Rejected') ? 'Rejected' : contains(join(incoming('Approves').Decision, ','), 'Pending') ? 'Pending' : 'Approved'";

const run = (
  id: string,
  x: number,
  y: number,
  values: Record<string, string | number>,
) => e(id, 'TrainingRun', x, y, values, { parent: 'exp_churn' });

export const mlLifecycle: KitSpec = {
  folder: 'ml-lifecycle',
  id: 'kit_mllifecycle' as KitId,
  name: 'ML lifecycle (MLOps)',
  catalog: {
    keys: [
      'AIUseCase',
      'Dataset',
      'Feature',
      'MLModel',
      'Evaluation',
      'ModelDeployment',
      'Monitor',
      'Environment',
    ],
    // Training runs read the data; models do not read or receive it directly.
    skipRelations: ['FlowsTo', 'ReadsFrom'],
  },
  classes: [
    {
      key: 'FeatureStore',
      label: 'Feature store',
      help: 'A shared place that keeps features ready for training and for predictions. Place its features inside it.',
      look: look('container', {
        fill: SEE_THROUGH,
        border: '#1c7ed6',
        icon: 'database',
        width: 200,
        height: 290,
      }),
      attributes: [
        long('Description'),
        text('Technology'),
        choice('Serving', ['Offline only', 'Offline and online']),
      ],
    },
    {
      key: 'Experiment',
      label: 'Experiment',
      help: 'A question tried out with training runs, all compared on one metric. Place its training runs inside it.',
      look: look('container', {
        fill: '#f8f0fc66',
        border: '#9c36b5',
        title: 'Heading',
        width: 420,
        height: 310,
      }),
      attributes: [
        long('Hypothesis'),
        text('Metric', {
          help: 'The metric the runs are compared on, such as AUC or error rate.',
        }),
        choice('Direction', ['Higher is better', 'Lower is better'], {
          default: 'Higher is better',
        }),
        formula(
          'Runs',
          'count(children())',
          'number',
          'How many training runs sit inside.',
        ),
        formula(
          'BestScore',
          "Direction == 'Lower is better' ? min(children().Score) : max(children().Score)",
          'number',
          'The best score of the runs inside, in the direction of the metric.',
        ),
        formula(
          'Heading',
          "Name + (BestScore == null ? '' : ', best ' + (Metric ?? 'score') + ' ' + BestScore)",
          'text',
          'The name and the best score, shown as the heading on the diagram.',
        ),
      ],
      constraints: [
        {
          id: 'k_experiment_usecase',
          formula: "count(outgoing('Addresses')) > 0",
          message:
            '= \'Experiment "\' + Name + \'" addresses no use case: connect it to one with "Addresses".\'',
        },
      ],
    },
    {
      key: 'TrainingRun',
      label: 'Training run',
      help: 'One training of a model with given data, algorithm and parameters, and the score it reached.',
      look: look('header-box', {
        fill: {
          by: 'IsBest',
          values: { true: '#b2f2bb', false: '#f3d9fa' },
          fallback: '#f3d9fa',
        },
        border: AI.border,
        fields: ['Algorithm', 'Score', 'ComputeCost'],
      }),
      attributes: [
        text('Algorithm'),
        long('Parameters', {
          help: 'The settings of this run, such as learning rate or tree depth.',
        }),
        date('StartedOn'),
        num('DurationMinutes', { label: 'Duration (minutes)', min: 0 }),
        num('ComputeCost', {
          min: 0,
          help: 'What the compute for this run cost, in your currency.',
        }),
        num('Score', {
          help: 'The value of the metric of its experiment that this run reached.',
        }),
        formula(
          'IsBest',
          'Score != null && parent != null && Score == parent.BestScore',
          'boolean',
          'Yes when this run has the best score in its experiment. Its fill turns green.',
          { label: 'Best run' },
        ),
      ],
      constraints: [
        {
          id: 'k_run_experiment',
          formula: 'parent != null',
          message:
            "= 'Training run \"' + Name + '\" is not inside an experiment.'",
        },
        {
          id: 'k_run_data',
          formula: "count(outgoing('TrainsOn')) > 0",
          message:
            '= \'Training run "\' + Name + \'" does not say which data it trains on: connect it to a dataset or feature with "Trains on".\'',
        },
      ],
    },
    {
      key: 'ModelRegistry',
      label: 'Model registry',
      help: 'The catalogue of models and their versions. Place the models and versions inside it.',
      look: look('container', {
        fill: SEE_THROUGH,
        border: AI.border,
        icon: 'database',
        width: 420,
        height: 330,
      }),
      attributes: [long('Description'), text('Technology')],
    },
    {
      key: 'ModelVersion',
      label: 'Model version',
      help: 'One trained version of a model in the registry, with its stage, its evaluations and its approval.',
      look: look('header-box', {
        fill: {
          by: 'Stage',
          values: {
            Candidate: '#f3d9fa',
            Staging: '#fff3bf',
            Production: '#b2f2bb',
            Archived: '#e9ecef',
          },
          fallback: '#f3d9fa',
        },
        border: AI.border,
        fields: ['Stage', 'EvaluationStatus', 'ApprovalStatus'],
      }),
      attributes: [
        text('Version', { help: 'Such as "3" or "2027.04".' }),
        choice('Stage', ['Candidate', 'Staging', 'Production', 'Archived'], {
          default: 'Candidate',
        }),
        date('RegisteredOn'),
        long('Notes'),
        formula(
          'TrainedBy',
          "join(incoming('Produces').Name, ', ')",
          'text',
          'The training run that produced it.',
        ),
        formula(
          'EvaluationStatus',
          EVALUATION_STATUS,
          'text',
          'Passed when every evaluation of this version passed; Failed when one failed; Incomplete when one has no score yet.',
          { label: 'Evaluation' },
        ),
        formula(
          'ApprovalStatus',
          APPROVAL_STATUS,
          'text',
          'Approved when every approval gate of this version approved it; Pending or Rejected otherwise.',
          { label: 'Approval' },
        ),
        formula(
          'ReadyForRelease',
          "EvaluationStatus == 'Passed' && ApprovalStatus == 'Approved'",
          'boolean',
          'Yes when it passed every evaluation and was approved.',
          { label: 'Ready for production' },
        ),
      ],
      constraints: [
        {
          id: 'k_version_model',
          formula: "count(outgoing('VersionOf')) == 1",
          message:
            '= \'Model version "\' + Name + \'" should be a version of one model: connect it with "Version of".\'',
        },
        {
          id: 'k_version_run',
          formula: "count(incoming('Produces')) > 0",
          message:
            "= 'No training run produced model version \"' + Name + '\", so where it came from is unknown.'",
        },
      ],
    },
    {
      key: 'ApprovalGate',
      label: 'Approval gate',
      help: 'A decision by a person or board that a model version may go further, with the conditions attached.',
      look: look('diamond', {
        fill: {
          by: 'Decision',
          values: {
            Pending: '#fff3bf',
            Approved: '#b2f2bb',
            Rejected: '#ffc9c9',
          },
          fallback: '#fff3bf',
        },
        border: '#2f9e44',
        subtitle: 'Decision',
        width: 130,
        height: 100,
      }),
      attributes: [
        text('Approver'),
        choice('Decision', ['Pending', 'Approved', 'Rejected'], {
          default: 'Pending',
        }),
        date('DecidedOn'),
        long('Conditions'),
      ],
      constraints: [
        {
          id: 'k_gate_version',
          formula: "count(outgoing('Approves')) > 0",
          message:
            '= \'Approval gate "\' + Name + \'" is for no model version: connect it with "Approves".\'',
        },
        {
          id: 'k_gate_approver',
          formula: "Decision == 'Pending' || !isEmpty(Approver)",
          message:
            "= 'Approval gate \"' + Name + '\" has a decision but no approver.'",
        },
      ],
    },
    {
      key: 'Incident',
      label: 'Incident',
      help: 'Something that went wrong with a running model, such as drift or slow answers, and what is done about it.',
      look: look('rounded', {
        fill: {
          by: 'Status',
          values: {
            Open: '#ffc9c9',
            Investigating: '#ffec99',
            Resolved: '#d3f9d8',
          },
          fallback: '#ffc9c9',
        },
        border: '#e03131',
        icon: 'warning',
        subtitle: 'Response',
        width: 170,
      }),
      attributes: [
        long('Description'),
        choice('Severity', ['Low', 'Medium', 'High', 'Critical']),
        choice('Status', ['Open', 'Investigating', 'Resolved'], {
          default: 'Open',
        }),
        date('OpenedOn'),
        choice('Response', ['Investigate', 'Roll back', 'Retrain'], {
          help: 'What is done about it. Retrain needs an experiment or a training run that follows from it.',
        }),
      ],
      constraints: [
        {
          id: 'k_incident_retrain',
          formula: "Response != 'Retrain' || count(outgoing('LeadsTo')) > 0",
          message:
            '= \'Incident "\' + Name + \'" asks for retraining, but no experiment or training run follows from it: connect one with "Leads to".\'',
        },
      ],
    },
  ],
  amend: {
    AIUseCase: {
      help: 'The business problem the model is for, rated by the value it brings and how feasible it is.',
      attributes: [
        text('BusinessMetric', {
          help: 'What the business measures to see the effect, such as churn rate.',
        }),
        text('Owner'),
      ],
    },
    Dataset: {
      attributes: [text('Version')],
    },
    Environment: {
      look: look('container', {
        fill: SEE_THROUGH,
        border: '#0c8599',
        width: 250,
        height: 160,
      }),
    },
    Feature: {
      constraints: [
        {
          id: 'k_feature_source',
          formula: "count(outgoing('DerivedFrom')) > 0",
          message:
            '= \'Feature "\' + Name + \'" does not say which dataset it comes from: connect it with "Derived from".\'',
        },
      ],
    },
    MLModel: {
      help: 'A model in the registry: one prediction task, with its versions. Place it in the model registry.',
      remove: ['Version', 'Score'],
      look: look('hexagon', {
        fill: AI.fill,
        border: AI.border,
        icon: 'bot',
        subtitle: 'Task',
        width: 170,
        height: 80,
      }),
      attributes: [
        text('Owner'),
        formula(
          'Versions',
          "count(incoming('VersionOf'))",
          'number',
          'How many versions of this model are registered.',
        ),
      ],
    },
    Evaluation: {
      help: 'A measured test of a model version on a test dataset, such as accuracy, fairness or speed. Passed compares the score with the threshold in the direction of the metric.',
      attributes: [
        choice('Kind', [
          'Accuracy',
          'Fairness',
          'Robustness',
          'Speed',
          'Explainability',
        ]),
        choice('Direction', ['Higher is better', 'Lower is better'], {
          default: 'Higher is better',
        }),
        formula(
          'Passed',
          "Score == null || Threshold == null ? null : (Direction == 'Lower is better' ? Score <= Threshold : Score >= Threshold)",
          'boolean',
          'Yes when the score reached the threshold in the direction of the metric.',
        ),
        formula(
          'Outcome',
          "Passed == null ? 'Not run' : Passed ? 'Passed' : 'Failed'",
          'text',
          'Passed, Failed, or Not run while the score or threshold is missing.',
        ),
        formula(
          'Reading',
          "(Metric ?? 'Score') + ' ' + (Score == null ? '-' : text(Score)) + (Direction == 'Lower is better' ? ', at most ' : ', at least ') + (Threshold == null ? '-' : text(Threshold))",
          'text',
          'The score and the threshold, shown on the diagram.',
        ),
      ],
      look: look('rounded', {
        fill: '#f8f0fc',
        border: {
          by: 'Passed',
          values: { true: '#2f9e44', false: '#e03131' },
          fallback: AI.border,
        },
        borderWidth: 2,
        icon: 'check',
        subtitle: 'Reading',
        width: 220,
      }),
      constraints: [
        {
          id: 'k_evaluation_target',
          formula: "count(outgoing('Evaluates')) > 0",
          message:
            '= \'Evaluation "\' + Name + \'" tests no model version: connect it with "Evaluates".\'',
        },
      ],
    },
    ModelDeployment: {
      help: 'A model version running in an environment where others can call it. Place it inside its environment.',
      remove: ['Version'],
      attributes: [
        formula(
          'Environment',
          'parent ? parent.Stage : null',
          'text',
          'The stage of the environment it sits in.',
        ),
        formula(
          'DeployedVersion',
          "join(incoming('DeployedAs').Name, ', ')",
          'text',
          'The model version that runs here.',
        ),
        formula(
          'VersionReady',
          "IFERROR(incoming('DeployedAs')[0].ReadyForRelease, null)",
          'boolean',
          'Yes when the version that runs here passed its evaluations and was approved.',
          { label: 'Version ready for production' },
        ),
      ],
      look: look('header-box', {
        fill: {
          by: 'Status',
          values: { Planned: '#e9ecef', Live: '#c3fae8', Retired: '#dee2e6' },
          fallback: '#e9ecef',
        },
        border: '#0c8599',
        icon: 'cloud',
        fields: ['DeployedVersion', 'Status', 'Endpoint'],
      }),
      constraints: [
        {
          id: 'k_deployment_environment',
          formula: 'parent != null',
          message:
            "= 'Deployment \"' + Name + '\" is not inside an environment.'",
        },
        {
          id: 'k_deployment_version',
          formula: "count(incoming('DeployedAs')) == 1",
          message:
            '= \'Deployment "\' + Name + \'" should run exactly one model version: connect the version with "Deployed as".\'',
        },
        {
          id: 'k_deployment_ready',
          formula:
            "Environment != 'Production' || count(incoming('DeployedAs')) == 0 || VersionReady == true",
          message:
            "= 'Deployment \"' + Name + '\" runs in production, but its model version has not passed every evaluation and been approved.'",
        },
        {
          id: 'k_deployment_monitor',
          formula:
            "Environment != 'Production' || count(incoming('Monitors')) > 0",
          message:
            "= 'Deployment \"' + Name + '\" runs in production with no monitor.'",
        },
      ],
    },
    Monitor: {
      help: 'A watch on a running deployment that raises an incident when its signal, such as drift or latency, goes above the threshold.',
      attributes: [
        num('CurrentValue', {
          help: 'The latest measured value of the signal.',
        }),
        formula(
          'Breached',
          'CurrentValue == null || Threshold == null ? null : CurrentValue > Threshold',
          'boolean',
          'Yes when the current value is above the threshold. The fill turns red.',
        ),
        formula(
          'Reading',
          "(Signal ?? 'Signal') + ': ' + (CurrentValue == null ? '-' : text(CurrentValue)) + ', limit ' + (Threshold == null ? '-' : text(Threshold))",
          'text',
          'The signal, its current value and the threshold, shown on the diagram.',
        ),
      ],
      look: look('rounded', {
        fill: {
          by: 'Breached',
          values: { true: '#ffc9c9', false: '#d3f9d8' },
          fallback: '#f8f0fc',
        },
        border: AI.border,
        icon: 'clock',
        subtitle: 'Reading',
        width: 180,
      }),
      constraints: [
        {
          id: 'k_monitor_target',
          formula: "count(outgoing('Monitors')) > 0",
          message:
            '= \'Monitor "\' + Name + \'" watches nothing: connect it to a deployment with "Monitors".\'',
        },
        {
          id: 'k_monitor_incident',
          formula: "Breached != true || count(outgoing('Raises')) > 0",
          message:
            "= 'Monitor \"' + Name + '\" is above its threshold, but no incident was raised for it.'",
        },
      ],
    },
  },
  relations: [
    {
      key: 'DerivedFrom',
      label: 'Derived from',
      help: 'The feature is calculated from the dataset.',
      from: ['Feature'],
      to: ['Dataset'],
      look: line('#1c7ed6', { style: 'dashed' }),
    },
    {
      key: 'Addresses',
      label: 'Addresses',
      help: 'The experiment works on the use case.',
      from: ['Experiment'],
      to: ['AIUseCase'],
      look: line('#2f9e44'),
    },
    {
      key: 'Produces',
      label: 'Produces',
      help: 'The training run produced the model version.',
      from: ['TrainingRun'],
      to: ['ModelVersion'],
      look: line(AI.border),
    },
    {
      key: 'VersionOf',
      label: 'Version of',
      help: 'The version belongs to the model.',
      from: ['ModelVersion'],
      to: ['MLModel'],
      look: line(AI.border, { end: 'triangle' }),
    },
    {
      key: 'Approves',
      label: 'Approves',
      help: 'The approval gate decides about the model version.',
      from: ['ApprovalGate'],
      to: ['ModelVersion'],
      look: line('#2f9e44', { style: 'dashed' }),
    },
    {
      key: 'Raises',
      label: 'Raises',
      help: 'The monitor raised the incident.',
      from: ['Monitor'],
      to: ['Incident'],
      look: line('#e03131'),
    },
    {
      key: 'LeadsTo',
      label: 'Leads to',
      help: 'The incident led to a new experiment or training run.',
      from: ['Incident'],
      to: ['Experiment', 'TrainingRun'],
      look: line('#e03131', { style: 'dashed' }),
    },
  ],
  amendRelations: {
    TrainsOn: { from: ['TrainingRun'], replace: true },
    Evaluates: { to: ['ModelVersion'], replace: true },
    DeployedAs: { from: ['ModelVersion'], replace: true },
  },
  modelTypes: [
    {
      key: 'MLLifecycle',
      label: 'ML lifecycle',
      help: 'A use case with its data and features, experiments and training runs, model versions in a registry with their evaluations and approvals, deployments per environment, monitors and incidents.',
      views: [
        {
          key: 'Training',
          label: 'Data and training',
          classes: [
            'AIUseCase',
            'Dataset',
            'FeatureStore',
            'Feature',
            'Experiment',
            'TrainingRun',
            'ModelVersion',
          ],
          relations: ['DerivedFrom', 'TrainsOn', 'Addresses', 'Produces'],
        },
        {
          key: 'Release',
          label: 'Evaluation and release',
          classes: [
            'ModelRegistry',
            'MLModel',
            'ModelVersion',
            'Evaluation',
            'ApprovalGate',
            'Environment',
            'ModelDeployment',
          ],
          relations: ['VersionOf', 'Evaluates', 'Approves', 'DeployedAs'],
        },
        {
          key: 'Operations',
          label: 'Operations',
          classes: [
            'Environment',
            'ModelDeployment',
            'Monitor',
            'Incident',
            'Experiment',
            'TrainingRun',
          ],
          relations: ['Monitors', 'Raises', 'LeadsTo'],
        },
      ],
      containers: {
        FeatureStore: ['Feature'],
        Experiment: ['TrainingRun'],
        ModelRegistry: ['MLModel', 'ModelVersion'],
        Environment: ['ModelDeployment'],
      },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        text('Team'),
        formula(
          'TrainingRuns',
          "count(objects('TrainingRun'))",
          'number',
          'How many training runs the model shows.',
        ),
        formula(
          'TrainingCost',
          "sum(objects('TrainingRun').ComputeCost)",
          'number',
          'The compute cost of all training runs.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'TrainingRun',
      tabs: [
        {
          label: 'Run',
          items: [
            'Name',
            'Algorithm',
            { attribute: 'Parameters', control: 'textarea' },
            'StartedOn',
            'DurationMinutes',
          ],
        },
        { label: 'Result', items: ['Score', 'IsBest', 'ComputeCost'] },
      ],
      showRelations: true,
    },
    {
      class: 'ModelVersion',
      tabs: [
        {
          label: 'Version',
          items: [
            'Name',
            'Version',
            { attribute: 'Stage', control: 'segmented' },
            'RegisteredOn',
            'TrainedBy',
            { attribute: 'Notes', control: 'textarea' },
          ],
        },
        {
          label: 'Release',
          items: ['EvaluationStatus', 'ApprovalStatus', 'ReadyForRelease'],
        },
      ],
      showRelations: true,
    },
    {
      class: 'Evaluation',
      tabs: [
        {
          label: 'Evaluation',
          items: [
            'Name',
            { attribute: 'Kind', control: 'select' },
            'TestSet',
            'Metric',
            { attribute: 'Direction', control: 'segmented' },
            'Score',
            'Threshold',
            'Passed',
          ],
        },
      ],
      showRelations: true,
    },
    {
      class: 'ModelDeployment',
      tabs: [
        {
          label: 'Deployment',
          items: [
            'Name',
            'Environment',
            'DeployedVersion',
            'VersionReady',
            { attribute: 'Status', control: 'segmented' },
            'Endpoint',
            { attribute: 'Description', control: 'textarea' },
          ],
        },
      ],
      showRelations: true,
    },
  ],
  rules: [
    {
      id: 'rule_productionready',
      label: 'Warn when a version that is not ready moves to production',
      when: {
        event: 'attribute.changed',
        class: 'ModelVersion',
        attribute: 'Stage',
      },
      if: "= Stage == 'Production' && ReadyForRelease != true",
      then: [
        {
          action: 'message',
          kind: 'warning',
          text: "= '\"' + Name + '\" moved to production, but its evaluation is ' + EvaluationStatus + ' and its approval is ' + ApprovalStatus + '.'",
        },
      ],
    },
  ],
  sample: {
    file: 'churn-model.mkmodel.json',
    id: 'mdl_churnmodel',
    name: 'Customer churn model',
    modelType: 'MLLifecycle',
    attributes: {
      Title: 'Customer churn model',
      Organisation: 'A telecom provider',
      Team: 'Customer analytics',
    },
    // "Prediction latency" is above its threshold with no incident, on purpose.
    intendedWarnings: 1,
    elements: [
      e('uc_churn', 'AIUseCase', 615, 10, {
        Name: 'Predict which customers will leave',
        Value: 5,
        Feasibility: 4,
        Status: 'In production',
        BusinessMetric: 'Monthly churn rate',
        Owner: 'Head of customer retention',
      }),
      // Data.
      e('ds_accounts', 'Dataset', 40, 170, {
        Name: 'Customer accounts',
        Format: 'Table',
        Refresh: 'Daily',
        Classification: 'Confidential',
        ContainsPersonalData: true,
        Version: '2027-03',
      }),
      e('ds_usage', 'Dataset', 40, 310, {
        Name: 'Network usage',
        Format: 'Table',
        Refresh: 'Daily',
        Classification: 'Internal',
        Version: '2027-03',
      }),
      e('ds_labels', 'Dataset', 615, 510, {
        Name: 'Churn labels',
        Format: 'Table',
        Refresh: 'Monthly',
        Classification: 'Internal',
        Version: '2027-03',
      }),
      e(
        'store',
        'FeatureStore',
        250,
        150,
        {
          Name: 'Feature store',
          Serving: 'Offline and online',
        },
        { w: 200, h: 290 },
      ),
      e(
        'f_tenure',
        'Feature',
        280,
        195,
        { Name: 'Months as customer', Type: 'Numeric' },
        { parent: 'store' },
      ),
      e(
        'f_spend',
        'Feature',
        280,
        255,
        { Name: 'Monthly spend', Type: 'Numeric' },
        { parent: 'store' },
      ),
      e(
        'f_calls',
        'Feature',
        280,
        315,
        { Name: 'Support calls, 90 days', Type: 'Numeric' },
        { parent: 'store' },
      ),
      e(
        'f_trend',
        'Feature',
        280,
        375,
        { Name: 'Usage trend', Type: 'Numeric' },
        { parent: 'store' },
      ),
      // Experiments.
      e(
        'exp_churn',
        'Experiment',
        490,
        150,
        {
          Name: 'Churn prediction',
          Hypothesis:
            'Usage and support history predict who leaves within three months.',
          Metric: 'AUC',
          Direction: 'Higher is better',
        },
        { w: 420, h: 310 },
      ),
      run('run_11', 510, 195, {
        Name: 'Run 11',
        Algorithm: 'Logistic regression',
        StartedOn: '2026-11-03',
        DurationMinutes: 12,
        ComputeCost: 4,
        Score: 0.78,
      }),
      run('run_12', 720, 195, {
        Name: 'Run 12',
        Algorithm: 'Gradient boosting',
        StartedOn: '2026-11-05',
        DurationMinutes: 48,
        ComputeCost: 19,
        Score: 0.84,
      }),
      run('run_13', 510, 325, {
        Name: 'Run 13',
        Algorithm: 'Neural network',
        StartedOn: '2026-11-09',
        DurationMinutes: 130,
        ComputeCost: 85,
        Score: 0.83,
      }),
      run('run_14', 720, 325, {
        Name: 'Run 14: retrained',
        Algorithm: 'Gradient boosting',
        Parameters: 'Same settings as run 12, on data up to March 2027.',
        StartedOn: '2027-04-02',
        DurationMinutes: 55,
        ComputeCost: 22,
        Score: 0.87,
      }),
      // Registry.
      e(
        'registry',
        'ModelRegistry',
        950,
        150,
        { Name: 'Model registry' },
        { w: 420, h: 300 },
      ),
      e(
        'model',
        'MLModel',
        1075,
        190,
        {
          Name: 'Churn model',
          Task: 'Classification',
          Metric: 'AUC',
          Owner: 'Customer analytics',
        },
        { parent: 'registry' },
      ),
      e(
        'v3',
        'ModelVersion',
        970,
        310,
        {
          Name: 'Churn model 3',
          Version: '3',
          Stage: 'Production',
          RegisteredOn: '2026-11-12',
        },
        { parent: 'registry' },
      ),
      e(
        'v4',
        'ModelVersion',
        1180,
        310,
        {
          Name: 'Churn model 4',
          Version: '4',
          Stage: 'Staging',
          RegisteredOn: '2027-04-06',
        },
        { parent: 'registry' },
      ),
      // Evaluations and approvals.
      e('ev_v3_auc', 'Evaluation', 1420, 150, {
        Name: 'Accuracy of version 3',
        Kind: 'Accuracy',
        TestSet: 'Hold-out 2026',
        Metric: 'AUC',
        Score: 0.84,
        Threshold: 0.8,
      }),
      e('ev_v4_auc', 'Evaluation', 1420, 250, {
        Name: 'Accuracy of version 4',
        Kind: 'Accuracy',
        TestSet: 'Hold-out 2027',
        Metric: 'AUC',
        Score: 0.87,
        Threshold: 0.8,
      }),
      e('ev_v4_fair', 'Evaluation', 1420, 350, {
        Name: 'Fairness of version 4',
        Kind: 'Fairness',
        TestSet: 'Hold-out 2027',
        Metric: 'Recall gap by age',
        Direction: 'Lower is better',
        Score: 0.03,
        Threshold: 0.05,
      }),
      e('gate_v3', 'ApprovalGate', 1680, 150, {
        Name: 'Release of version 3',
        Approver: 'Model risk board',
        Decision: 'Approved',
        DecidedOn: '2026-11-20',
      }),
      e('gate_v4', 'ApprovalGate', 1680, 320, {
        Name: 'Release of version 4',
        Approver: 'Model risk board',
        Decision: 'Pending',
        Conditions: 'Review the fairness results with the customer team.',
      }),
      // Environments, deployments and monitoring.
      e(
        'env_staging',
        'Environment',
        950,
        540,
        { Name: 'Staging', Stage: 'Test' },
        { w: 250, h: 160 },
      ),
      e(
        'env_prod',
        'Environment',
        1240,
        540,
        { Name: 'Production', Stage: 'Production' },
        { w: 250, h: 160 },
      ),
      e(
        'dep_staging',
        'ModelDeployment',
        990,
        580,
        {
          Name: 'Churn scoring (test)',
          Status: 'Live',
          Endpoint: '/test/churn-score',
        },
        { parent: 'env_staging' },
      ),
      e(
        'dep_prod',
        'ModelDeployment',
        1280,
        580,
        {
          Name: 'Churn scoring',
          Status: 'Live',
          Endpoint: '/churn-score',
        },
        { parent: 'env_prod' },
      ),
      e('mon_drift', 'Monitor', 1240, 760, {
        Name: 'Data drift',
        Signal: 'Drift',
        Threshold: 0.2,
        CurrentValue: 0.27,
        AlertChannel: 'Analytics on-call',
      }),
      e('mon_latency', 'Monitor', 1460, 760, {
        Name: 'Prediction latency',
        Signal: 'Latency',
        Threshold: 200,
        CurrentValue: 240,
        AlertChannel: 'Platform on-call',
      }),
      e('inc_drift', 'Incident', 950, 760, {
        Name: 'Usage pattern changed',
        Description:
          'A new tariff changed how customers use the network, so the model no longer saw familiar data.',
        Severity: 'Medium',
        Status: 'Resolved',
        OpenedOn: '2027-03-18',
        Response: 'Retrain',
      }),
    ],
    connectors: [
      c('UsesModel', 'uc_churn', 'model'),
      c('Addresses', 'exp_churn', 'uc_churn'),
      c('DerivedFrom', 'f_tenure', 'ds_accounts'),
      c('DerivedFrom', 'f_spend', 'ds_accounts'),
      c('DerivedFrom', 'f_calls', 'ds_usage'),
      c('DerivedFrom', 'f_trend', 'ds_usage'),
      c('TrainsOn', 'run_11', 'ds_labels'),
      c('TrainsOn', 'run_12', 'ds_labels'),
      c('TrainsOn', 'run_13', 'ds_labels'),
      c('TrainsOn', 'run_14', 'ds_labels'),
      c('Produces', 'run_12', 'v3'),
      c('Produces', 'run_14', 'v4'),
      c('VersionOf', 'v3', 'model'),
      c('VersionOf', 'v4', 'model'),
      c('Evaluates', 'ev_v3_auc', 'v3'),
      c('Evaluates', 'ev_v4_auc', 'v4'),
      c('Evaluates', 'ev_v4_fair', 'v4'),
      c('Approves', 'gate_v3', 'v3'),
      c('Approves', 'gate_v4', 'v4'),
      c('DeployedAs', 'v4', 'dep_staging'),
      c('DeployedAs', 'v3', 'dep_prod'),
      c('Monitors', 'mon_drift', 'dep_prod'),
      c('Monitors', 'mon_latency', 'dep_prod'),
      c('Raises', 'mon_drift', 'inc_drift'),
      c('LeadsTo', 'inc_drift', 'run_14'),
    ],
  },
};
