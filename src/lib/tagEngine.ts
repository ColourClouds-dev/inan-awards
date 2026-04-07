'use client';

import type { FeedbackResponse, FeedbackForm, ResponseTag, CustomTagRule } from '../types';

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

export function computeCustomTags(
  responses: Record<string, string | number>,
  rules: CustomTagRule[]
): ResponseTag[] {
  const tags: ResponseTag[] = [];
  for (const rule of rules) {
    const val = responses[rule.condition.questionId];
    if (val === undefined) continue;
    const strVal = String(val).toLowerCase();
    const ruleVal = rule.condition.value.toLowerCase();
    const numVal = typeof val === 'number' ? val : parseFloat(String(val));

    let matched = false;
    switch (rule.condition.operator) {
      case 'contains':
        matched = strVal.includes(ruleVal);
        break;
      case 'equals':
        matched = strVal === ruleVal;
        break;
      case 'less_than':
        matched = !isNaN(numVal) && numVal < parseFloat(ruleVal);
        break;
      case 'greater_than':
        matched = !isNaN(numVal) && numVal > parseFloat(ruleVal);
        break;
    }
    if (matched) {
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
