/*
  CareVest content model.

  This is the single description of everything the CareVest team can edit. The dashboard renders its
  forms from it, the website templates read content shaped by it, and the build and verify scripts
  use it. See SPEC.md for the field value shapes and the Content JSON shape.

  Conventions used in this file (beyond SPEC.md):

  1. Sections that render a collection declare it on the section itself:
        { key: 'transactions', label: '...', collection: 'transactions', fields: [...] }
     The section's own fields (eyebrow, headline, fine print) are still edited on the page; the
     repeated items are edited on the collection's screen. When a section only shows part of a
     collection it also declares `group: '<value>'`, which filters the collection by its `group` field
     (for example the Board of Directors shows team members whose group is "Board").

  2. A `stat` value that carries `figure: '<key>'` takes its value, prefix, suffix and decimals from
     `figures[<key>]` at render time. Only the label and the small note under the number live with the
     page. This is how one edit to "Total loans funded" updates the home page, the history page and
     the lending page together.

  3. Document slots carry a `fallback` URL. When a slot has no uploaded file the site links to the
     fallback (the Offering Memorandum and Fact Sheet fall back to the contact page).

  4. Numbering (01, 02, 03), arrows, check marks, footnote asterisks that link to a note, and form
     controls are part of the page design and are not editable; they live in the templates.

  Plain ESM with no dependencies so it can be imported from Node (site/build.js) and from the Vite
  bundle (admin/).
*/

export const fieldTypes = ['text', 'heading', 'richtext', 'number', 'stat', 'image', 'document', 'link', 'list', 'select', 'boolean', 'date', 'url'];

/* ---------- small helpers that build field definitions (keeps the page list readable) ---------- */

const text = (key, label, hint) => ({ key, type: 'text', label, ...(hint ? { hint } : {}) });
const heading = (key, label, hint) => ({ key, type: 'heading', label, hint: hint || 'Wrap one word or phrase in [[double brackets]] to highlight it.' });
const richtext = (key, label, hint) => ({ key, type: 'richtext', label, ...(hint ? { hint } : {}) });
const link = (key, label, hint) => ({ key, type: 'link', label, ...(hint ? { hint } : {}) });
const image = (key, label, hint) => ({ key, type: 'image', label, ...(hint ? { hint } : {}) });
const list = (key, label, of, extra = {}) => ({ key, type: 'list', label, of, ...extra });
const boolean = (key, label, hint) => ({ key, type: 'boolean', label, ...(hint ? { hint } : {}) });
const document = (key, label, hint) => ({ key, type: 'document', label, ...(hint ? { hint } : {}) });

const EYEBROW_HINT = 'The small label that sits above the headline.';
const eyebrow = (label = 'Small Label Above The Headline') => text('eyebrow', label, EYEBROW_HINT);
const sub = (label = 'Supporting Sentence') => text('sub', label);

/* Fields shared by every "stat" list item: which key figure to show and whether it counts up. */
const statItem = [
  { key: 'stat', type: 'stat', label: 'Figure', hint: 'Pick a key figure. The label and the small note under the number are written here.' },
  boolean('count', 'Count Up When It Scrolls Into View', 'Turn off to show the number without the counting animation.'),
];

/* The closing call-to-action band that most pages end with. */
const ctaBand = (key = 'cta', label = 'Closing Call To Action', hint = 'The highlighted panel at the bottom of the page with two buttons.') => ({
  key,
  label,
  hint,
  fields: [
    eyebrow(),
    heading('headline', 'Headline'),
    text('body', 'Paragraph'),
    link('primary_cta', 'Main Button'),
    link('secondary_cta', 'Second Button'),
  ],
});

const metaFields = { title: 'text', description: 'text' };

/* =====================================================================================================
   PAGES
   ===================================================================================================== */

