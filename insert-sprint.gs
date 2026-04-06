const SPRINT_FILE_NAME = 'sprint-final.md';
const DOC_ID = '1r-s3AhOBNJraeJmPV8TcnN5JPI-Qw8nnWtJewKzVf6I';

function insertSprintReview() {
  // Lê arquivo do Google Drive
  const fileContent = getFileContent(SPRINT_FILE_NAME);
  if (!fileContent) {
    Logger.log('Erro: arquivo ' + SPRINT_FILE_NAME + ' não encontrado');
    return;
  }

  const data = parseSprintMarkdown(fileContent);
  const doc = DocumentApp.openById(DOC_ID);
  const body = doc.getBody();
  let idx = 0;

  // Helper functions
  const h = {
    h1: (text) => body.insertParagraph(idx++, text).setHeading(DocumentApp.ParagraphHeading.HEADING1),
    h2: (regular, italic) => {
      const p = body.insertParagraph(idx++, regular).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      if (italic) {
        const t = p.editAsText();
        const start = t.getText().length;
        t.appendText(italic).setItalic(start, t.getText().length - 1, true);
      }
    },
    h3: (text) => body.insertParagraph(idx++, text).setHeading(DocumentApp.ParagraphHeading.HEADING3),
    bullet: (text) => {
      const item = body.insertListItem(idx++, text);
      item.setGlyphType(DocumentApp.GlyphType.BULLET);
      item.editAsText().setBold(false);
    },
    numbered: (text) => {
      const item = body.insertListItem(idx++, text);
      item.setGlyphType(DocumentApp.GlyphType.NUMBER);
      item.editAsText().setBold(false);
    },
    bold: (text) => body.insertParagraph(idx++, text).editAsText().setBold(true),
    table: (rows, boldResultCol) => {
      const t = body.insertTable(idx++, rows);
      const borderAttrs = {
        [DocumentApp.Attribute.BORDER_COLOR]: '#000000',
        [DocumentApp.Attribute.BORDER_WIDTH]: 1
      };
      for (let r = 0; r < t.getNumRows(); r++) {
        const row = t.getRow(r);
        for (let c = 0; c < row.getNumCells(); c++) {
          const cell = row.getCell(c);
          cell.setAttributes(borderAttrs);
          if (r === 0) cell.editAsText().setBold(true);
          if (boldResultCol && r > 0 && c === row.getNumCells() - 1) cell.editAsText().setBold(true);
        }
      }
    }
  };

  // Insere dados
  if (data.title) h.h1(data.title);

  insertSection(h, data.review);
  insertSection(h, data.retrospective);
  insertSection(h, data.planning);

  Logger.log('Sprint atualizado com sucesso!');
}

function getFileContent(fileName) {
  const files = DriveApp.getFilesByName(fileName);
  if (files.hasNext()) {
    return files.next().getBlob().getDataAsString();
  }
  return null;
}

function parseSprintMarkdown(content) {
  const lines = content.split('\n');
  const data = {
    title: lines[0]?.replace('# ', ''),
    review: { items: [] },
    retrospective: { items: [] },
    planning: { items: [] }
  };

  let currentSection = null;
  let currentSubsection = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      currentSection = line.replace('## ', '').trim();
    } else if (line.startsWith('### ')) {
      currentSubsection = line.replace('### ', '').trim();
    } else if (line.startsWith('* ') || line.startsWith('- ')) {
      if (currentSection) {
        data[currentSection.toLowerCase().replace(/\s+/g, '_')].items.push({
          type: 'bullet',
          text: line.replace(/^[\*\-]\s/, '').trim()
        });
      }
    }
  }

  return data;
}

function insertSection(h, section) {
  section.items.forEach(item => {
    if (item.type === 'bullet') h.bullet(item.text);
  });
}
