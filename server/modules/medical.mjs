export function isMedicalQuery(text) {
  return /\b(radiology|scan|ct|mri|x-ray|xray|ultrasound|dicom|pacs|fhir|hl7|patient|diagnosis|symptom|clinical|lesion|study|report|pubmed|medical|medicine|lab result)\b/i.test(text);
}

export function medicalSystemFrame() {
  return [
    'Medical mode is assistive only.',
    'Never claim autonomous diagnosis or replace clinician judgment.',
    'Separate observations, interpretation, uncertainty, recommendations, and clinician review steps.',
    'Avoid overconfidence. Name data limits and missing context.',
    'For urgent symptoms, recommend immediate local emergency care.'
  ].join('\n');
}

export function localMedicalResponse({ message, tools, uploads }) {
  const research = tools.filter((item) => item.name === 'medical_research' && item.ok);
  const uploadLines = uploads.length
    ? uploads.map((item) => `- ${item.name}: ${item.summary}`).join('\n')
    : '- No medical file was attached to this request.';
  const researchLines = research.length
    ? research.flatMap((item) => item.result.items || []).slice(0, 5).map((item) => `- ${item.title}${item.source ? ` (${item.source})` : ''}`).join('\n')
    : '- No external medical references were retrieved.';

  return [
    'Medical assistive summary',
    '',
    'Observations',
    uploadLines,
    '',
    'Interpretation',
    `The request appears to involve: "${message}". I can organize the information, compare provided documents, and prepare clinician-review language, but I cannot make an autonomous diagnosis.`,
    '',
    'Uncertainty',
    'This response is limited by the files and context provided. Imaging conclusions require qualified clinician review and, for radiology, access to the original study and prior exams.',
    '',
    'Reference signals',
    researchLines,
    '',
    'Clinician review steps',
    '- Confirm patient identifiers, study type, date, and clinical question.',
    '- Compare with prior imaging or reports when available.',
    '- Keep findings, impression, and recommendations clearly separated.',
    '- Escalate urgent or unexpected findings through the appropriate clinical workflow.'
  ].join('\n');
}
