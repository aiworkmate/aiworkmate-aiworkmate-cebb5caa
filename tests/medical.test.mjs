import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isMedicalQuery,
  medicalSystemFrame,
  localMedicalResponse
} from '../server/modules/medical.mjs';

test('isMedicalQuery detects radiology terms', () => {
  assert.ok(isMedicalQuery('Can you analyze this CT scan?'));
  assert.ok(isMedicalQuery('Review the MRI results'));
  assert.ok(isMedicalQuery('Look at this X-ray image'));
  assert.ok(isMedicalQuery('Ultrasound findings'));
});

test('isMedicalQuery detects clinical terms', () => {
  assert.ok(isMedicalQuery('What is the diagnosis for these symptoms?'));
  assert.ok(isMedicalQuery('Patient history shows elevated values'));
  assert.ok(isMedicalQuery('Clinical trial results'));
  assert.ok(isMedicalQuery('Check the lab result'));
});

test('isMedicalQuery detects medical standards', () => {
  assert.ok(isMedicalQuery('DICOM file format'));
  assert.ok(isMedicalQuery('PACS integration'));
  assert.ok(isMedicalQuery('FHIR standard'));
  assert.ok(isMedicalQuery('HL7 messaging'));
});

test('isMedicalQuery detects research terms', () => {
  assert.ok(isMedicalQuery('Search PubMed for recent studies'));
  assert.ok(isMedicalQuery('Medical literature review'));
});

test('isMedicalQuery rejects non-medical queries', () => {
  assert.ok(!isMedicalQuery('What is the weather today?'));
  assert.ok(!isMedicalQuery('Build me a React app'));
  assert.ok(!isMedicalQuery('Calculate 2 + 2'));
  assert.ok(!isMedicalQuery(''));
});

test('medicalSystemFrame returns guardrail text', () => {
  const frame = medicalSystemFrame();
  assert.ok(frame.includes('assistive only'));
  assert.ok(frame.includes('Never claim autonomous diagnosis'));
  assert.ok(frame.includes('emergency care'));
});

test('localMedicalResponse includes all required sections', () => {
  const response = localMedicalResponse({
    message: 'Analyze this scan',
    tools: [],
    uploads: []
  });
  assert.ok(response.includes('Medical assistive summary'));
  assert.ok(response.includes('Observations'));
  assert.ok(response.includes('Interpretation'));
  assert.ok(response.includes('Uncertainty'));
  assert.ok(response.includes('Clinician review steps'));
});

test('localMedicalResponse includes upload info', () => {
  const response = localMedicalResponse({
    message: 'Analyze this scan',
    tools: [],
    uploads: [{ name: 'scan.dcm', summary: 'A chest CT scan' }]
  });
  assert.ok(response.includes('scan.dcm'));
  assert.ok(response.includes('A chest CT scan'));
});

test('localMedicalResponse shows no-upload message when empty', () => {
  const response = localMedicalResponse({
    message: 'Analyze this',
    tools: [],
    uploads: []
  });
  assert.ok(response.includes('No medical file was attached'));
});

test('localMedicalResponse includes research results', () => {
  const response = localMedicalResponse({
    message: 'Find studies on lung cancer',
    tools: [
      {
        name: 'medical_research',
        ok: true,
        result: {
          items: [
            { title: 'Lung Cancer Study 2024', source: 'PubMed' },
            { title: 'Treatment Outcomes', source: 'NCBI' }
          ]
        }
      }
    ],
    uploads: []
  });
  assert.ok(response.includes('Lung Cancer Study 2024'));
  assert.ok(response.includes('PubMed'));
});

test('localMedicalResponse handles failed tools gracefully', () => {
  const response = localMedicalResponse({
    message: 'Find studies',
    tools: [{ name: 'medical_research', ok: false, error: 'timeout' }],
    uploads: []
  });
  assert.ok(response.includes('No external medical references'));
});
