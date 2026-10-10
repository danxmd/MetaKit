import type { KitId, NodeLook } from '@metakit-app/core';
import {
  choice,
  formula,
  line,
  long,
  look,
  text,
  type CatalogAttribute,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
  type SampleSpec,
} from '../define';

/**
 * Data modelling at three levels. A conceptual model names the business entities of each subject
 * area and how they relate; a logical model gives each entity its attributes and keys; a physical
 * model has the tables and columns of one database, with data types and foreign keys. Entities and
 * tables are containers that hold their attributes and columns, so a diagram reads like an
 * entity-relationship diagram.
 */

const KEYS = ['PK', 'FK', 'PK and FK'];
const KEY_FILL = {
  by: 'Key',
  values: { PK: '#ffec99', FK: '#d0ebff', 'PK and FK': '#ffe8cc' },
  fallback: '#ffffff',
};
const CARDINALITIES = ['1', '0..1', '0..*', '1..*'];
/** Containers are see-through, so the lines between the objects inside them show. */
const CLEAR = '#ffffff00';

/** A container with a solid border, for entities and tables. */
const box = (border: string, width: number, height: number): NodeLook => ({
  ...look('container', { fill: '#ffffff', border, width, height }),
  borderStyle: 'solid',
  borderWidth: 2,
});

/** One line inside an entity or table: its title is the label formula, not bold. */
const row = (border: string): NodeLook => ({
  ...look('box', {
    fill: KEY_FILL,
    border,
    width: 200,
    height: 28,
  }),
  borderWidth: 1,
  title: { attribute: 'Label' },
});

const keyAttribute = (help: string): CatalogAttribute =>
  choice('Key', KEYS, { help });

const keyFormulas = (what: string): CatalogAttribute[] => [
  formula(
    'KeyCount',
    'count(children().Key)',
    'number',
    `How many of its ${what} are part of a key.`,
    { label: 'Key parts' },
  ),
  formula(
    'HasPrimaryKey',
    "contains(join(children().Key, '|'), 'PK')",
    'boolean',
    `Yes when at least one of its ${what} is part of the primary key.`,
  ),
];

type Row = [name: string, type: string, key?: string];

const e = (
  id: string,
  cls: string,
  x: number,
  y: number,
  attributes: SampleElement['attributes'],
  extra: Partial<SampleElement> = {},
): SampleElement => ({ id, class: cls, x, y, attributes, ...extra });

/** An entity or a table with one object per attribute or column, stacked inside it. */
function withRows(
  id: string,
  cls: 'Entity' | 'Table',
  x: number,
  y: number,
  values: Record<string, string>,
  rows: Row[],
  parent?: string,
): SampleElement[] {
  const rowClass = cls === 'Entity' ? 'EntityAttribute' : 'Column';
  return [
    e(id, cls, x, y, values, {
      w: 220,
      h: 44 + rows.length * 32,
      ...(parent ? { parent } : {}),
    }),
    ...rows.map(([name, type, key], i) =>
      e(
        `${id}_${i + 1}`,
        rowClass,
        x + 10,
        y + 36 + i * 32,
        { Name: name, DataType: type, ...(key ? { Key: key } : {}) },
        { parent: id },
      ),
    ),
  ];
}

const relates = (
  from: string,
  to: string,
  verb: string,
  fromCard: string,
  toCard: string,
): SampleConnector => ({
  relation: 'RelatesTo',
  from,
  to,
  attributes: { Verb: verb, FromCardinality: fromCard, ToCardinality: toCard },
});

const subjectArea = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  values: Record<string, string>,
) => e(id, 'SubjectArea', x, y, values, { w, h });

// Samples ----------------------------------------------------------------------------------------