export const pages = [
  /* -------------------------------------------------------------------------------- Home ------------ */
  {
    slug: 'index',
    path: '/',
    title: 'Home',
    meta: metaFields,
    sections: [
      {
        key: 'hero',
        label: 'Hero',
        hint: 'The large opening panel with the photo and three figures.',
        fields: [
          image('background', 'Background Photo', 'The large photo behind the headline. The description can stay empty because the photo is decorative.'),
          eyebrow(),
          heading('headline', 'Headline'),
          sub(),
          link('primary_cta', 'Main Button', 'Shown with an arrow.'),
          link('secondary_cta', 'Second Button'),
          list('stats', 'Three Key Figures', statItem, { max: 3, hint: 'The yield figure automatically links to the footnote further down the page.' }),
        ],
      },
      {
        key: 'trustbar',
        label: 'Trust Bar',
        hint: 'The thin strip of four facts under the hero. The fourth item is the investor relations phone number from Site-wide settings.',
        fields: [
          list('items', 'Facts', [text('label', 'Label'), text('value', 'Detail')], { max: 3 }),
          text('phone_label', 'Label For The Phone Number'),
        ],
      },
      {
        key: 'audiences',
        label: 'Investors And Borrowers',
        hint: 'The introduction and the two cards that point investors and borrowers to their own pages.',
        fields: [
          eyebrow(),
          heading('headline', 'Headline'),
          text('lede', 'Introduction Paragraph'),
          text('investors_eyebrow', 'Investors Card: Small Label'),
          text('investors_heading', 'Investors Card: Heading'),
          text('investors_body', 'Investors Card: Paragraph'),
          link('investors_button', 'Investors Card: Button', 'Shown with an arrow.'),
          text('borrowers_eyebrow', 'Borrowers Card: Small Label'),
          text('borrowers_heading', 'Borrowers Card: Heading'),
          text('borrowers_body', 'Borrowers Card: Paragraph'),
          link('borrowers_button', 'Borrowers Card: Button', 'Shown with an arrow.'),
        ],
      },
      {
        key: 'numbers',
        label: 'Results Band',
        hint: 'The dark band with four large figures and the footnote about the yield.',
        fields: [
          eyebrow(),
          heading('headline', 'Headline', 'A footnote asterisk is added automatically after the headline.'),
          text('body', 'Paragraph'),
          list('stats', 'Four Key Figures', [statItem[0]], { max: 4 }),
          text('footnote_label', 'Footnote Label', 'The footnote text itself is edited under Key figures, on the yield figure.'),
        ],
      },
      {
        key: 'calculator',
        label: 'Income Calculator',
        hint: 'The slider that estimates monthly income. The yield used comes from the yield key figure.',
        fields: [
          eyebrow(),
          heading('headline', 'Headline'),
          text('body', 'Paragraph'),
          text('amount_label', 'Label: Amount Slider'),
          text('account_label', 'Label: Account Type'),
          text('distributions_label', 'Label: Distributions'),
          text('distributions_text', 'Distributions Explanation'),
          text('monthly_label', 'Label: Monthly Income Result'),
          text('yearly_label', 'Label: Yearly Result'),
          text('yield_label', 'Label: Yield Used'),
          text('fine', 'Fine Print Under The Calculator'),
        ],
      },
      {
        key: 'how_it_works',
        label: 'How It Works',
        hint: 'The three numbered steps and the two buttons under them.',
        fields: [
          eyebrow(),
          heading('headline', 'Headline'),
          text('body', 'Paragraph'),
          list('steps', 'Steps', [text('heading', 'Step Heading'), text('body', 'Step Description')], { hint: 'Steps are numbered automatically.' }),
          link('primary_cta', 'Main Button', 'Shown with an arrow.'),
          link('secondary_cta', 'Second Button'),
        ],
      },
      {
        key: 'image_band',
        label: 'Wide Photo',
        hint: 'The full-width photo between sections.',
        fields: [image('image', 'Photo')],
      },
      {
        key: 'values',
        label: 'Core Values Band',
        hint: 'The dark band listing the core values. The three values themselves are edited under the Core Values collection and are shared with the About page.',
        collection: 'values',
        fields: [eyebrow(), heading('headline', 'Headline'), text('body', 'Paragraph')],
      },
      {
        key: 'transactions',
        label: 'Representative Transactions',
        hint: 'The scrolling row of project cards. The projects are edited under the Representative Transactions collection.',
        collection: 'transactions',
        fields: [eyebrow(), heading('headline', 'Headline'), text('body', 'Paragraph'), text('fine', 'Fine Print Under The Cards')],
      },
      {
        key: 'teasers',
        label: 'Events And History Cards',
        hint: 'The two cards that point to the Events and Our History pages.',
        fields: [
          text('events_eyebrow', 'Events Card: Small Label'),
          text('events_heading', 'Events Card: Heading'),
          text('events_body', 'Events Card: Paragraph'),
          link('events_button', 'Events Card: Button', 'Shown with an arrow.'),
          text('history_eyebrow', 'History Card: Small Label'),
          text('history_heading', 'History Card: Heading'),
          text('history_body', 'History Card: Paragraph'),
          link('history_button', 'History Card: Button', 'Shown with an arrow.'),
        ],
      },
      ctaBand('final_cta'),
    ],
  },

  /* -------------------------------------------------------------------------------- Core Fund ------- */
  {
    slug: 'core-mic',
    path: '/core-mic',
    title: 'Core Fund',
    meta: metaFields,
    sections: [
      {
        key: 'hero',
        label: 'Page Opening',
        hint: 'The dark opening panel.',
        fields: [eyebrow(), heading('headline', 'Headline'), sub('Opening Paragraph'), link('primary_cta', 'Main Button', 'Shown with an arrow.'), link('secondary_cta', 'Second Button')],
      },
      {
        key: 'objectives',
        label: 'Investment Objectives',
        hint: 'Text on the left, tall photo on the right.',
        fields: [eyebrow(), heading('headline', 'Headline'), text('body', 'First Paragraph'), text('body_2', 'Second Paragraph'), image('image', 'Photo')],
      },
      {
        key: 'highlights',
        label: 'Fund Highlights',
        hint: 'The dark band with three large figures and the numbered notes under them.',
        fields: [
          eyebrow(),
          heading('headline', 'Headline'),
          list('stats', 'Three Key Figures', [statItem[0], text('refs', 'Note References', 'Which notes apply, for example (1)(2). Shown small after the label.')], { max: 3 }),
          text('notes_label', 'Notes Heading'),
          list('notes', 'Numbered Notes', [text('text', 'Note')], { hint: 'Notes are numbered (1), (2), (3) automatically.' }),
        ],
      },
      {
        key: 'facts',
        label: 'Fund Facts At A Glance',
        hint: 'The two-column list of fund facts on the left of the section.',
        fields: [
          eyebrow(),
          heading('headline', 'Headline'),
          list('rows', 'Fact Rows', [
            text('label', 'Label'),
            text('value', 'Detail'),
            boolean('align_digits', 'Align Digits Evenly', 'Turn on for rows that are mostly dates or numbers.'),
          ]),
          text('fine', 'Fine Print Under The List'),
        ],
      },
      {
        key: 'mic_card',
        label: 'How A MIC Works Card',
        hint: 'The card explaining the MIC structure, with the row of pills showing the flow of money.',
        fields: [
          eyebrow('Small Label'),
          text('heading', 'Heading'),
          text('body', 'Paragraph'),
          list('flow', 'Flow Pills', [text('node', 'Pill'), text('verb', 'Connecting Word', 'The word shown between arrows after this pill, for example "invests". Leave empty on the last pill.')]),
        ],
      },
      {
        key: 'resources',
        label: 'Resources Card',
        hint: 'The card with the document buttons. Each button links to the current file in its document slot, or to the contact page when no file has been uploaded.',
        fields: [
          eyebrow('Small Label'),
          list('links', 'Document Buttons', [text('label', 'Button Label'), document('document', 'Document')], { hint: 'The first button is solid, the rest are outlined.' }),
          text('fine', 'Fine Print Under The Buttons'),
        ],
      },
      {
        key: 'investors',
        label: 'For Investors',
        hint: 'Two columns of text about who the fund is for.',
        fields: [
          eyebrow(),
          heading('headline', 'Headline'),
          text('left_1', 'Left Column: First Paragraph'),
          text('left_2', 'Left Column: Second Paragraph'),
          text('left_fine', 'Left Column: Fine Print'),
          text('right_1', 'Right Column: First Paragraph'),
          text('right_2', 'Right Column: Second Paragraph'),
          richtext('note', 'Highlighted Note', 'Shown in a tinted box. Bold text is allowed.'),
        ],
      },
      {
        key: 'promotion',
        label: 'RRSP And TFSA Promotion',
        hint: 'The highlighted panel with one button. The Promotions link in the footer points here.',
        fields: [eyebrow(), heading('headline', 'Headline'), text('body', 'Paragraph'), link('button', 'Button', 'Use mailto: in the address to open an email.')],
      },
      {
        key: 'get_in_touch',
        label: 'Get In Touch Card',
        hint: 'The card at the bottom with two stacked buttons.',
        fields: [eyebrow(), text('heading', 'Heading'), text('body', 'Paragraph'), link('primary_cta', 'Main Button', 'Shown with an arrow.'), link('secondary_cta', 'Second Button', 'Use tel: in the address for a phone number.')],
      },
    ],
  },

  /* -------------------------------------------------------------------------------- How Investing Works */
  {
    slug: 'how-investing-works',
    path: '/how-investing-works',
    title: 'How Investing Works',
    meta: metaFields,
    sections: [
      { key: 'hero', label: 'Page Opening', hint: 'The dark opening panel.', fields: [eyebrow(), heading('headline', 'Headline'), sub('Opening Paragraph')] },
      {
        key: 'dealer',
        label: 'About CareVest Private Capital',
        hint: 'Four paragraphs on the left and three small cards on the right.',
        fields: [
          eyebrow(),
          heading('headline', 'Headline'),
          text('body_1', 'First Paragraph'),
          text('body_2', 'Second Paragraph'),
          text('body_3', 'Third Paragraph'),
          text('phone_lead', 'Phone Sentence', 'The words before the phone number. A full stop is added after the number.'),
          text('phone', 'Phone Number', 'Shown as a tap-to-call link.'),
          list('cards', 'Side Cards', [text('eyebrow', 'Small Label'), text('body', 'Paragraph')]),
        ],
      },
      {
        key: 'steps',
        label: 'Three Steps',
        hint: 'The three numbered steps.',
        fields: [eyebrow(), heading('headline', 'Headline'), list('steps', 'Steps', [text('heading', 'Step Heading'), text('body', 'Step Description')], { hint: 'Steps are numbered automatically.' })],
      },
      {
        key: 'faq',
        label: 'Frequently Asked Questions',
        hint: 'The expandable questions. The questions and answers are edited under the Investor FAQ collection (group "Investor FAQ").',
        collection: 'faqs',
        group: 'Investor FAQ',
        fields: [eyebrow(), heading('headline', 'Headline')],
      },
      {
        key: 'industry_links',
        label: 'Industry Links',
        hint: 'The list of securities authorities. The links themselves are edited under the Industry Links collection.',
        collection: 'industry_links',
        fields: [eyebrow(), heading('headline', 'Headline'), text('body', 'Introduction Line'), text('fine', 'Fine Print Under The Links')],
      },
      {
        key: 'complaints',
        label: 'Complaints Card',
        hint: 'The card beside the industry links.',
        fields: [eyebrow('Small Label'), text('body_1', 'First Paragraph'), text('body_2', 'Second Paragraph')],
      },
      ctaBand('final_cta'),
    ],
  },

  /* -------------------------------------------------------------------------------- Our History ----- */
  {
    slug: 'our-history',
    path: '/our-history',
    title: 'Our History',
    meta: metaFields,
    sections: [
      { key: 'hero', label: 'Page Opening', hint: 'The dark opening panel.', fields: [eyebrow(), heading('headline', 'Headline'), sub('Opening Paragraph')] },
      { key: 'image_band', label: 'Wide Photo', hint: 'The full-width photo under the opening.', fields: [image('image', 'Photo')] },
      {
        key: 'timeline',
        label: 'Timeline',
        hint: 'The year-by-year story. The entries are edited under the Timeline collection.',
        collection: 'timeline',
        fields: [],
      },
      {
        key: 'numbers',
        label: 'Track Record Band',
        hint: 'The dark band with four large figures.',
        fields: [eyebrow(), heading('headline', 'Headline'), list('stats', 'Four Key Figures', statItem, { max: 4 })],
      },
      ctaBand(),
    ],
  },

  /* -------------------------------------------------------------------------------- Events ---------- */
  {
    slug: 'events',
    path: '/events',
    title: 'Events',
    meta: metaFields,
    sections: [
      {
        key: 'hero',
        label: 'Featured Event',
        hint: 'The opening panel shows the first upcoming event from the Events collection: its title, description, date, location and cost.',
        collection: 'events',
        group: 'Upcoming',
        fields: [],
      },
      {
        key: 'registration',
        label: 'Reservation Form',
        hint: 'The card with the sign-up form beside the featured event.',
        fields: [
          eyebrow('Form Heading'),
          text('button_label', 'Button Label', 'Shown with an arrow.'),
          text('confirm', 'Thank You Message', 'Shown after the form is sent.'),
          text('consent', 'Consent Note Under The Form'),
        ],
      },
      { key: 'image_band', label: 'Wide Photo', hint: 'The full-width photo under the opening.', fields: [image('image', 'Photo')] },
      {
        key: 'why_attend',
        label: 'Why Attend',
        hint: 'Three numbered cards.',
        fields: [eyebrow(), heading('headline', 'Headline'), list('cards', 'Cards', [text('eyebrow', 'Small Label', 'Numbered automatically, for example "01 · The outlook".'), text('heading', 'Heading'), text('body', 'Paragraph')])],
      },
      {
        key: 'replay',
        label: 'Replay Card',
        hint: 'The card with the email form for the event replay.',
        fields: [eyebrow('Small Label'), text('heading', 'Heading'), text('body', 'Paragraph'), text('button_label', 'Button Label', 'Shown with an arrow.'), text('confirm', 'Thank You Message', 'Shown after the form is sent.')],
      },
      {
        key: 'past_events',
        label: 'Past Evenings Card',
        hint: 'The card beside the replay form.',
        fields: [eyebrow('Small Label'), text('heading', 'Heading'), text('body', 'Paragraph'), link('button', 'Button', 'Shown with an arrow.')],
      },
      ctaBand(),
    ],
  },

  /* -------------------------------------------------------------------------------- Lending --------- */
  {
    slug: 'lending',
    path: '/lending',
    title: 'Lending',
    meta: metaFields,
    sections: [
      {
        key: 'hero',
        label: 'Page Opening',
        hint: 'The dark opening panel.',
        fields: [eyebrow(), heading('headline', 'Headline'), sub('Opening Paragraph'), link('primary_cta', 'Main Button', 'Shown with an arrow.'), link('secondary_cta', 'Second Button', 'Use #transactions to jump down the page.')],
      },
      {
        key: 'broker',
        label: 'About CareVest Capital',
        hint: 'Text on the left, photo and one large figure on the right.',
        fields: [
          eyebrow(),
          heading('headline', 'Headline'),
          text('body_1', 'First Paragraph'),
          text('body_2', 'Second Paragraph'),
          image('image', 'Photo'),
          { key: 'stat', type: 'stat', label: 'Figure Under The Photo', hint: 'Pick a key figure and write the label under it.' },
        ],
      },
      {
        key: 'projects',
        label: 'Types Of Projects',
        hint: 'The dark band with the check-marked list, split into two columns, and the financing pills.',
        fields: [
          eyebrow(),
          heading('headline', 'Headline'),
          text('body', 'Paragraph'),
          list('project_types', 'Project Types', [text('label', 'Project Type')], { hint: 'Shown with a check mark, split evenly into two columns.' }),
          text('financing_label', 'Label Before The Financing Pills'),
          list('financing_types', 'Types Of Financing', [text('label', 'Financing Type')]),
        ],
      },
      {
        key: 'process',
        label: 'The Lending Process',
        hint: 'The expandable numbered phases. The phases are edited under the Investor FAQ collection (group "Lending Process").',
        collection: 'faqs',
        group: 'Lending Process',
        fields: [eyebrow(), heading('headline', 'Headline')],
      },
      {
        key: 'transactions',
        label: 'Representative Transactions',
        hint: 'The grid of project cards. The projects are edited under the Representative Transactions collection.',
        collection: 'transactions',
        fields: [eyebrow(), heading('headline', 'Headline'), text('fine', 'Fine Print Under The Cards')],
      },
      ctaBand('cta', 'Closing Call To Action', 'The highlighted panel at the bottom with two buttons. Use mailto: in the second button address to open an email.'),
    ],
  },

  /* -------------------------------------------------------------------------------- About ----------- */
  {
    slug: 'about',
    path: '/about',
    title: 'About',
    meta: metaFields,
    sections: [
      { key: 'hero', label: 'Page Opening', hint: 'The dark opening panel.', fields: [eyebrow(), heading('headline', 'Headline'), sub('Opening Paragraph')] },
      {
        key: 'local',
        label: 'Where We Work',
        hint: 'Text and a button on the left, tall photo on the right.',
        fields: [eyebrow(), heading('headline', 'Headline'), text('body', 'Paragraph'), link('button', 'Button', 'Shown with an arrow.'), image('image', 'Photo')],
      },
      {
        key: 'entities',
        label: 'The CareVest Group',
        hint: 'The four cards, one per company in the group.',
        fields: [
          eyebrow(),
          heading('headline', 'Headline'),
          list('cards', 'Company Cards', [text('eyebrow', 'Small Label'), text('heading', 'Company Name'), text('body', 'Paragraph'), link('button', 'Button', 'Shown with an arrow.')]),
        ],
      },
      {
        key: 'values',
        label: 'Core Values Band',
        hint: 'The dark band listing the core values. The three values themselves are edited under the Core Values collection and are shared with the home page.',
        collection: 'values',
        fields: [eyebrow(), heading('headline', 'Headline'), text('body', 'Paragraph')],
      },
      {
        key: 'fund_manager',
        label: 'Fund Manager',
        hint: 'Three paragraphs about CareVest Management Corp. The Board card beside them is its own section below.',
        fields: [eyebrow(), heading('headline', 'Headline'), text('body_1', 'First Paragraph'), text('body_2', 'Second Paragraph'), text('body_3', 'Third Paragraph')],
      },
      {
        key: 'board',
        label: 'Board Of Directors Card',
        hint: 'The card listing the directors. The names come from the Team collection (group "Board").',
        collection: 'team',
        group: 'Board',
        fields: [eyebrow('Small Label'), text('body', 'Paragraph')],
      },
      {
        key: 'shareholder_admin',
        label: 'Shareholder Administration',
        hint: 'The forms available to registered shareholders. A form name becomes a download link as soon as a file is uploaded into its document slot.',
        fields: [
          eyebrow(),
          heading('headline', 'Headline'),
          text('body', 'Paragraph'),
          text('admin_heading', 'Administration Forms: Heading'),
          list('admin_forms', 'Administration Forms', [text('label', 'Form Name'), document('document', 'Document')]),
          text('dividend_heading', 'Dividend Forms: Heading'),
          list('dividend_forms', 'Dividend Forms', [text('label', 'Form Name'), document('document', 'Document')]),
          text('transfer_heading', 'Transfer Forms: Heading'),
          list('transfer_forms', 'Transfer Forms', [text('label', 'Form Name'), document('document', 'Document')]),
        ],
      },
      {
        key: 'careers',
        label: 'Careers',
        hint: 'The careers card with the list of current openings.',
        fields: [
          eyebrow(),
          text('heading', 'Heading'),
          text('body', 'Paragraph'),
          text('openings_eyebrow', 'Openings: Small Label'),
          list('openings', 'Current Openings', [text('title', 'Role'), text('location', 'Location')]),
          link('button', 'Button', 'Shown with an arrow.'),
        ],
      },
      ctaBand(),
    ],
  },

  /* -------------------------------------------------------------------------------- Team ------------ */
  {
    slug: 'team',
    path: '/team',
    title: 'Team',
    meta: metaFields,
    sections: [
      { key: 'hero', label: 'Page Opening', hint: 'The dark opening panel.', fields: [eyebrow(), heading('headline', 'Headline'), sub('Opening Paragraph')] },
      {
        key: 'grid',
        label: 'Team Grid',
        hint: 'The photo grid. People are edited under the Team collection; Leadership is shown first, then Team.',
        collection: 'team',
        fields: [],
      },
      {
        key: 'board',
        label: 'Board Of Directors',
        hint: 'The governance text and the card listing the directors (Team collection, group "Board").',
        collection: 'team',
        group: 'Board',
        fields: [eyebrow(), heading('headline', 'Headline'), text('body', 'Paragraph')],
      },
      ctaBand(),
    ],
  },

  /* -------------------------------------------------------------------------------- Contact --------- */
  {
    slug: 'contact',
    path: '/contact',
    title: 'Contact',
    meta: metaFields,
    sections: [
      { key: 'hero', label: 'Page Opening', hint: 'The dark opening panel.', fields: [eyebrow(), heading('headline', 'Headline'), sub('Opening Paragraph')] },
      {
        key: 'form',
        label: 'Contact Form',
        hint: 'The message form. Field labels and choices are fixed; the heading, button and notes are editable.',
        fields: [eyebrow('Form Heading'), text('button_label', 'Button Label'), text('confirm', 'Thank You Message', 'Shown after the form is sent.'), text('consent', 'Consent Note Under The Form')],
      },
      {
        key: 'details',
        label: 'Contact Details',
        hint: 'The cards beside the form. The phone number comes from Site-wide settings and the office cards from the Offices collection.',
        collection: 'offices',
        fields: [
          text('ir_heading', 'Investor Relations Card: Small Label'),
          text('ir_emails', 'Investor Relations Card: Email Addresses'),
          text('borrowers_heading', 'Borrowers Card: Small Label'),
          text('borrowers_email', 'Borrowers Card: Email Address'),
        ],
      },
    ],
  },
];

