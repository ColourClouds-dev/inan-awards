'use client';

import type { FeedbackForm, ResponseTag, CustomTagRule } from '../types';

export function computeTimeTag(seconds: number): ResponseTag {
  if (seconds < 60) return { label: 'Fast (<1 min)', type: 'time', color: 'green' };
  if (seconds <= 300) return { label: 'Normal (1-5 min)', type: 'time', color: 'blue' };
  return { label: 'Slow (>5 min)', type: 'time', color: 'yellow' };
}

export function computeSentimentTag(responses: Record<string, string | number>): ResponseTag {
  const ratings = Object.values(responses).filter(v => typeof v === 'number') as number[];
  if (ratings.length === 0) return { label: 'No Rating', type: 'sentiment', color: 'gray' };
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  if (avg >= 4) return { label: 'Positive', type: 'sentiment', color: 'green' };
  if (avg >= 2.5) return { label: 'Neutral', type: 'sentiment', color: 'yellow' };
  return { label: 'Negative', type: 'sentiment', color: 'red' };
}

export function computeCompletionTag(
  responses: Record<string, string | number>,
  form: FeedbackForm
): ResponseTag {
  const required = form.questions.filter(q => q.required);
  const answered = required.filter(q => {
    const val = responses[q.id];
    return val !== undefined && val !== '' && val !== null;
  });
  if (answered.length === required.length) {
    return { label: 'Complete', type: 'completion', color: 'green' };
  }
  return { label: `Partial (${answered.length}/${required.length})`, type: 'completion', color: 'yellow' };
}

// Evaluate a single condition against a response value
function evaluateCondition(
  val: string | number | undefined,
  operator: CustomTagRule['condition']['operator'],
  ruleVal: string
): boolean {
  if (val === undefined) return false;
  const strVal = String(val).toLowerCase();
  const ruleValLower = ruleVal.toLowerCase();
  const numVal = typeof val === 'number' ? val : parseFloat(String(val));

  switch (operator) {
    case 'contains':
      return strVal.includes(ruleValLower);
    case 'equals':
      return strVal === ruleValLower;
    case 'less_than':
      return !isNaN(numVal) && numVal < parseFloat(ruleVal);
    case 'greater_than':
      return !isNaN(numVal) && numVal > parseFloat(ruleVal);
    default:
      return false;
  }
}

export function computeCustomTags(
  responses: Record<string, string | number>,
  rules: CustomTagRule[]
): ResponseTag[] {
  const tags: ResponseTag[] = [];

  for (const rule of rules) {
    // Use multi-condition array if present, otherwise fall back to legacy single condition
    const conditions = rule.conditions && rule.conditions.length > 0
      ? rule.conditions
      : [rule.condition];

    // AND logic — every condition must match
    const allMatch = conditions.every(cond =>
      evaluateCondition(responses[cond.questionId], cond.operator, cond.value)
    );

    if (allMatch) {
      tags.push({ label: rule.label, type: 'custom', color: rule.color });
    }
  }

  return tags;
}

export function computeAllTags(
  responses: Record<string, string | number>,
  form: FeedbackForm,
  timeSpentSeconds?: number
): ResponseTag[] {
  const tags: ResponseTag[] = [];
  if (timeSpentSeconds !== undefined) tags.push(computeTimeTag(timeSpentSeconds));
  tags.push(computeSentimentTag(responses));
  tags.push(computeCompletionTag(responses, form));
  if (form.customTagRules?.length) {
    tags.push(...computeCustomTags(responses, form.customTagRules));
  }
  return tags;
}

export function isNegativeResponse(tags: ResponseTag[]): boolean {
  return tags.some(t => t.type === 'sentiment' && t.label === 'Negative');
}

export function hasCustomTags(tags: ResponseTag[]): boolean {
  return tags.some(t => t.type === 'custom');
}
