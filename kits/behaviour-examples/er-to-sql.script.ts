// For the Kit "ER lite". Candidate 3 of docs/phase-7-behaviour-candidates.md: data modelling
// tools commonly turn an ER diagram into a relational schema. This command writes the schema
// as SQL, through a save dialog. The Kit declares the "files" permission for it.
import { commands, files, model, ui } from 'metakit';
import type { ModelObject } from 'metakit';

const SQL_TYPES: Record<string, string> = {
  text: 'TEXT',
  number: 'NUMERIC',
  date: 'DATE',
  boolean: 'BOOLEAN',
};

/** A name that is safe as a table or column name. */
const sql = (text: string | null): string =>
  (text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unnamed';

const columnsOf = (entity: ModelObject<'Entity'>) =>
  entity.outgoing('Has') as ModelObject<'Attribute'>[];

commands.register({
  id: 'export-sql',
  label: 'Export SQL schema…',
  menu: 'Model',
  run: async () => {
    const notes: string[] = [];
    const statements: string[] = [];

    for (const entity of model.objects('Entity')) {
      const columns = columnsOf(entity);
      const keys = columns.filter((c) => c.attrs.IsKey === true);
      const lines = columns.map(
        (c) =>
          `  ${sql(c.attrs.Name)} ${SQL_TYPES[c.attrs.DataType ?? 'text']}${c.attrs.IsKey ? ' NOT NULL' : ''}`,
      );
      if (keys.length > 0)
        lines.push(
          `  PRIMARY KEY (${keys.map((k) => sql(k.attrs.Name)).join(', ')})`,
        );
      else notes.push(`"${entity.attrs.Name}" has no key attribute.`);
      statements.push(
        `CREATE TABLE ${sql(entity.attrs.Name)} (\n${lines.join(',\n')}\n);`,
      );
    }

    // A relationship that joins entities becomes a table that points at each of them.
    for (const relationship of model.objects('Relationship')) {
      const ends = relationship.incoming(
        'Participates',
      ) as ModelObject<'Entity'>[];
      if (ends.length < 2) {
        notes.push(
          `"${relationship.attrs.Name}" joins fewer than two entities and was left out.`,
        );
        continue;
      }
      const lines: string[] = [];
      for (const end of ends) {
        for (const key of columnsOf(end).filter(
          (c) => c.attrs.IsKey === true,
        )) {
          const column = `${sql(end.attrs.Name)}_${sql(key.attrs.Name)}`;
          lines.push(
            `  ${column} ${SQL_TYPES[key.attrs.DataType ?? 'text']} NOT NULL REFERENCES ${sql(end.attrs.Name)} (${sql(key.attrs.Name)})`,
          );
        }
      }
      statements.push(
        `CREATE TABLE ${sql(relationship.attrs.Name)} (\n${lines.join(',\n')}\n);`,
      );
    }

    if (statements.length === 0) {
      ui.message(
        'There is nothing to export: the model has no entities.',
        'warning',
      );
      return;
    }
    const saved = await files.save(
      'schema.sql',
      statements.join('\n\n') + '\n',
    );
    if (saved)
      ui.message(
        notes.length ? `Saved. Note: ${notes.join(' ')}` : 'Saved the schema.',
      );
  },
});
