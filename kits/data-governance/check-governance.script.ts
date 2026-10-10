// For the tool "Data governance and ownership". The command "Check governance" lists the gaps
// that matter most: data products nobody owns, sensitive data assets without a policy, quality
// rules that fail or check nothing, and glossary terms that define no data.
import { commands, model, ui } from 'metakit';

const nameOf = (o: { attrs: { Name?: string | null } }) =>
  `"${o.attrs.Name || 'unnamed'}"`;

commands.register({
  id: 'check-governance',
  label: 'Check governance',
  menu: 'Model',
  run: () => {
    const sections: string[] = [];
    const section = (title: string, lines: string[]) => {
      if (lines.length > 0)
        sections.push(`${title}:\n${lines.map((l) => `- ${l}`).join('\n')}`);
    };

    // 1. Every data product has exactly one owner.
    const owners: string[] = [];
    for (const product of model.objects('DataProduct')) {
      const count = product.incoming('Owns').length;
      if (count === 0) owners.push(`${nameOf(product)} has no owner.`);
      else if (count > 1)
        owners.push(
          `${nameOf(product)} has ${count} owners: ${product
            .incoming('Owns')
            .map(nameOf)
            .join(', ')}.`,
        );
    }
    section('Data products without one owner', owners);

    // 2. Restricted assets, and confidential ones with personal data, are governed by a policy.
    const unprotected: string[] = [];
    for (const asset of model.objects('DataAsset')) {
      const level = asset.attrs.Classification;
      const sensitive =
        level === 'Restricted' ||
        (level === 'Confidential' && asset.attrs.ContainsPersonalData === true);
      if (sensitive && asset.outgoing('GovernedBy').length === 0)
        unprotected.push(
          `${nameOf(asset)} is ${level}${asset.attrs.ContainsPersonalData ? ' with personal data' : ''} and no policy governs it.`,
        );
    }
    section('Sensitive data assets without a policy', unprotected);

    // 3. Quality rules that fail, and rules that check nothing.
    const quality: string[] = [];
    for (const rule of model.objects('QualityRule')) {
      const assets = rule.outgoing('Checks');
      if (assets.length === 0)
        quality.push(`${nameOf(rule)} checks no data asset.`);
      if (rule.attrs.Outcome === 'Failing')
        quality.push(
          `${nameOf(rule)} fails: ${rule.attrs.LastResult}% against a threshold of ${rule.attrs.Threshold}%${
            assets.length > 0 ? ` on ${assets.map(nameOf).join(', ')}` : ''
          }.`,
        );
    }
    section('Quality rules', quality);

    // 4. Glossary terms that define no data.
    const unused = model
      .objects('GlossaryTerm')
      .filter((term) => term.outgoing('Defines').length === 0)
      .map((term) => `${nameOf(term)} defines no data product or asset.`);
    section('Unused glossary terms', unused);

    if (sections.length === 0) ui.message('Governance looks complete.');
    else ui.message(sections.join('\n\n'), 'warning');
  },
});
