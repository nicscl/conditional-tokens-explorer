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
    let category = Category.load(question.category);
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

export function handleConditionPreparation(event: ConditionPreparation): void {
  let conditionId = event.params.conditionId.toHex()
  let condition = new Condition(conditionId);
  condition.conditionId = conditionId;

  condition.oracle = event.params.oracle.toHex();
  condition.questionId = event.params.questionId.toHex();
  condition.outcomeSlotCount = event.params.outcomeSlotCount.toI32();

  condition.creator = event.transaction.from.toHex();
  condition.createTransaction = event.transaction.hash;
  condition.createTimestamp = event.block.timestamp;
  condition.createBlockNumber = event.block.number;

  condition.resolved = false;

  if (event.params.oracle.toHexString() == '0x464c94ea90fc7d0d08bb956cffb9acfe3aaa5313') {
    assignQuestionToCondition(condition, event.params.questionId.toHexString());
  } else if (event.params.oracle.toHexString() == '0xcf7f9472fab9372b34d96fbe1b57966b13951dbf') {
    let linkId = event.params.questionId.toHexString();
    let link = ScalarQuestionLink.load(linkId);
    if (link != null) {
      assignQuestionToCondition(condition, link.realityEthQuestionId.toHexString());
      condition.scalarLow = link.scalarLow;
      condition.scalarHigh = link.scalarHigh;
    }
  } else {
    log.warning('Condition oracle address {} is not a known RealitioProxy address.', [condition.oracle]);
    assignQuestionToCondition(condition, event.params.questionId.toHexString());
  }

  condition.save();

  let global = requireGlobal();
  global.numConditions += 1
  global.save()
}

export function handleConditionResolution(event: ConditionResolution): void {
  let payoutNumerators = event.params.payoutNumerators;

  let condition = Condition.load(event.params.conditionId.toHex());

  if (condition == null) {
    log.error('condition {} could not be found', [
      event.params.conditionId.toHex(),
    ]);
    return;
  }

  condition.payoutNumerators = payoutNumerators;
  let denominator: BigInt = sum(payoutNumerators);
  condition.payoutDenominator = denominator;
  let denominatorBD: BigDecimal = denominator.toBigDecimal();
  let payouts = new Array<BigDecimal>(payoutNumerators.length);
  for (let i = 0; i < payouts.length; i++) {
    payouts[i] = payoutNumerators[i].divDecimal(denominatorBD);
  }
  condition.payouts = payouts;

  condition.resolved = true;
  condition.resolveTransaction = event.transaction.hash;
  condition.resolveTimestamp = event.block.timestamp;
  condition.resolveBlockNumber = event.block.number;

  condition.save();
}