/* =====================================================================================================
   COLLECTIONS: repeatable items that appear on more than one page or that grow over time
   ===================================================================================================== */

export const collections = {
  team: {
    label: 'Team',
    singular: 'Team member',
    hint: 'Leadership and Team appear in the photo grid on the Team page. Board members appear in the Board of Directors lists on the Team and About pages.',
    fields: [
      text('name', 'Name', 'As it should appear, including any designations.'),
      text('title', 'Role'),
      { key: 'group', type: 'select', label: 'Group', options: ['Leadership', 'Team', 'Board'] },
      image('photo', 'Photo', 'Leave the photo empty to show initials instead. The description is read aloud by screen readers.'),
      text('initials', 'Initials', 'Shown when there is no photo.'),
      richtext('bio', 'Biography', 'Revealed by the Read more button.'),
    ],
  },
  transactions: {
    label: 'Representative transactions',
    singular: 'Transaction',
    hint: 'Shown on the home page and the Lending page.',
    fields: [text('category', 'Category', 'For example Construction or Land Financing.'), text('title', 'Title'), image('image', 'Photo')],
  },
  faqs: {
    label: 'Investor FAQ',
    singular: 'Question',
    hint: 'Questions in the "Investor FAQ" group appear on How Investing Works. Entries in the "Lending Process" group appear as the numbered phases on the Lending page.',
    fields: [
      text('question', 'Question'),
      richtext('answer', 'Answer', 'Paragraphs, bullet lists and links are allowed.'),
      { key: 'group', type: 'select', label: 'Group', options: ['Investor FAQ', 'Lending Process'] },
      text('footnote', 'Small Print Under The Answer', 'Optional, for a source line.'),
    ],
  },
  events: {
    label: 'Events',
    singular: 'Event',
    hint: 'The first upcoming event is featured at the top of the Events page.',
    fields: [
      text('title', 'Event Title'),
      text('summary', 'Description'),
      text('series', 'Series Name', 'For example Speaker Series.'),
      text('city', 'City'),
      text('date_text', 'Date', 'Written out, for example "To be announced" or "Thursday, March 12".'),
      text('location', 'Location'),
      text('cost', 'Cost'),
      { key: 'group', type: 'select', label: 'Status', options: ['Upcoming', 'Past'], hint: 'Only upcoming events are shown.' },
    ],
  },
  industry_links: {
    label: 'Industry links',
    singular: 'Link',
    hint: 'The securities authorities listed on How Investing Works.',
    fields: [text('label', 'Name'), { key: 'url', type: 'url', label: 'Web Address' }],
  },
  timeline: {
    label: 'Timeline',
    singular: 'Timeline entry',
    hint: 'The entries on the Our History page, in order.',
    fields: [
      text('year', 'Year Or Word', 'A year such as 1994, or a word such as Then or Today.'),
      text('heading', 'Heading'),
      text('body', 'Paragraph'),
      richtext('note', 'Highlighted Note', 'Optional. Shown in a tinted box under the paragraph.'),
    ],
  },
  values: {
    label: 'Core values',
    singular: 'Value',
    hint: 'The numbered values shown on the home page and the About page.',
    fields: [text('heading', 'Heading'), text('body', 'Paragraph')],
  },
  offices: {
    label: 'Offices',
    singular: 'Office',
    hint: 'Shown in the footer of every page and on the Contact page.',
    fields: [
      text('name', 'Office Name', 'For example Vancouver - Head Office.'),
      text('street', 'Street Address'),
      text('city_line', 'City, Province And Postal Code'),
      text('phone_label', 'Phone Label', 'For example Mortgage Broker.'),
      text('phone', 'Phone Number'),
    ],
  },
};

