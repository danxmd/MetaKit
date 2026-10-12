import type { KitId } from '@metakit-app/core';
import {
  bool,
  choice,
  formula,
  int,
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
 * Generative AI solution: use cases handled by an orchestration flow that calls prompts on
 * foundation models, retrieves context through a retrieval pipeline, coordinates agents with
 * tools, and is protected by guardrails, evaluations and human review. Cost and latency per
 * request are calculated from tokens and model prices.
 */

const AI = { fill: '#eebefa', border: '#9c36b5' };
const DATA = { fill: '#a5d8ff', border: '#1c7ed6' };

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
const step = (
  id: string,
  cls: string,
  x: number,
  y: number,
  attributes: SampleElement['attributes'],
) => e(id, cls, x, y, attributes, { parent: 'pipeline' });

/** The first model the prompt uses, read safely. */
const MODEL = "outgoing('UsesModel')[0]";

const RETRIEVAL_STEPS = [
  'KnowledgeSource',
  'Chunking',
  'EmbeddingModel',
  'VectorIndex',
  'Retriever',
  'Reranker',
];

export const genaiSolution: KitSpec = {
  folder: 'genai-solution',
  id: 'kit_genaisolution' as KitId,
  name: 'Generative AI solution',
  catalog: {
    keys: [
      'AIUseCase',
      'FoundationModel',
      'Prompt',
      'AIAgent',
      'Guardrail',
      'Evaluation',
    ],
  },
  classes: [
    {
      key: 'Orchestration',
      label: 'Orchestration flow',
      help: 'The flow that handles a request: which prompts it calls, what it retrieves and which agents it hands work to. Cost and latency per request are added up from them.',
      look: look('header-box', {
        fill: AI.fill,
        border: AI.border,
        icon: 'gear',
        fields: [
          'Pattern',
          'CostPerRequest',
          'LatencyPerRequest',
          'MonthlyCost',
        ],
        width: 230,
      }),
      attributes: [
        long('Description'),
        choice('Pattern', [
          'Single call',
          'Chain',
          'Retrieval and answer',
          'Router',
          'Agent loop',
          'Several agents',
        ]),
        int('RequestsPerDay', { min: 0 }),
        formula(
          'CostPerRequest',
          "round(sum(outgoing('Calls').CostPerRequest, outgoing('Coordinates').CostPerRequest, outgoing('Retrieves').CostPerQuery), 4)",
          'number',
          'The average cost of one request: its prompts, its agents and its retrieval.',
        ),
        formula(
          'LatencyPerRequest',
          "round(sum(outgoing('Calls').LatencyPerRequest, outgoing('Coordinates').LatencyPerRequest, outgoing('Retrieves').LatencyMs), 0)",
          'number',
          'The average time to answer one request in milliseconds, when the steps run one after the other.',
          { label: 'Latency per request (ms)' },
        ),
        formula(
          'DailyCost',
          'RequestsPerDay == null ? null : round(CostPerRequest * RequestsPerDay, 2)',
          'number',
          'Cost per request times requests per day.',
        ),
        formula(
          'MonthlyCost',
          'DailyCost == null ? null : round(DailyCost * 30, 0)',
          'number',
          'The daily cost times 30.',
        ),
      ],
      constraints: [
        {
          id: 'k_flow_usecase',
          formula: "count(outgoing('Handles')) > 0",
          message:
            '= \'Flow "\' + Name + \'" handles no use case: connect it to one with "Handles".\'',
        },
        {
          id: 'k_flow_guardrails',
          formula:
            "contains(join(incoming('Protects').Type, ','), 'Input') && contains(join(incoming('Protects').Type, ','), 'Output')",
          message:
            "= 'Flow \"' + Name + '\" needs an input guardrail and an output guardrail.'",
        },
        {
          id: 'k_flow_evaluated',
          formula: "count(incoming('Evaluates')) > 0",
          message: "= 'Flow \"' + Name + '\" has no evaluation.'",
        },
      ],
    },
    {
      key: 'Tool',
      label: 'Tool',
      help: 'A function a flow or agent can call, such as looking up an order. Tools that change data or act outside need an approval.',
      look: look('pill', {
        fill: {
          by: 'SideEffects',
          values: {
            'Read only': '#d3f9d8',
            'Changes data': '#ffec99',
            'Acts outside': '#ffc9c9',
          },
          fallback: '#e9ecef',
        },
        border: '#495057',
        icon: 'gear',
        subtitle: 'SideEffects',
        width: 170,
        height: 50,
      }),
      attributes: [
        long('Description'),
        text('System', { help: 'The system the tool calls.' }),
        choice('SideEffects', ['Read only', 'Changes data', 'Acts outside'], {
          help: 'Acts outside: sends messages, pays money or does anything else beyond the own data.',
        }),
        bool('RequiresApproval', {
          help: 'A person confirms each call before it runs.',
        }),
      ],
      constraints: [
        {
          id: 'k_tool_approval',
          formula: "SideEffects == 'Read only' || RequiresApproval == true",
          message:
            "= 'Tool \"' + Name + '\" changes data or acts outside, but needs no approval.'",
        },
        {
          id: 'k_tool_used',
          formula: "count(incoming('CanUse')) > 0",
          message: "= 'No flow or agent uses tool \"' + Name + '\".'",
        },
      ],
    },
    {
      key: 'RetrievalPipeline',
      label: 'Retrieval pipeline',
      help: 'The steps that find the right passages for a request: sources, chunking, embedding, the index, the retriever and the re-ranker. Place them inside it.',
      look: look('container', {
        // See-through, so the steps' connectors inside stay visible.
        fill: '#e7f5ff66',
        border: DATA.border,
        title: 'Heading',
        width: 280,
        height: 620,
      }),
      attributes: [
        long('Description'),
        formula(
          'LatencyMs',
          'sum(children().LatencyMs)',
          'number',
          'The latency of the steps inside, in milliseconds.',
          { label: 'Latency (ms)' },
        ),
        formula(
          'CostPerQuery',
          'round(sum(children().CostPerQuery), 4)',
          'number',
          'The cost of one search through the steps inside.',
        ),
        formula(
          'Heading',
          "Name + (LatencyMs > 0 ? ', ' + LatencyMs + ' ms' : '')",
          'text',
          'The name and the latency, shown as the heading on the diagram.',
        ),
      ],
    },
    {
      key: 'KnowledgeSource',
      label: 'Knowledge source',
      help: 'Content the solution searches, such as help articles, policies or past tickets.',
      look: look('document', {
        fill: DATA.fill,
        border: DATA.border,
        subtitle: 'SourceType',
        width: 120,
        height: 80,
      }),
      attributes: [
        long('Description'),
        choice('SourceType', [
          'Documents',
          'Web pages',
          'Tickets',
          'Database',
          'Wiki',
        ]),
        text('Owner'),
        choice('Refresh', ['Real time', 'Daily', 'Weekly', 'Monthly']),
        int('DocumentCount', { min: 0 }),
        bool('ContainsPersonalData'),
      ],
    },
    {
      key: 'Chunking',
      label: 'Chunking',
      help: 'How the content is split into passages before it is embedded.',
      look: look('pill', {
        fill: DATA.fill,
        border: DATA.border,
        subtitle: 'Settings',
        width: 210,
        height: 50,
      }),
      attributes: [
        choice('Strategy', [
          'Fixed size',
          'By heading',
          'By sentence',
          'By meaning',
        ]),
        int('ChunkSize', { label: 'Chunk size (tokens)', min: 1 }),
        int('Overlap', { label: 'Overlap (tokens)', min: 0 }),
        formula(
          'Settings',
          "(Strategy ?? 'Chunks') + (ChunkSize == null ? '' : ', ' + ChunkSize + ' tokens')",
          'text',
          'The strategy and the size, shown on the diagram.',
        ),
      ],
      constraints: [
        {
          id: 'k_chunk_overlap',
          formula:
            'ChunkSize == null || Overlap == null || Overlap < ChunkSize',
          message:
            "= 'The overlap of \"' + Name + '\" is not smaller than its chunk size.'",
        },
      ],
    },
    {
      key: 'EmbeddingModel',
      label: 'Embedding model',
      help: 'The model that turns passages and questions into vectors, so similar meanings lie close together.',
      look: look('hexagon', {
        fill: AI.fill,
        border: AI.border,
        icon: 'bot',
        subtitle: 'Dimensions',
        width: 210,
        height: 70,
      }),
      attributes: [
        text('Provider'),
        int('Dimensions', { min: 1, help: 'The length of each vector.' }),
        num('CostPer1kTokens', {
          label: 'Cost per 1,000 tokens',
          min: 0,
        }),
        num('LatencyMs', { label: 'Latency per query (ms)', min: 0 }),
      ],
    },
    {
      key: 'VectorIndex',
      label: 'Vector index',
      help: 'Where the vectors of all passages are stored and searched.',
      look: look('box', {
        fill: DATA.fill,
        border: DATA.border,
        icon: 'database',
        subtitle: 'SimilarityMeasure',
        width: 210,
        height: 70,
      }),
      attributes: [
        text('Technology'),
        choice('SimilarityMeasure', ['Cosine', 'Dot product', 'Distance']),
        int('Dimensions', { min: 1 }),
        int('ChunkCount', { min: 0 }),
      ],
      constraints: [
        {
          id: 'k_index_dimensions',
          formula:
            "Dimensions == null || IFERROR(incoming('Feeds')[0].Dimensions, null) == null || Dimensions == incoming('Feeds')[0].Dimensions",
          message:
            "= 'Vector index \"' + Name + '\" has ' + Dimensions + ' dimensions, but the embedding model that feeds it makes ' + incoming('Feeds')[0].Dimensions + '.'",
        },
      ],
    },
    {
      key: 'Retriever',
      label: 'Retriever',
      help: 'Finds the passages that match a question, by meaning, by keywords or both.',
      look: look('pill', {
        fill: DATA.fill,
        border: DATA.border,
        subtitle: 'SearchType',
        width: 210,
        height: 50,
      }),
      attributes: [
        choice('SearchType', ['By meaning', 'By keywords', 'Hybrid']),
        int('TopK', {
          label: 'Passages returned',
          min: 1,
          help: 'How many passages it returns.',
        }),
        num('MinScore', { label: 'Minimum similarity', min: 0, max: 1 }),
        num('LatencyMs', { label: 'Latency (ms)', min: 0 }),
      ],
    },
    {
      key: 'Reranker',
      label: 'Re-ranker',
      help: 'Puts the passages found in a better order and keeps the best few.',
      look: look('pill', {
        fill: DATA.fill,
        border: DATA.border,
        subtitle: 'Keeps',
        width: 210,
        height: 50,
      }),
      attributes: [
        text('Model'),
        int('TopN', {
          label: 'Passages kept',
          min: 1,
          help: 'How many passages it keeps.',
        }),
        num('LatencyMs', { label: 'Latency (ms)', min: 0 }),
        num('CostPerQuery', { min: 0 }),
        formula(
          'Keeps',
          "TopN == null ? '' : 'Keeps the best ' + TopN",
          'text',
          'Shown on the diagram.',
        ),
      ],
      constraints: [
        {
          id: 'k_reranker_topn',
          formula:
            "TopN == null || IFERROR(incoming('Feeds')[0].TopK, null) == null || TopN <= incoming('Feeds')[0].TopK",
          message:
            "= 'Re-ranker \"' + Name + '\" keeps more passages than the retriever returns.'",
        },
      ],
    },
    {
      key: 'HumanReview',
      label: 'Human review',
      help: 'A person who checks what a flow, agent or tool does, before or after it happens.',
      look: look('person', {
        fill: '#ffd8a8',
        border: '#f08c00',
        subtitle: 'When',
      }),
      attributes: [
        text('Reviewer', { help: 'The role that reviews.' }),
        choice('When', [
          'Before it happens',
          'On escalation',
          'Sample afterwards',
        ]),
        num('SamplePercent', { label: 'Sample (%)', min: 0, max: 100 }),
      ],
    },
  ],
  amend: {
    AIUseCase: {
      help: 'A user journey the solution serves, rated by the value it brings and how feasible it is.',
      attributes: [
        text('Persona', { help: 'Who asks, such as "customer" or "agent".' }),
        choice('Channel', [
          'Web chat',
          'Mobile app',
          'Email',
          'Phone',
          'Internal tool',
        ]),
        text('SuccessMeasure'),
      ],
    },
    FoundationModel: {
      help: 'A large pre-trained model used through prompts, with its price and speed.',
      attributes: [
        num('TimeToFirstToken', {
          label: 'Time to first token (ms)',
          min: 0,
        }),
        num('OutputTokensPerSecond', { min: 0 }),
      ],
      look: look('hexagon', {
        fill: AI.fill,
        border: AI.border,
        icon: 'bot',
        subtitle: 'Hosting',
        width: 180,
        height: 80,
      }),
    },
    Prompt: {
      help: 'The instructions given to a model, with the tokens it uses, so its cost and latency can be calculated.',
      attributes: [
        int('InputTokens', {
          min: 0,
          help: 'Tokens sent per call: instructions, context and question.',
        }),
        int('OutputTokens', { min: 0, help: 'Tokens of a typical answer.' }),
        num('CallsPerRequest', {
          min: 0,
          help: 'How often it runs per request, on average: 3 for three times, 0.2 for one request in five.',
        }),
        formula(
          'CostPerCall',
          `IFERROR(round((InputTokens + OutputTokens) / 1000 * ${MODEL}.CostPer1kTokens, 5), null)`,
          'number',
          'Input and output tokens times the price of its model.',
        ),
        formula(
          'LatencyPerCall',
          `IFERROR(round(${MODEL}.TimeToFirstToken + OutputTokens / ${MODEL}.OutputTokensPerSecond * 1000, 0), null)`,
          'number',
          'Time to first token plus the time to write the output, in milliseconds.',
          { label: 'Latency per call (ms)' },
        ),
        formula(
          'CostPerRequest',
          'CostPerCall == null ? null : round(CostPerCall * (CallsPerRequest ?? 1), 5)',
          'number',
          'Cost per call times calls per request.',
        ),
        formula(
          'LatencyPerRequest',
          'LatencyPerCall == null ? null : round(LatencyPerCall * (CallsPerRequest ?? 1), 0)',
          'number',
          'Latency per call times calls per request.',
          { label: 'Latency per request (ms)' },
        ),
        formula(
          'Summary',
          "'Version ' + (Version ?? '-') + ', ' + (CostPerRequest == null ? '-' : text(CostPerRequest)) + ' per request'",
          'text',
          'The version and the cost per request, shown on the diagram.',
        ),
      ],
      look: look('document', {
        fill: AI.fill,
        border: AI.border,
        subtitle: 'Summary',
        width: 150,
        height: 80,
      }),
      constraints: [
        {
          id: 'k_prompt_model',
          formula: "count(outgoing('UsesModel')) > 0",
          message:
            '= \'Prompt "\' + Name + \'" runs on no model: connect it to one with "Uses model".\'',
        },
      ],
    },
    AIAgent: {
      remove: ['Tools'],
      attributes: [
        int('MaxSteps', {
          min: 1,
          help: 'The most steps it may take for one request.',
        }),
        formula(
          'ToolCount',
          "count(outgoing('CanUse'))",
          'number',
          'How many tools it can use.',
          { label: 'Tools' },
        ),
        formula(
          'Guardrails',
          "count(incoming('Protects'))",
          'number',
          'How many guardrails protect it.',
        ),
        formula(
          'CostPerRequest',
          "round(sum(outgoing('Calls').CostPerRequest, outgoing('Retrieves').CostPerQuery), 5)",
          'number',
          'The cost of its prompts and retrieval per request.',
        ),
        formula(
          'LatencyPerRequest',
          "round(sum(outgoing('Calls').LatencyPerRequest, outgoing('Retrieves').LatencyMs), 0)",
          'number',
          'The time its prompts and retrieval take per request, in milliseconds.',
          { label: 'Latency per request (ms)' },
        ),
      ],
      constraints: [
        {
          id: 'k_agent_guardrail',
          formula: 'ToolCount == 0 || Guardrails > 0',
          message:
            "= 'Agent \"' + Name + '\" can use tools, but no guardrail protects it.'",
        },
        {
          id: 'k_agent_review',
          formula: "Autonomy != 'Acts alone' || count(incoming('Reviews')) > 0",
          message:
            "= 'Agent \"' + Name + '\" acts alone, and no person reviews it.'",
        },
        {
          id: 'k_agent_cost',
          formula:
            'CostLimit == null || CostPerRequest == null || CostPerRequest <= CostLimit',
          message:
            "= 'Agent \"' + Name + '\" costs ' + CostPerRequest + ' per request, more than its limit of ' + CostLimit + '.'",
        },
      ],
    },
    Guardrail: {
      attributes: [
        choice('Action', ['Block', 'Rewrite', 'Flag for review'], {
          help: 'What happens when the check fails.',
        }),
      ],
      look: look('hexagon', {
        fill: '#ffc9c9',
        border: '#e03131',
        icon: 'lock',
        subtitle: 'Type',
        width: 170,
        height: 70,
      }),
    },
    Evaluation: {
      help: 'A measured test of a flow, agent, prompt, model or retriever on a test set. Passed compares the score with the threshold.',
      attributes: [
        formula(
          'Reading',
          "(Metric ?? 'Score') + ' ' + (Score == null ? '-' : text(Score)) + ', at least ' + (Threshold == null ? '-' : text(Threshold))",
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
        width: 200,
      }),
      constraints: [
        {
          id: 'k_evaluation_target',
          formula: "count(outgoing('Evaluates')) > 0",
          message:
            '= \'Evaluation "\' + Name + \'" tests nothing: connect it with "Evaluates".\'',
        },
      ],
    },
  },
  relations: [
    {
      key: 'Handles',
      label: 'Handles',
      help: 'The flow serves the use case.',
      from: ['Orchestration'],
      to: ['AIUseCase'],
      look: line('#2f9e44'),
    },
    {
      key: 'Calls',
      label: 'Calls',
      help: 'The flow or agent sends the prompt to its model.',
      from: ['Orchestration', 'AIAgent'],
      to: ['Prompt'],
      look: line(AI.border),
    },
    {
      key: 'Coordinates',
      label: 'Coordinates',
      help: 'The flow hands part of the work to the agent.',
      from: ['Orchestration'],
      to: ['AIAgent'],
      look: line(AI.border, { end: 'triangle' }),
    },
    {
      key: 'CanUse',
      label: 'Can use',
      help: 'The flow or agent may call the tool.',
      from: ['Orchestration', 'AIAgent'],
      to: ['Tool'],
      look: line('#495057'),
    },
    {
      key: 'Retrieves',
      label: 'Retrieves from',
      help: 'The flow or agent finds context through the retrieval pipeline.',
      from: ['Orchestration', 'AIAgent'],
      to: ['RetrievalPipeline'],
      look: line(DATA.border, { style: 'dashed' }),
    },
    {
      key: 'Feeds',
      label: 'Feeds',
      help: 'One retrieval step passes its result to the next.',
      from: RETRIEVAL_STEPS.slice(0, -1),
      to: RETRIEVAL_STEPS.slice(1),
      look: line(DATA.border),
    },
    {
      key: 'Protects',
      label: 'Protects',
      help: 'The guardrail checks what goes into or comes out of the flow, agent, prompt or tool.',
      from: ['Guardrail'],
      to: ['Orchestration', 'AIAgent', 'Prompt', 'Tool'],
      look: line('#e03131', { end: 'bar' }),
    },
    {
      key: 'Reviews',
      label: 'Reviews',
      help: 'A person checks what the flow, agent or tool does.',
      from: ['HumanReview'],
      to: ['Orchestration', 'AIAgent', 'Tool'],
      look: line('#f08c00', { style: 'dashed' }),
    },
  ],
  amendRelations: {
    UsesModel: { from: ['Prompt'], replace: true },
    Evaluates: { to: ['Orchestration', 'AIAgent', 'Retriever'] },
  },
  modelTypes: [
    {
      key: 'GenAISolution',
      label: 'Generative AI solution',
      help: 'Use cases, the flow that handles them, prompts and foundation models, a retrieval pipeline, agents and tools, guardrails, evaluations and human review.',
      views: [
        {
          key: 'Flow',
          label: 'Flow',
          classes: [
            'AIUseCase',
            'Orchestration',
            'Prompt',
            'FoundationModel',
            'AIAgent',
            'Tool',
            'RetrievalPipeline',
          ],
          relations: [
            'Handles',
            'Calls',
            'Coordinates',
            'UsesModel',
            'CanUse',
            'Retrieves',
          ],
        },
        {
          key: 'Retrieval',
          label: 'Retrieval',
          classes: ['RetrievalPipeline', ...RETRIEVAL_STEPS, 'Evaluation'],
          relations: ['Feeds', 'Evaluates'],
        },
        {
          key: 'Safety',
          label: 'Guardrails and evaluation',
          classes: [
            'Orchestration',
            'AIAgent',
            'Tool',
            'Prompt',
            'Guardrail',
            'HumanReview',
            'Evaluation',
          ],
          relations: ['Protects', 'Reviews', 'Evaluates'],
        },
      ],
      containers: { RetrievalPipeline: RETRIEVAL_STEPS },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        text('Owner'),
        formula(
          'TotalMonthlyCost',
          "sum(objects('Orchestration').MonthlyCost)",
          'number',
          'The monthly cost of all flows.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'Orchestration',
      tabs: [
        {
          label: 'Flow',
          items: [
            'Name',
            { attribute: 'Pattern', control: 'select' },
            { attribute: 'Description', control: 'textarea' },
          ],
        },
        {
          label: 'Cost and latency',
          items: [
            'RequestsPerDay',
            'CostPerRequest',
            'LatencyPerRequest',
            'DailyCost',
            'MonthlyCost',
          ],
        },
      ],
      showRelations: true,
    },
    {
      class: 'Prompt',
      tabs: [
        {
          label: 'Prompt',
          items: [
            'Name',
            'Version',
            'Owner',
            { attribute: 'Template', control: 'textarea' },
          ],
        },
        {
          label: 'Cost and latency',
          items: [
            'InputTokens',
            'OutputTokens',
            'CallsPerRequest',
            'CostPerCall',
            'LatencyPerCall',
            'CostPerRequest',
            'LatencyPerRequest',
          ],
        },
      ],
      showRelations: true,
    },
    {
      class: 'AIAgent',
      tabs: [
        {
          label: 'Agent',
          items: [
            'Name',
            { attribute: 'Autonomy', control: 'segmented' },
            'MaxSteps',
            'CostLimit',
            { attribute: 'Description', control: 'textarea' },
          ],
        },
        {
          label: 'Checks',
          items: [
            'ToolCount',
            'Guardrails',
            'CostPerRequest',
            'LatencyPerRequest',
          ],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'support-assistant.mkmodel.json',
    id: 'mdl_supportassistant',
    name: 'Customer support assistant',
    modelType: 'GenAISolution',
    attributes: {
      Title: 'Customer support assistant',
      Organisation: 'An online retailer',
      Owner: 'Head of customer service',
    },
    // The returns agent can use tools but no guardrail protects it, on purpose.
    intendedWarnings: 1,
    elements: [
      e('uc_orders', 'AIUseCase', 730, 20, {
        Name: 'Answer questions about orders',
        Value: 4,
        Feasibility: 5,
        Status: 'In production',
        Persona: 'Customer',
        Channel: 'Web chat',
        SuccessMeasure: 'Questions solved without an agent',
      }),
      e('uc_returns', 'AIUseCase', 920, 20, {
        Name: 'Arrange a return',
        Value: 4,
        Feasibility: 3,
        Status: 'Pilot',
        Persona: 'Customer',
        Channel: 'Web chat',
        SuccessMeasure: 'Returns arranged in the chat',
      }),
      e('g_in', 'Guardrail', 350, 40, {
        Name: 'Mask personal data',
        Type: 'Input',
        Rule: 'Replace card numbers and passwords in the question before it reaches a model.',
        Action: 'Rewrite',
      }),
      e('g_out', 'Guardrail', 540, 40, {
        Name: 'Answer from sources only',
        Type: 'Output',
        Rule: 'Every answer cites a help article or order record; otherwise hand over to a person.',
        Action: 'Flag for review',
      }),
      e('orch', 'Orchestration', 420, 190, {
        Name: 'Support assistant',
        Pattern: 'Retrieval and answer',
        RequestsPerDay: 4000,
        Description:
          'Routes each question, answers from the help centre, and hands returns to the returns agent.',
      }),
      e('p_route', 'Prompt', 360, 380, {
        Name: 'Route the question',
        Version: '2',
        Owner: 'Support product team',
        InputTokens: 400,
        OutputTokens: 20,
        CallsPerRequest: 1,
      }),
      e('p_answer', 'Prompt', 560, 380, {
        Name: 'Answer with sources',
        Version: '5',
        Owner: 'Support product team',
        InputTokens: 3000,
        OutputTokens: 300,
        CallsPerRequest: 0.8,
      }),
      e('fm_small', 'FoundationModel', 370, 540, {
        Name: 'Small fast model',
        Provider: 'Open model, run in-house',
        Hosting: 'Private cloud',
        ContextWindow: 32000,
        CostPer1kTokens: 0.0005,
        TimeToFirstToken: 200,
        OutputTokensPerSecond: 150,
      }),
      e('fm_large', 'FoundationModel', 760, 540, {
        Name: 'Large language model',
        Provider: 'External model service',
        Hosting: 'Provider service',
        ContextWindow: 200000,
        CostPer1kTokens: 0.01,
        TimeToFirstToken: 600,
        OutputTokensPerSecond: 100,
      }),
      e('a_returns', 'AIAgent', 1000, 200, {
        Name: 'Returns agent',
        Autonomy: 'Acts with approval',
        MaxSteps: 5,
        CostLimit: 0.05,
      }),
      e('p_returns', 'Prompt', 1000, 400, {
        Name: 'Returns agent instructions',
        Version: '1',
        Owner: 'Support product team',
        InputTokens: 2000,
        OutputTokens: 200,
        CallsPerRequest: 0.6,
      }),
      e('t_lookup', 'Tool', 1180, 170, {
        Name: 'Look up order',
        System: 'Order system',
        SideEffects: 'Read only',
      }),
      e('t_label', 'Tool', 1180, 240, {
        Name: 'Create return label',
        System: 'Shipping system',
        SideEffects: 'Changes data',
        RequiresApproval: true,
      }),
      e('t_refund', 'Tool', 1180, 310, {
        Name: 'Issue refund',
        System: 'Payment system',
        SideEffects: 'Acts outside',
        RequiresApproval: true,
      }),
      e('hr_lead', 'HumanReview', 1220, 420, {
        Name: 'Support team lead',
        Reviewer: 'Team lead on duty',
        When: 'Before it happens',
      }),
      e('ev_correct', 'Evaluation', 1000, 570, {
        Name: 'Answer correctness',
        TestSet: '500 real questions with checked answers',
        Metric: 'Correct',
        Score: 0.91,
        Threshold: 0.9,
      }),
      e('ev_ground', 'Evaluation', 1000, 660, {
        Name: 'Answers backed by sources',
        TestSet: '500 real questions with checked answers',
        Metric: 'Grounded',
        Score: 0.96,
        Threshold: 0.95,
      }),
      e('ev_hit', 'Evaluation', 360, 690, {
        Name: 'Right article found',
        TestSet: '300 questions with their article',
        Metric: 'Hit rate',
        Score: 0.88,
        Threshold: 0.85,
      }),
      // The retrieval pipeline.
      e(
        'pipeline',
        'RetrievalPipeline',
        40,
        170,
        { Name: 'Help centre search' },
        { w: 280, h: 620 },
      ),
      step('src_help', 'KnowledgeSource', 55, 220, {
        Name: 'Help articles',
        SourceType: 'Web pages',
        Owner: 'Customer service',
        Refresh: 'Daily',
        DocumentCount: 1200,
      }),
      step('src_policy', 'KnowledgeSource', 185, 220, {
        Name: 'Returns policy',
        SourceType: 'Documents',
        Owner: 'Legal team',
        Refresh: 'Monthly',
        DocumentCount: 12,
      }),
      step('chunk', 'Chunking', 75, 350, {
        Name: 'Split by heading',
        Strategy: 'By heading',
        ChunkSize: 400,
        Overlap: 40,
      }),
      step('emb', 'EmbeddingModel', 75, 430, {
        Name: 'Embedding model',
        Provider: 'External model service',
        Dimensions: 1024,
        CostPer1kTokens: 0.0001,
        LatencyMs: 40,
      }),
      step('idx', 'VectorIndex', 75, 525, {
        Name: 'Article index',
        SimilarityMeasure: 'Cosine',
        Dimensions: 1024,
        ChunkCount: 9800,
      }),
      step('ret', 'Retriever', 75, 620, {
        Name: 'Hybrid search',
        SearchType: 'Hybrid',
        TopK: 20,
        MinScore: 0.3,
        LatencyMs: 80,
      }),
      step('rr', 'Reranker', 75, 705, {
        Name: 'Re-ranker',
        Model: 'Cross-encoder',
        TopN: 5,
        LatencyMs: 150,
        CostPerQuery: 0.001,
      }),
    ],
    connectors: [
      c('Handles', 'orch', 'uc_orders'),
      c('Handles', 'orch', 'uc_returns'),
      c('Protects', 'g_in', 'orch'),
      c('Protects', 'g_out', 'orch'),
      c('Calls', 'orch', 'p_route'),
      c('Calls', 'orch', 'p_answer'),
      c('UsesModel', 'p_route', 'fm_small'),
      c('UsesModel', 'p_answer', 'fm_large'),
      c('UsesModel', 'p_returns', 'fm_large'),
      c('Retrieves', 'orch', 'pipeline'),
      c('Coordinates', 'orch', 'a_returns'),
      c('Calls', 'a_returns', 'p_returns'),
      c('CanUse', 'a_returns', 't_lookup'),
      c('CanUse', 'a_returns', 't_label'),
      c('CanUse', 'a_returns', 't_refund'),
      c('Reviews', 'hr_lead', 't_refund'),
      c('Evaluates', 'ev_correct', 'orch'),
      c('Evaluates', 'ev_ground', 'orch'),
      c('Evaluates', 'ev_hit', 'ret'),
      c('Feeds', 'src_help', 'chunk'),
      c('Feeds', 'src_policy', 'chunk'),
      c('Feeds', 'chunk', 'emb'),
      c('Feeds', 'emb', 'idx'),
      c('Feeds', 'idx', 'ret'),
      c('Feeds', 'ret', 'rr'),
    ],
  },
};
