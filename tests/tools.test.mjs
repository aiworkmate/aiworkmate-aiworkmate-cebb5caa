import assert from 'node:assert/strict';
import test from 'node:test';

import { planTools, runTool } from '../server/modules/tools.mjs';

test('planTools detects calculator expressions', () => {
  const plan = planTools({ message: 'Calculate 2 + 3 * 4', enableLive: false });
  assert.ok(plan.some((t) => t.name === 'calculator'));
  assert.ok(plan.find((t) => t.name === 'calculator').input.expression);
});

test('planTools detects weather queries', () => {
  const plan = planTools({ message: 'What is the weather in Paris?', enableLive: true });
  assert.ok(plan.some((t) => t.name === 'weather'));
});

test('planTools detects weather with forecast keyword', () => {
  const plan = planTools({ message: 'Show me the forecast for London', enableLive: true });
  assert.ok(plan.some((t) => t.name === 'weather'));
});

test('planTools skips weather when enableLive is false', () => {
  const plan = planTools({ message: 'Weather in Tokyo', enableLive: false });
  assert.ok(!plan.some((t) => t.name === 'weather'));
});

test('planTools detects news queries', () => {
  const plan = planTools({ message: 'What are the latest news headlines?', enableLive: true });
  assert.ok(plan.some((t) => t.name === 'news'));
});

test('planTools detects web search for live data', () => {
  const plan = planTools({ message: 'What is the current stock price of AAPL?', enableLive: true });
  assert.ok(plan.some((t) => t.name === 'web_search'));
});

test('planTools detects medical research queries', () => {
  const plan = planTools({ message: 'Find pubmed articles on diabetes', enableLive: true });
  assert.ok(plan.some((t) => t.name === 'medical_research'));
});

test('planTools detects medical mode', () => {
  const plan = planTools({ message: 'Analyze these results', mode: 'medical', enableLive: true });
  assert.ok(plan.some((t) => t.name === 'medical_research'));
});

test('planTools returns empty for simple chat without live', () => {
  const plan = planTools({ message: 'Hello, how are you?', enableLive: false });
  assert.equal(plan.length, 0);
});

test('planTools limits to 5 tools max', () => {
  const plan = planTools({
    message: 'Calculate 1+1, weather forecast, latest news headlines, pubmed clinical trial research, current stock price near me',
    enableLive: true
  });
  assert.ok(plan.length <= 5);
});

test('planTools does not duplicate web_search', () => {
  const plan = planTools({ message: 'What is the latest news today?', enableLive: true });
  const webSearchCount = plan.filter((t) => t.name === 'web_search').length;
  assert.ok(webSearchCount <= 1);
});

test('runTool calculator evaluates expressions', async () => {
  const result = await runTool('calculator', { expression: '2 + 3 * 4' });
  assert.equal(result.value, 14);
  assert.ok(result.expression);
});

test('runTool calculator handles parentheses', async () => {
  const result = await runTool('calculator', { expression: '(2 + 3) * 4' });
  assert.equal(result.value, 20);
});

test('runTool calculator rejects unsafe expressions', async () => {
  await assert.rejects(() => runTool('calculator', { expression: 'process.exit()' }));
});

test('runTool calculator rejects empty expression', async () => {
  await assert.rejects(() => runTool('calculator', { expression: '' }));
});

test('runTool throws for unknown tool', async () => {
  await assert.rejects(() => runTool('nonexistent', {}), /Unknown tool/);
});