const conceptual: SampleSpec = {
  file: 'retail-conceptual.mkmodel.json',
  id: 'mdl_retailconceptual',
  name: 'Retail sales: conceptual model',
  modelType: 'Conceptual',
  attributes: {
    Title: 'Retail sales: conceptual model',
    Organisation: 'A home and garden retailer',
    ModelVersion: '1.0',
  },
  intendedWarnings: 0,
  elements: [
    subjectArea('sa_party', 40, 40, 250, 480, {
      Name: 'Customers and stores',
      Owner: 'Head of customer',
    }),
    e(
      'customer',
      'BusinessEntity',
      90,
      250,
      {
        Name: 'Customer',
        Description: 'A person or business that buys from us.',
      },
      { parent: 'sa_party' },
    ),
    e(
      'store',
      'BusinessEntity',
      90,
      420,
      {
        Name: 'Store',
        Description: 'A shop where customers buy in person.',
      },
      { parent: 'sa_party' },
    ),
    subjectArea('sa_sales', 455, 40, 250, 480, {
      Name: 'Sales',
      Owner: 'Head of sales operations',
    }),
    e(
      'order',
      'BusinessEntity',
      505,
      250,
      {
        Name: 'Sales order',
        Description: 'A request by a customer to buy products.',
      },
      { parent: 'sa_sales' },
    ),
    e(
      'payment',
      'BusinessEntity',
      505,
      80,
      {
        Name: 'Payment',
        Description: 'Money received for an order.',
      },
      { parent: 'sa_sales' },
    ),
    e(
      'delivery',
      'BusinessEntity',
      505,
      420,
      {
        Name: 'Delivery',
        Description: 'Products sent to a customer for an order.',
      },
      { parent: 'sa_sales' },
    ),
    subjectArea('sa_product', 860, 40, 500, 480, {
      Name: 'Products and suppliers',
      Owner: 'Head of buying',
    }),
    e(
      'product',
      'BusinessEntity',
      900,
      250,
      {
        Name: 'Product',
        Description: 'Something we sell.',
      },
      { parent: 'sa_product' },
    ),
    e(
      'category',
      'BusinessEntity',
      900,
      80,
      {
        Name: 'Product category',
        Description: 'A group of similar products, such as garden furniture.',
      },
      { parent: 'sa_product' },
    ),
    e(
      'promotion',
      'BusinessEntity',
      900,
      420,
      {
        Name: 'Promotion',
        Description: 'A time-limited offer on some products.',
      },
      { parent: 'sa_product' },
    ),
    e(
      'supplier',
      'BusinessEntity',
      1180,
      250,
      {
        Name: 'Supplier',
        Description: 'A business we buy products from.',
      },
      { parent: 'sa_product' },
    ),
  ],
  connectors: [
    relates('customer', 'order', 'places', '1', '0..*'),
    relates('store', 'order', 'takes', '0..1', '0..*'),
    relates('order', 'payment', 'is paid by', '1', '1..*'),
    relates('order', 'delivery', 'is sent as', '1', '0..*'),
    relates('order', 'product', 'includes', '0..*', '1..*'),
    relates('category', 'product', 'groups', '1', '0..*'),
    relates('supplier', 'product', 'supplies', '1..*', '0..*'),
    relates('promotion', 'product', 'applies to', '0..*', '1..*'),
  ],
};

