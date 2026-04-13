import { INTENT_STAGES, type ArchetypeTemplate, type IntentStage, type ExpandedSubtopic, type Topic } from './types.js';

/**
 * Tag each topic with a primary intent stage drawn from the archetype's
 * intent weights. Uses deterministic ceiling allocation so that the
 * distribution of primary intents across topics matches the weights as
 * closely as integer arithmetic allows.
 */
export function tagTopicsWithPrimaryIntent(
  topics: Topic[],
  template: ArchetypeTemplate,
): ExpandedSubtopic[] {
  const weights = template.weights.intents;
  const total = topics.length;

  const targetCounts: Record<IntentStage, number> = {
    learning: Math.round(weights.learning * total),
    discovery: Math.round(weights.discovery * total),
    evaluation: Math.round(weights.evaluation * total),
    validation: Math.round(weights.validation * total),
    acquisition: Math.round(weights.acquisition * total),
  };

  let sum = Object.values(targetCounts).reduce((a, b) => a + b, 0);
  const sortedIntents: IntentStage[] = [...INTENT_STAGES].sort(
    (a, b) => weights[b] - weights[a],
  );

  let cursor = 0;
  while (sum < total) {
    const stage = sortedIntents[cursor % sortedIntents.length] as IntentStage;
    targetCounts[stage] += 1;
    sum += 1;
    cursor += 1;
  }
  while (sum > total) {
    const stage = sortedIntents[sortedIntents.length - 1 - (cursor % sortedIntents.length)] as IntentStage;
    if (targetCounts[stage] > 0) {
      targetCounts[stage] -= 1;
      sum -= 1;
    }
    cursor += 1;
    if (cursor > 10000) break;
  }

  const assignment: IntentStage[] = [];
  for (const stage of INTENT_STAGES) {
    for (let i = 0; i < targetCounts[stage]; i++) {
      assignment.push(stage);
    }
  }

  return topics.map((topic, i) => ({
    ...topic,
    primaryIntent: (assignment[i] ?? 'discovery') as IntentStage,
  }));
}
