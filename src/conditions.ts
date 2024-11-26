import { log, BigInt, BigDecimal } from '@graphprotocol/graph-ts';

import {
  ConditionPreparation,
  ConditionResolution
} from '../generated/ConditionalTokens/ConditionalTokens';

import { Condition, Question, Category, ScalarQuestionLink } from '../generated/schema';

import { requireGlobal, sum } from './utils';

export function assignQuestionToCondition(condition: Condition, questionId: string): void {
  condition.question = questionId;
  let question = Question.load(questionId);
  if (question == null) return;

  if (question.category) {
    let category = Category.load(question.category as string);
    if (category) {
      category.numConditions++;
      category.numOpenConditions++;
      category.save();
    }
  }

  if (question.title) {
    condition.title = question.title;
  }

  if (question.outcomes) {
    condition.outcomes = question.outcomes;
  }
} 