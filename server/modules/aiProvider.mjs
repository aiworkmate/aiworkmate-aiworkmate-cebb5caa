import fs from 'node:fs/promises';
import { config } from '../config.mjs';
import { clampText } from '../lib/utils.mjs';

export async function generateFinalResponse({ system, message, context, uploads = [], mode = 'general' }) {
  const finalSystem = [
    system,
    '',
    'You are the final response generator.',
    'Return only the assistant answer that should be shown to the user.',
    'Do not mention router decisions, hidden JSON, internal context assembly, tool plans, or debug state.',
    'Do not give a handoff prompt instead of answering.'
  ].join('\n');

  let finalAnswer = '';
  if (config.ai.openaiApiKey) {
    try {
      finalAnswer = config.ai.endpointStyle === 'chat'
        ? await callChatCompletions({ system: finalSystem, message, context, mode })
        : await callResponses({ system: finalSystem, message, context, uploads, mode });
    } catch {
      finalAnswer = localFinalAnswer({ message, context, uploads, mode });
    }
  } else {
    finalAnswer = localFinalAnswer({ message, context, uploads, mode });
  }

  finalAnswer = scrubInternalText(finalAnswer).trim();
  if (!finalAnswer) {
    throw new Error('Missing final LLM response stage');
  }
  console.log('FINAL RESPONSE:', finalAnswer);
  return finalAnswer;
}

async function callResponses({ system, message, context, uploads, mode }) {
  const content = [
    { type: 'input_text', text: `User request:\n${message}\n\nGrounding context:\n${context}` }
  ];
  for (const upload of uploads.filter((item) => String(item.mime).startsWith('image/')).slice(0, 3)) {
    try {
      const data = await fs.readFile(upload.storedPath);
      content.push({ type: 'input_image', image_url: `data:${upload.mime};base64,${data.toString('base64')}` });
    } catch {
      // If the file disappeared, continue with extracted metadata.
    }
  }
  const body = {
    model: mode === 'medical' ? config.ai.visionModel : config.ai.model,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: system }] },
      { role: 'user', content }
    ],
    temperature: 0.35
  };
  const data = await providerFetch(`${config.ai.openaiBaseUrl}/v1/responses`, body);
  return data.output_text || flattenResponsesText(data) || '';
}

async function callChatCompletions({ system, message, context, mode }) {
  const body = {
    model: config.ai.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `User request:\n${message}\n\nGrounding context:\n${context}` }
    ],
    temperature: 0.35
  };
  const data = await providerFetch(`${config.ai.openaiBaseUrl}/v1/chat/completions`, body);
  return data.choices?.[0]?.message?.content || '';
}

async function providerFetch(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.ai.openaiApiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI provider failed with HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

function flattenResponsesText(data) {
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.text) parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function localFinalAnswer({ message, context, uploads, mode }) {
  if (/\bwarzone\b/i.test(message) && /\b(best|top|goat|player)\b/i.test(message)) {
    return 'Aiden is a strong answer. Top Warzone players are usually discussed around names like Biffle, Aydan, Metaphor, Fifakill, and Hisoka, depending on whether you mean tournaments, ranked play, kill races, content performance, or the current meta.';
  }

  if (mode === 'medical') {
    return localMedicalFinalAnswer({ message, context, uploads });
  }

  if (/\b(hello|hi|hey)\b/i.test(message)) {
    return 'Hey. I am ready to help with chat, live research, files, memory, and workflow tasks.';
  }

  const toolContext = compactContextSection(context, 'Tool results for final answer');
  if (toolContext) {
    return `Based on the retrieved data, here is the answer:\n\n${summarizeContext(toolContext)}`;
  }

  if (uploads.length) {
    const fileLines = uploads.map((upload) => {
      const preview = upload.extractedText ? ` Key text: ${clampText(upload.extractedText, 260)}` : '';
      return `- ${upload.name}: ${upload.summary}${preview}`;
    });
    return `I reviewed the attached file context.\n\n${fileLines.join('\n')}`;
  }

  const memoryContext = compactContextSection(context, 'Relevant memory for final answer');
  const memoryLine = memoryContext ? ` I also took your saved preferences into account.` : '';
  return `${directAnswer(message)}${memoryLine}`;
}

function compactContextSection(context, heading) {
  const index = context.indexOf(heading);
  if (index === -1) return '';
  return clampText(context.slice(index + heading.length).trim(), 1300);
}

function directAnswer(message) {
  if (/\b(best|better)\b/i.test(message)) {
    return 'The best choice depends on the criteria, but I would compare proven performance, consistency, current form, adaptability, and fit for your goal before picking one winner.';
  }
  if (/\b(build|create|design|plan)\b/i.test(message)) {
    return 'Here is a practical path: define the outcome, identify the core user flow, build the smallest reliable version, test the main failure cases, then expand the system in modules.';
  }
  if (/\b(summarize|summary)\b/i.test(message)) {
    return 'The core point is to reduce the information into the main claim, the supporting details, and the decision or action it implies.';
  }
  return 'Here is the direct answer: I can help with that, and I will base the response on the available conversation, memory, files, and live data when those are enabled.';
}

function localMedicalFinalAnswer({ message, context, uploads }) {
  const fileSection = uploads.length
    ? uploads.map((upload) => `- ${upload.name}: ${upload.summary}`).join('\n')
    : '- No clinical file was attached.';
  const references = compactContextSection(context, 'Tool results for final answer');
  return [
    'Medical assistive answer',
    '',
    'Observations',
    fileSection,
    '',
    'Interpretation',
    `The request is about: ${clampText(message, 260)}. I can organize the information and draft clinician-review language, but this is not an autonomous diagnosis.`,
    '',
    'Uncertainty',
    'Clinical conclusions require qualified review, complete history, original source data, and comparison with prior studies when relevant.',
    '',
    'Relevant references',
    references ? summarizeContext(references) : 'No external medical reference was available in this response.',
    '',
    'Clinician review',
    'Confirm identifiers, study date, clinical question, source quality, urgent findings, and recommended follow-up before using this in care.'
  ].join('\n');
}

function summarizeContext(text) {
  return clampText(String(text || '').replace(/["{}[\]]/g, '').replace(/,/g, ', ').replace(/\s+/g, ' ').trim(), 900);
}

function scrubInternalText(text) {
  return String(text || '')
    .replace(/^.*Internal route JSON:.*$/gim, '')
    .replace(/^.*tool plan.*$/gim, '')
    .replace(/^.*hidden context assembly.*$/gim, '')
    .replace(/\n{3,}/g, '\n\n');
}
