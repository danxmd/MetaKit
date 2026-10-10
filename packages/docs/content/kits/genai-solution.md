---
id: genai-solution
title: Generative AI solution
category: kits
summary: A built-in Kit for generative AI solutions, with use cases, the flow, prompts and foundation models, a retrieval pipeline, agents and tools, guardrails, evaluations, human review, and the cost and latency of each request.
keywords: [generative ai, genai, llm, foundation model, prompt, retrieval, rag, chunking, embedding, vector index, retriever, re-ranker, agent, tool, guardrail, llm evaluation, human review, cost per request, latency per request, tokens, orchestration]
contexts: []
order: 110
---

**Generative AI solution** is a built-in Kit for designing a solution built on large language models: what it is for, how a request flows, where its context comes from, what its agents may do, what keeps it safe, and what each request costs and how long it takes.

## What it is

An **orchestration flow** handles one or more **use cases**. It **calls** prompts, each running on a **foundation model**, **retrieves** context through a **retrieval pipeline**, and **coordinates** agents that **can use** tools. **Guardrails** protect the flow, its agents, prompts and tools; **evaluations** measure it; **human review** checks it. From the tokens of each prompt and the price and speed of its model, the Kit calculates the cost and latency per request and the cost per month.

| Class | What it stands for |
| --- | --- |
| **AI use case** | A user journey the solution serves, with the persona, channel and success measure. |
| **Orchestration flow** | The flow that handles a request, with its pattern and requests per day. |
| **Prompt** | Instructions given to a model, with input and output tokens and calls per request. |
| **Foundation model** | A large pre-trained model, with its price per 1,000 tokens, time to first token and output speed. |
| **AI agent** | A program that plans and acts with tools, with its autonomy, maximum steps and cost limit. |
| **Tool** | A function a flow or agent may call: read only, changes data, or acts outside. |
| **Retrieval pipeline** | A container for the retrieval steps. |
| **Knowledge source** | Content to search, such as help articles or policies. |
| **Chunking** | How content is split: strategy, chunk size and overlap in tokens. |
| **Embedding model** | Turns text into vectors, with their number of dimensions. |
| **Vector index** | Stores and searches the vectors. |
| **Retriever** | Finds matching passages by meaning, keywords or both, and how many it returns. |
| **Re-ranker** | Puts the passages in a better order and keeps the best few. |
| **Guardrail** | A check on input or output, or a policy, and what happens when it fails. |
| **Evaluation** | A measured test with a score and a threshold. |
| **Human review** | A person who checks before it happens, on escalation, or a sample afterwards. |

| Relation class | From | To |
| --- | --- | --- |
| **Handles** | Orchestration flow | AI use case |
| **Calls** | Orchestration flow, AI agent | Prompt |
| **Uses model** | Prompt | Foundation model |
| **Coordinates** | Orchestration flow | AI agent |
| **Can use** | Orchestration flow, AI agent | Tool |
| **Retrieves from** | Orchestration flow, AI agent | Retrieval pipeline |
| **Feeds** | One retrieval step | The next retrieval step |
| **Protects** | Guardrail | Orchestration flow, AI agent, Prompt, Tool |
| **Reviews** | Human review | Orchestration flow, AI agent, Tool |
| **Evaluates** | Evaluation | Foundation model, Prompt, Orchestration flow, AI agent, Retriever |

AI use case, Foundation model, Prompt, AI agent, Guardrail and Evaluation come from the class catalog ([[class-catalog]]).

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Customer support assistant" is `kits/genai-solution/support-assistant.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Generative AI solution**, or import the sample ([[import-export]]).
3. Place the **use cases** and an **orchestration flow** that **handles** them. Enter its **Requests per day**.
4. Add the **prompts** the flow **calls**, with their tokens and **Calls per request**, and connect each to its **foundation model** with **Uses model**. Fill in the price and speed of each model.
5. Draw a **retrieval pipeline** and place its steps inside it, connected in order with **Feeds**. Connect the flow to the pipeline with **Retrieves from**.
6. Add **agents** and the **tools** they can use. Mark what each tool does under **Side effects**.
7. Add **guardrails**, **evaluations** and **human review**, and connect them to what they protect, test or check.
8. Read the cost and latency on the flow, and open the Problems panel ([[problems-panel]]).

## Every option explained

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Cost per call** | Prompt | (Input tokens + output tokens) ÷ 1,000 × the price of its model. |
| **Latency per call (ms)** | Prompt | Time to first token + output tokens ÷ tokens per second × 1,000. |
| **Cost per request**, **Latency per request** | Prompt | The values per call times **Calls per request** (1 when empty). 0.2 means one request in five; 3 means three times. |
| **Cost per request**, **Latency per request** | AI agent | The sum over the prompts it calls and the pipeline it retrieves from. |
| **Tools**, **Guardrails** | AI agent | How many tools it can use and how many guardrails protect it. |
| **Latency (ms)**, **Cost per query** | Retrieval pipeline | The sums over the steps inside. The heading shows the latency. |
| **Cost per request** | Orchestration flow | The sum over its prompts, agents and retrieval. |
| **Latency per request (ms)** | Orchestration flow | The same sum of latencies, as if the steps run one after the other. |
| **Daily cost**, **Monthly cost** | Orchestration flow | Cost per request × requests per day, and that × 30. |
| **Total monthly cost** | The model | The monthly cost of all flows. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- an agent can use tools, but no guardrail protects it;
- an agent acts alone and no person reviews it, or costs more per request than its limit;
- a tool changes data or acts outside but needs no approval, or nothing uses it;
- a flow handles no use case, has no input and output guardrail, or has no evaluation;
- a prompt runs on no model;
- a vector index has another number of dimensions than the embedding model that feeds it;
- a re-ranker keeps more passages than the retriever returns;
- the overlap of a chunking step is not smaller than its chunk size;
- an evaluation tests nothing.

### Model type and views

**Generative AI solution** holds all classes. Its views are **Flow**, **Retrieval** and **Guardrails and evaluation** ([[model-types]]).

## Examples

In the sample, an online retailer runs a support assistant for 4,000 requests a day. It routes each question with a small fast model, answers from help articles with a large model, and hands returns to the returns agent. Per request this costs about 0.041 and takes about 5 seconds, so about 4,900 a month. Two guardrails protect the flow, which passes its correctness and grounding evaluations; the retriever passes its hit-rate test.

The sample shows one warning on purpose: the returns agent can use three tools, but no guardrail protects it. The refund tool needs approval and a team lead reviews it, but the agent itself still needs a guardrail.

## Good to know

- **Prices are per 1,000 tokens** and the Kit uses one price for input and output. Use an average if your model prices them differently.
- **Calls per request is an average.** A prompt used by an agent that handles one request in five, with three steps each time, has 0.6.
- **Model names and providers are free text.** The Kit names no product.
- Use the [[ai-risk-compliance]] Kit to record the risk tier and obligations of the solution, and [[ml-lifecycle]] for models you train yourself.

## Related

[[built-in-kits]] · [[ml-lifecycle]] · [[ai-risk-compliance]] · [[computed-values]] · [[containers-swimlanes]] · [[formula-reference]]