const logical: SampleSpec = {
  file: 'retail-logical.mkmodel.json',
  id: 'mdl_retaillogical',
  name: 'Retail sales: logical model',
  modelType: 'Logical',
  attributes: {
    Title: 'Retail sales: logical model',
    Organisation: 'A home and garden retailer',
    ModelVersion: '1.2',
  },
  // "Product price" has no primary key yet, on purpose.
  intendedWarnings: 1,
  elements: [
    subjectArea('sa_customer', 40, 40, 580, 290, {
      Name: 'Customer',
      Owner: 'Head of customer',
    }),
    ...withRows(
      'customer',
      'Entity',
      380,
      80,
      {
        Name: 'Customer',
        Description: 'A person or business that buys from us.',
      },
      [
        ['Customer id', 'Identifier', 'PK'],
        ['Name', 'Text'],
        ['Email', 'Text'],
        ['Date of birth', 'Date'],
        ['Loyalty tier', 'Code'],
      ],
      'sa_customer',
    ),
    ...withRows(
      'address',
      'Entity',
      60,
      80,
      {
        Name: 'Customer address',
        Description: 'Where a customer lives or wants deliveries.',
      },
      [
        ['Address id', 'Identifier', 'PK'],
        ['Customer id', 'Identifier', 'FK'],
        ['Street', 'Text'],
        ['Postcode', 'Code'],
        ['Country', 'Code'],
      ],
      'sa_customer',
    ),
    subjectArea('sa_sales', 740, 40, 580, 420, {
      Name: 'Sales',
      Owner: 'Head of sales operations',
    }),
    ...withRows(
      'order',
      'Entity',
      760,
      80,
      {
        Name: 'Sales order',
        Description: 'A request by a customer to buy products.',
      },
      [
        ['Order id', 'Identifier', 'PK'],
        ['Customer id', 'Identifier', 'FK'],
        ['Order date', 'Date'],
        ['Channel', 'Code'],
        ['Store id', 'Identifier', 'FK'],
      ],
      'sa_sales',
    ),
    ...withRows(
      'line',
      'Entity',
      1080,
      80,
      {
        Name: 'Order line',
        Description: 'One product on an order, with its quantity.',
      },
      [
        ['Order id', 'Identifier', 'PK and FK'],
        ['Line number', 'Integer', 'PK'],
        ['Product id', 'Identifier', 'FK'],
        ['Quantity', 'Integer'],
        ['Net amount', 'Money'],
      ],
      'sa_sales',
    ),
    ...withRows(
      'online',
      'Entity',
      760,
      330,
      {
        Name: 'Online order',
        Description: 'An order placed in the online shop.',
      },
      [
        ['Web session id', 'Text'],
        ['Delivery method', 'Code'],
      ],
      'sa_sales',
    ),
    subjectArea('sa_product', 740, 520, 900, 240, {
      Name: 'Product',
      Owner: 'Head of buying',
    }),
    ...withRows(
      'product',
      'Entity',
      1080,
      560,
      {
        Name: 'Product',
        Description: 'Something we sell.',
      },
      [
        ['Product id', 'Identifier', 'PK'],
        ['Name', 'Text'],
        ['Category id', 'Identifier', 'FK'],
        ['List price', 'Money'],
      ],
      'sa_product',
    ),
    ...withRows(
      'category',
      'Entity',
      760,
      560,
      {
        Name: 'Product category',
        Description: 'A group of similar products.',
      },
      [
        ['Category id', 'Identifier', 'PK'],
        ['Name', 'Text'],
        ['Parent category id', 'Identifier', 'FK'],
      ],
      'sa_product',
    ),
    ...withRows(
      'price',
      'Entity',
      1400,
      560,
      {
        Name: 'Product price',
        Description: 'The price of a product from a date onwards.',
      },
      [
        ['Product id', 'Identifier', 'FK'],
        ['Valid from', 'Date'],
        ['Price', 'Money'],
      ],
      'sa_product',
    ),
  ],
  connectors: [
    relates('customer', 'address', 'lives at', '1', '1..*'),
    relates('customer', 'order', 'places', '1', '0..*'),
    relates('order', 'line', 'contains', '1', '1..*'),
    relates('product', 'line', 'is sold in', '1', '0..*'),
    relates('category', 'product', 'groups', '1', '0..*'),
    relates('product', 'price', 'is priced by', '1', '1..*'),
    { relation: 'SubtypeOf', from: 'online', to: 'order' },
  ],
};

const fk = (from: string, to: string, columns: string): SampleConnector => ({
  relation: 'ForeignKey',
  from,
  to,
  attributes: { Columns: columns, OnDelete: 'No action' },
});