/* =====================================================================================================
   FIGURES: the key numbers, each edited once and shown wherever it is placed
   ===================================================================================================== */

const figureFields = { value: 'number', prefix: 'text', suffix: 'text', decimals: 'number', as_of: 'text', note: 'richtext' };

export const figures = {
  label: 'Key figures',
  hint: 'Each number is edited here once. Pages place a figure by picking it in a "Figure" field. Prefix and suffix are shown around the number, for example $ and B+.',
  items: [
    { key: 'yield', label: 'Historical compound annual yield', hint: 'The note is the yield footnote shown on the home page.', fields: figureFields },
    { key: 'funded', label: 'Total loans funded', fields: figureFields },
    { key: 'aua', label: 'Assets under administration', fields: figureFields },
    { key: 'ltv', label: 'Loan to value ratio', fields: figureFields },
    { key: 'first_mortgages', label: 'First mortgages held', fields: figureFields },
    { key: 'gross_weighted_average', label: 'Gross weighted average loan interest rate', fields: figureFields },
    { key: 'founded_year', label: 'Operating since (year)', fields: figureFields },
    { key: 'inception_year', label: 'CareVest Core MIC inception (year)', hint: 'Kept for reference. Not placed as a large figure on any page yet; the text mentions of 2021 are ordinary text.', fields: figureFields },
  ],
};

