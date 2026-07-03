export function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function unique(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

export function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function tokenizeCompanyName(company) {
  return cleanText(company).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function parseCompanyInputs(input) {
  if (Array.isArray(input.companies) && input.companies.length) {
    return input.companies.map(normalizeCompanyInput).filter((company) => company.name);
  }

  const company = normalizeCompanyInput({
    name: input.company || 'IBM',
    careerUrl: input.careerUrl || '',
  });

  return company.name ? [company] : [];
}

function normalizeCompanyInput(value) {
  if (typeof value === 'string') return { name: cleanText(value), careerUrl: '' };

  return {
    name: cleanText(value?.name || value?.company || ''),
    careerUrl: cleanText(value?.careerUrl || value?.url || ''),
  };
}