const physical: SampleSpec = {
  file: 'retail-physical.mkmodel.json',
  id: 'mdl_retailphysical',
  name: 'Retail sales: physical model',
  modelType: 'Physical',
  attributes: {
    Title: 'Retail sales: physical model',
    Organisation: 'A home and garden retailer',
    ModelVersion: '1.2',
    Database: 'Relational database in the cloud',
  },
  intendedWarnings: 0,
  elements: [
    e(
      'schema',
      'Schema',
      40,
      40,
      { Name: 'sales', Description: 'Tables of the sales system.' },
      { w: 1540, h: 532 },
    ),
    ...withRows(
      'customer',
      'Table',
      380,
      80,
      { Name: 'customer', Implements: 'Customer', RowEstimate: '2 million' },
      [
        ['customer_id', 'BIGINT', 'PK'],
        ['full_name', 'VARCHAR(200)'],
        ['email', 'VARCHAR(320)'],
        ['birth_date', 'DATE'],
        ['loyalty_tier', 'CHAR(1)'],
      ],
      'schema',
    ),
    ...withRows(
      'address',
      'Table',
      60,
      80,
      {
        Name: 'customer_address',
        Implements: 'Customer address',
        RowEstimate: '2.5 million',
      },
      [
        ['address_id', 'BIGINT', 'PK'],
        ['customer_id', 'BIGINT', 'FK'],
        ['street', 'VARCHAR(200)'],
        ['postcode', 'VARCHAR(10)'],
        ['country_code', 'CHAR(2)'],
      ],
      'schema',
    ),
    ...withRows(
      'order',
      'Table',
      700,
      80,
      {
        Name: 'sales_order',
        Implements: 'Sales order, Online order',
        RowEstimate: '40 million',
      },
      [
        ['order_id', 'BIGINT', 'PK'],
        ['customer_id', 'BIGINT', 'FK'],
        ['order_date', 'DATE'],
        ['channel', 'VARCHAR(10)'],
        ['web_session_id', 'VARCHAR(64)'],
      ],
      'schema',
    ),
    ...withRows(
      'line',
      'Table',
      1020,
      80,
      {
        Name: 'order_line',
        Implements: 'Order line',
        RowEstimate: '120 million',
      },
      [
        ['order_id', 'BIGINT', 'PK and FK'],
        ['line_no', 'SMALLINT', 'PK'],
        ['product_id', 'BIGINT', 'FK'],
        ['quantity', 'INTEGER'],
        ['net_amount', 'DECIMAL(12,2)'],
      ],
      'schema',
    ),
    ...withRows(
      'product',
      'Table',
      1020,
      380,
      { Name: 'product', Implements: 'Product', RowEstimate: '60 thousand' },
      [
        ['product_id', 'BIGINT', 'PK'],
        ['product_name', 'VARCHAR(200)'],
        ['category_id', 'INTEGER', 'FK'],
        ['list_price', 'DECIMAL(12,2)'],
      ],
      'schema',
    ),
    ...withRows(
      'category',
      'Table',
      700,
      380,
      {
        Name: 'product_category',
        Implements: 'Product category',
        RowEstimate: '400',
      },
      [
        ['category_id', 'INTEGER', 'PK'],
        ['category_name', 'VARCHAR(100)'],
        ['parent_category_id', 'INTEGER', 'FK'],
      ],
      'schema',
    ),
    ...withRows(
      'price',
      'Table',
      1340,
      380,
      {
        Name: 'product_price',
        Implements: 'Product price',
        RowEstimate: '500 thousand',
      },
      [
        ['product_id', 'BIGINT', 'PK and FK'],
        ['valid_from', 'DATE', 'PK'],
        ['price', 'DECIMAL(12,2)'],
      ],
      'schema',
    ),
  ],
  connectors: [
    fk('address', 'customer', 'customer_id'),
    fk('order', 'customer', 'customer_id'),
    fk('line', 'order', 'order_id'),
    fk('line', 'product', 'product_id'),
    fk('product', 'category', 'category_id'),
    fk('price', 'product', 'product_id'),
  ],
};

// The Kit ----------------------------------------------------------------------------------------

const modelAttributes = [
  text('Title', { required: true, maxLength: 100 }),
  text('Organisation'),
  text('ModelVersion', { label: 'Version' }),
];