/* =====================================================================================================
   DOCUMENTS: named slots; the team uploads a new file into a slot and the site links the current one
   ===================================================================================================== */

export const documents = {
  label: 'Documents',
  hint: 'Upload a new file into a slot and every link to it updates. Slots without a file link to the fallback shown.',
  slots: [
    { key: 'offering_memorandum', label: 'Offering Memorandum', fallback: '/contact', hint: 'Requested from the Core Fund page. Until a file is uploaded the button goes to the contact page.' },
    { key: 'fact_sheet', label: 'Fund Fact Sheet', fallback: '/contact', hint: 'Requested from the Core Fund page. Until a file is uploaded the button goes to the contact page.' },
    { key: 'terms_of_use', label: 'Terms of Use', fallback: 'https://www.carevest.com/terms-of-use', hint: 'Linked in the footer.' },
    { key: 'privacy_policy', label: 'Privacy Policy', fallback: 'https://www.carevest.com/_files/ugd/bf9305_8633260fac9b4cabbe5f18044bad6a52.pdf', hint: 'Linked in the footer.' },
    { key: 'relationship_disclosure', label: 'Relationship Disclosure Information', fallback: 'https://www.carevest.com/_files/ugd/bf9305_149c84d04faf4e36ac0c0ed19cf7479e.pdf', hint: 'Linked in the footer.' },
    { key: 'form_address_email_change', label: 'Shareholder form: Address / Email Change', group: 'Shareholder administration forms' },
    { key: 'form_electronic_delivery_consent', label: 'Shareholder form: Electronic Delivery Consent', group: 'Shareholder administration forms' },
    { key: 'form_opt_out_financial_statements', label: 'Shareholder form: Opt-Out of Financial Statements', group: 'Shareholder administration forms' },
    { key: 'form_direct_deposit', label: 'Shareholder form: Direct Deposit', group: 'Shareholder administration forms' },
    { key: 'form_drip', label: 'Shareholder form: Dividend Reinvestment Plan (DRIP)', group: 'Shareholder administration forms' },
    { key: 'form_core_mic_drip', label: 'Shareholder form: CareVest Core MIC Dividend Reinvestment Plan', group: 'Shareholder administration forms' },
    { key: 'form_transfer_request', label: 'Shareholder form: Transfer Request', group: 'Shareholder administration forms' },
    { key: 'form_in_kind_contribution', label: 'Shareholder form: In-Kind Contribution Request', group: 'Shareholder administration forms' },
    { key: 'form_declaration_of_transmission', label: 'Shareholder form: Declaration of Transmission', group: 'Shareholder administration forms' },
    { key: 'form_name_change', label: 'Shareholder form: Name Change', group: 'Shareholder administration forms' },
  ],
};

