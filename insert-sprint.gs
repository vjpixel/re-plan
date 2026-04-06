function insertSprintReview() {
  const DOC_ID = '1r-s3AhOBNJraeJmPV8TcnN5JPI-Qw8nnWtJewKzVf6I';
  const doc = DocumentApp.openById(DOC_ID);
  const body = doc.getBody();
  let idx = 0;

  // ── helpers ────────────────────────────────────────────────

  function h1(text) {
    body.insertParagraph(idx++, text)
        .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  }

  function h2(regular, italic) {
    const p = body.insertParagraph(idx++, regular);
    p.setHeading(DocumentApp.ParagraphHeading.HEADING2);
    if (italic) {
      const t = p.editAsText();
      const start = t.getText().length;
      t.appendText(italic);
      t.setBold(start, t.getText().length - 1, false);   // remove bold herdado do H2
      t.setItalic(start, t.getText().length - 1, true);  // aplicar itálico
    }
  }

  function h3(text) {
    body.insertParagraph(idx++, text)
        .setHeading(DocumentApp.ParagraphHeading.HEADING3);
  }

  function bullet(text) {
    const item = body.insertListItem(idx++, text);
    item.setGlyphType(DocumentApp.GlyphType.BULLET);
    item.editAsText().setBold(false); // evitar herdar bold do parágrafo anterior
  }

  function numbered(text) {
    const item = body.insertListItem(idx++, text);
    item.setGlyphType(DocumentApp.GlyphType.NUMBER);
    item.editAsText().setBold(false); // evitar herdar bold do parágrafo anterior
  }

  function bold(text) {
    const p = body.insertParagraph(idx++, text);
    p.editAsText().setBold(true);
  }

  function table(rows, boldResultCol) {
    const t = body.insertTable(idx++, rows);
    const borderAttrs = {};
    borderAttrs[DocumentApp.Attribute.BORDER_COLOR] = '#000000';
    borderAttrs[DocumentApp.Attribute.BORDER_WIDTH] = 1;
    for (let r = 0; r < t.getNumRows(); r++) {
      const row = t.getRow(r);
      for (let c = 0; c < row.getNumCells(); c++) {
        const cell = row.getCell(c);
        cell.setAttributes(borderAttrs);
        if (r === 0) cell.editAsText().setBold(true); // header row
        if (boldResultCol && r > 0 && c === row.getNumCells() - 1) {
          cell.editAsText().setBold(true); // result/goal column
        }
      }
    }
  }

  // ── content ────────────────────────────────────────────────

  h1('2/Apr -------------------------------------');

  // Sprint Review
  h2('Sprint Review ', '(30/Mar–5/Apr, 4 workdays)');
  h3('Outcomes');
  bullet('Tech interview with recruiter Ciro Morales (Engineer Access) — Apr 1');
  bullet('Consulting opportunity: VisasQ/Coleman (Miwa Saita) — Apr 2');
  bullet('55 LinkedIn profile views — Apr 1');
  bullet('Reader replies to Diar.ia edition (Joshu Santos + others) — Apr 1');

  h3('Outputs');
  bold('Jandig');
  bullet('Reviewed and approved closing of issue #243 (wrong link in Mozilla Pulse) — Mar 30');
  bold('Diar.ia');
  bullet('Raffle replies sent to readers (#13, #14, #15) — Apr 1');
  bold('Personal');
  bullet('Exams @ Otorhinus Medical Clinic (ENT) — Mar 30');
  bullet('Returned polysomnography equipment — Mar 31');
  bullet('Configured OpenClaw — Mar 31–Apr 2');
  bullet('Changed OpenAI account email — Apr 2');
  bold('Other');
  bullet('Built weekly review automation system (Claude Code + TickTick/Calendar/Gmail/GitHub) — Apr 2');

  // Sprint Retrospective
  h2('Sprint Retrospective ', '(30/Mar–5/Apr, 4 workdays)');
  h3("Last week's improvement goals");
  table([
    ['Improvement', 'Result'],
    ['Work +2h in important outputs', '[PENDING] / 4'],
    ['Spend 1+ hours OoH',           '2 / 4'],
    ['Make impact',                   '[PENDING] / 4']
  ], true);

  h3('Health goals');
  table([
    ['Health',      'Result'],
    ['Meditate',    '[PENDING] / 7'],
    ['Exercise',    '[PENDING] / 3'],
    ['Bedtime',     '[PENDING] / 23h15'],
    ['Wake-up time','[PENDING] / 8h00']
  ], true);

  h3('What did I do well?');
  bullet('Built and deployed the weekly review automation system — a significant improvement to the review workflow that connects TickTick, Calendar, Gmail, and GitHub into a single command.');
  bullet('Maintained OoH habit on Mon and Tue.');
  bullet('Did structured interview prep before the Engineer Access interview.');

  h3('What could be improved?');
  bullet('OoH only on 2 of 4 workdays.');
  bullet('Jandig output was light — one issue review rather than a meaningful deliverable.');
  bullet('No exercise block this week.');

  h3('What will I commit to improving?');
  bullet('OoH on at least 3 workdays next week.');
  bullet('Block dedicated Jandig time daily (not just reactive issue reviews).');

  // Sprint Planning
  h2('Sprint Planning ', '(6–12/Apr, 5 workdays)');
  h3('Week goal');
  bullet('[PENDING — define on Monday]');

  h3('Projects Priority');
  numbered('Jandig');
  numbered('OpenClaw');
  numbered('Diar.ia');
  bold('On my mind');
  numbered('Job hunt');
  bold('On hold');
  numbered('Study');
  numbered('memeLab/Fnord');

  h3('Main Outputs');
  bold('Health');
  numbered('Take exams to periodontist — Apr 8');
  bold('Scheduling');
  numbered('Week planning — Apr 10');
  bold('Jandig');
  numbered('Ship a meaningful deliverable (code or PR), not just issue reviews');
  bold('OpenClaw');
  numbered('Define first real use case / workflow to build');
  bold('Diar.ia');
  numbered('Weekly editions (Mon–Fri)');

  h3("Next week's goals");
  table([
    ['Improvement'],
    ['Work +2h in important outputs'],
    ['Spend 1+ hours OoH'],
    ['Make impact']
  ], false);
  table([
    ['Health',       'Goal'],
    ['Meditate',     '7 days'],
    ['Exercise',     '3 days'],
    ['Sleep time',   '23h15'],
    ['Wake-up time', '8h00']
  ], true);

  Logger.log('Sprint 30/Mar–5/Apr inserido com sucesso!');
}