export const dataModelling: KitSpec = {
  folder: 'data-modelling',
  id: 'kit_datamodelling' as KitId,
  name: 'Data modelling',
  catalog: { keys: [] },
  classes: [
    {
      key: 'SubjectArea',
      label: 'Subject area',
      help: 'A part of the business the data is about, such as customer or sales. Place its entities inside it.',
      look: look('container', {
        fill: CLEAR,
        border: '#495057',
        width: 540,
        height: 290,
      }),
      attributes: [long('Description'), text('Owner')],
    },
    {
      key: 'BusinessEntity',
      label: 'Business entity',
      help: 'A thing the business needs to know about, named in its own words, such as Customer or Order. Used in conceptual models, without attributes.',
      look: look('rounded', {
        fill: '#d0ebff',
        border: '#1c7ed6',
        borderWidth: 2,
        width: 150,
        height: 70,
      }),
      attributes: [
        long('Description', {
          label: 'Definition',
          help: 'What one of these is, in one sentence that everyone agrees on.',
        }),
        text('Examples'),
      ],
      constraints: [
        {
          id: 'k_businessentity_definition',
          formula: '!isEmpty(Description)',
          message: "= 'Business entity \"' + Name + '\" has no definition.'",
        },
      ],
    },
    {
      key: 'Entity',
      label: 'Entity',
      help: 'A thing the data describes, with its attributes and keys, independent of any database. Place its attributes inside it.',
      kind: 'container',
      look: box('#1c7ed6', 220, 204),
      attributes: [
        long('Description', { label: 'Definition' }),
        formula(
          'SubjectArea',
          'parent ? parent.Name : null',
          'text',
          'The subject area it sits in.',
        ),
        formula(
          'AttributeCount',
          'count(children())',
          'number',
          'How many attributes it has.',
          { label: 'Attributes' },
        ),
        ...keyFormulas('attributes'),
        formula(
          'IsSubtype',
          "count(outgoing('SubtypeOf')) > 0",
          'boolean',
          'Yes when it is a subtype of another entity, whose key it shares.',
        ),
      ],
      constraints: [
        {
          id: 'k_entity_key',
          formula: 'HasPrimaryKey || IsSubtype',
          message:
            "= 'Entity \"' + Name + '\" has no primary key: mark the attributes that identify it as PK.'",
        },
      ],
    },
    {
      key: 'EntityAttribute',
      label: 'Attribute',
      help: 'One property of an entity, with its logical data type and whether it is part of a key. Place it inside its entity.',
      look: row('#74c0fc'),
      attributes: [
        choice('DataType', [
          'Identifier',
          'Text',
          'Code',
          'Integer',
          'Decimal',
          'Money',
          'Date',
          'Date and time',
          'Yes or no',
        ]),
        keyAttribute(
          'PK when it is part of the primary key, FK when it refers to another entity.',
        ),
        choice('Required', ['Yes', 'No'], { default: 'No' }),
        long('Description'),
        formula(
          'Label',
          "Name + (DataType ? ': ' + DataType : '') + (Key ? '  [' + Key + ']' : '')",
          'text',
          'The name, the data type and the key, shown on the diagram.',
        ),
      ],
      constraints: [
        {
          id: 'k_attribute_entity',
          formula: 'parent != null',
          message: "= 'Attribute \"' + Name + '\" is not inside an entity.'",
        },
      ],
    },
    {
      key: 'Schema',
      label: 'Schema',
      help: 'A group of tables in one database. Place its tables inside it.',
      look: look('container', {
        fill: CLEAR,
        border: '#0c8599',
        width: 1540,
        height: 532,
      }),
      attributes: [long('Description'), text('Database')],
    },
    {
      key: 'Table',
      label: 'Table',
      help: 'A table of a database, with its columns. Place its columns inside it.',
      kind: 'container',
      look: box('#0c8599', 220, 204),
      attributes: [
        long('Description'),
        text('Implements', {
          help: 'The logical entities the table stores.',
        }),
        text('RowEstimate', { label: 'Rows (estimate)' }),
        text('Partitioning', {
          help: 'How the table is split, such as "by month of order_date".',
        }),
        formula(
          'ColumnCount',
          'count(children())',
          'number',
          'How many columns it has.',
          { label: 'Columns' },
        ),
        ...keyFormulas('columns'),
      ],
      constraints: [
        {
          id: 'k_table_key',
          formula: 'HasPrimaryKey',
          message: "= 'Table \"' + Name + '\" has no primary key.'",
        },
      ],
    },
    {
      key: 'Column',
      label: 'Column',
      help: 'One column of a table, with its data type as the database writes it, such as VARCHAR(100). Place it inside its table.',
      look: row('#63e6be'),
      attributes: [
        text('DataType', {
          help: 'As the database writes it, such as VARCHAR(100) or DECIMAL(12,2).',
        }),
        keyAttribute(
          'PK when it is part of the primary key, FK when it is part of a foreign key.',
        ),
        choice('Nullable', ['Yes', 'No'], { default: 'Yes' }),
        text('Default'),
        long('Description'),
        formula(
          'Label',
          "Name + (DataType ? '  ' + DataType : '') + (Key ? '  [' + Key + ']' : '')",
          'text',
          'The name, the data type and the key, shown on the diagram.',
        ),
      ],
      constraints: [
        {
          id: 'k_column_table',
          formula: 'parent != null',
          message: "= 'Column \"' + Name + '\" is not inside a table.'",
        },
      ],
    },
  ],
  relations: [
    {
      key: 'RelatesTo',
      label: 'Relationship',
      help: 'How two entities relate, read from the first to the second, such as "Customer places Sales order", with how many of each take part.',
      from: ['BusinessEntity', 'Entity'],
      to: ['BusinessEntity', 'Entity'],
      attributes: [
        text('Verb', { help: 'Such as "places" or "belongs to".' }),
        choice('FromCardinality', CARDINALITIES, {
          label: 'From cardinality',
          help: 'How many of the first entity take part: 1, 0..1, 0..* or 1..*.',
        }),
        choice('ToCardinality', CARDINALITIES, {
          label: 'To cardinality',
          help: 'How many of the second entity take part for each of the first.',
        }),
        formula(
          'Reading',
          "(FromCardinality ?? '') + ' ' + (Verb ?? '') + ' ' + (ToCardinality ?? '')",
          'text',
          'The cardinalities and the verb, shown on the line, such as "1 places 0..*".',
        ),
      ],
      look: line('#1c7ed6', { end: 'none', label: 'Reading' }),
    },
    {
      key: 'SubtypeOf',
      label: 'Subtype of',
      help: 'The entity is a special kind of the other one and shares its key, such as Online order of Sales order.',
      from: ['Entity'],
      to: ['Entity'],
      look: line('#495057', { end: 'triangle' }),
    },
    {
      key: 'ForeignKey',
      label: 'Foreign key',
      help: 'Columns of the first table refer to the primary key of the second.',
      from: ['Table'],
      to: ['Table'],
      attributes: [
        text('Columns', {
          help: 'The columns of the first table that refer to the second, such as customer_id.',
        }),
        choice('OnDelete', ['No action', 'Cascade', 'Set null', 'Restrict'], {
          label: 'On delete',
        }),
      ],
      look: line('#0c8599', { end: 'open-arrow', label: 'Columns' }),
    },
  ],
  modelTypes: [
    {
      key: 'Conceptual',
      label: 'Conceptual data model',
      help: 'Subject areas with the business entities they hold and how they relate, in the words of the business.',
      classes: ['SubjectArea', 'BusinessEntity'],
      relations: ['RelatesTo'],
      containers: { SubjectArea: ['BusinessEntity'] },
      attributes: [
        ...modelAttributes,
        formula(
          'EntityCount',
          "count(objects('BusinessEntity'))",
          'number',
          'How many business entities the model holds.',
          { label: 'Entities' },
        ),
      ],
    },
    {
      key: 'Logical',
      label: 'Logical data model',
      help: 'Entities with their attributes, keys and relationships, independent of any database.',
      classes: ['SubjectArea', 'Entity', 'EntityAttribute'],
      relations: ['RelatesTo', 'SubtypeOf'],
      containers: { SubjectArea: ['Entity'], Entity: ['EntityAttribute'] },
      attributes: [
        ...modelAttributes,
        formula(
          'EntityCount',
          "count(objects('Entity'))",
          'number',
          'How many entities the model holds.',
          { label: 'Entities' },
        ),
        formula(
          'AttributeCount',
          "count(objects('EntityAttribute'))",
          'number',
          'How many attributes the model holds.',
          { label: 'Attributes' },
        ),
      ],
    },
    {
      key: 'Physical',
      label: 'Physical data model',
      help: 'The tables and columns of one database, with data types, primary keys and foreign keys.',
      classes: ['Schema', 'Table', 'Column'],
      relations: ['ForeignKey'],
      containers: { Schema: ['Table'], Table: ['Column'] },
      attributes: [
        ...modelAttributes,
        text('Database', {
          help: 'The kind of database, as free text.',
        }),
        formula(
          'TableCount',
          "count(objects('Table'))",
          'number',
          'How many tables the model holds.',
          { label: 'Tables' },
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'EntityAttribute',
      tabs: [
        {
          label: 'Attribute',
          items: [
            'Name',
            { attribute: 'DataType', control: 'select' },
            { attribute: 'Key', control: 'segmented' },
            { attribute: 'Required', control: 'segmented' },
            { attribute: 'Description', control: 'textarea' },
          ],
        },
      ],
    },
    {
      class: 'Column',
      tabs: [
        {
          label: 'Column',
          items: [
            'Name',
            'DataType',
            { attribute: 'Key', control: 'segmented' },
            { attribute: 'Nullable', control: 'segmented' },
            'Default',
            { attribute: 'Description', control: 'textarea' },
          ],
        },
      ],
    },
  ],
  sample: logical,
  moreSamples: [conceptual, physical],
};
