import type { AssistantProvider, CompletionRequest } from './provider';

/**
 * A provider for tests: it answers with the given replies in order and records every request it
 * receives. It never touches the network.
 */
export function scriptedProvider(replies: string[]): AssistantProvider & {
  requests: CompletionRequest[];
  keys: string[];
} {
  const requests: CompletionRequest[] = [];
  const keys: string[] = [];
  let next = 0;
  return {
    id: 'scripted',
    requests,
    keys,
    async test() {
      return 'ok';
    },
    async complete(request, key) {
      requests.push(structuredClone(request));
      keys.push(key);
      const reply = replies[Math.min(next, replies.length - 1)];
      next++;
      if (reply === undefined) throw new Error('No reply was scripted.');
      return reply;
    },
  };
}