/* =====================================================================================================
   GLOBALS: header, footer and anything repeated on every page
   ===================================================================================================== */

export const globals = {
  label: 'Site-wide',
  hint: 'The header, footer and details that appear on every page.',
  fields: [
    image('logo', 'Logo In The Header'),
    image('logo_footer', 'Logo In The Footer', 'The white version shown on the dark footer.'),
    list('nav', 'Menu Links', [text('label', 'Label'), { key: 'href', type: 'url', label: 'Page Address', hint: 'For example /core-mic.' }], { hint: 'In order from left to right. The current page is highlighted automatically.' }),
    link('header_cta', 'Header Button'),
    text('phone_investor_relations', 'Investor Relations Phone Number', 'Shown in the footer, the trust bar on the home page and the Contact page.'),
    text('footer_tagline', 'Footer Tagline'),
    text('footer_phone_label', 'Footer: Label Above The Phone Number'),
    text('footer_invest_heading', 'Footer: First Column Heading'),
    list('footer_invest_links', 'Footer: First Column Links', [text('label', 'Label'), { key: 'href', type: 'url', label: 'Address' }]),
    text('footer_company_heading', 'Footer: Second Column Heading'),
    list('footer_company_links', 'Footer: Second Column Links', [text('label', 'Label'), { key: 'href', type: 'url', label: 'Address' }]),
    text('footer_offices_heading', 'Footer: Offices Column Heading', 'The offices themselves are edited under the Offices collection.'),
    richtext('disclaimer', 'Disclaimer', 'The legal paragraph at the bottom of every page. Bold text is allowed.'),
    list('legal_links', 'Legal Links', [text('label', 'Label'), document('document', 'Document')], { hint: 'The small links in the last row of the footer. Each points to the current file in its document slot.' }),
    text('copyright', 'Copyright Line'),
  ],
};

export default { fieldTypes, pages, collections, figures, documents, globals };
