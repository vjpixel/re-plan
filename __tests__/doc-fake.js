// Minimal stub of the Apps Script globals used by insert-sprint.gs:
// DocumentApp, PropertiesService, Logger.
//
// Each "fake" element records the calls it received so tests can inspect
// what insert-sprint.gs actually does (text inserted, bold/italic ranges
// applied, table borders, etc.) without needing a real Google Doc.
//
// Returned by createFakeDocumentApp(): an object that mimics DocumentApp,
// plus a `_getCurrentBody()` test helper that returns the FakeBody created
// by the most recent `openById` call.

function createFakeText() {
  const ops = [];
  return {
    setBold(...args) {
      if (args.length === 1) {
        ops.push({ op: 'setBold', value: args[0] });
      } else {
        ops.push({ op: 'setBold', start: args[0], end: args[1], value: args[2] });
      }
    },
    setItalic(...args) {
      if (args.length === 1) {
        ops.push({ op: 'setItalic', value: args[0] });
      } else {
        ops.push({ op: 'setItalic', start: args[0], end: args[1], value: args[2] });
      }
    },
    setFontSize(...args) {
      ops.push({ op: 'setFontSize', start: args[0], end: args[1], value: args[2] });
    },
    _ops: ops,
  };
}

function createFakeParagraph(text) {
  const textObj = createFakeText();
  const p = {
    nodeType: 'paragraph',
    text,
    heading: null,
    setHeading(h) {
      p.heading = h;
      return p;
    },
    editAsText() {
      return textObj;
    },
    _text: textObj,
  };
  return p;
}

function createFakeListItem(text) {
  const textObj = createFakeText();
  const item = {
    nodeType: 'list-item',
    text,
    glyph: null,
    setGlyphType(g) {
      item.glyph = g;
      return item;
    },
    editAsText() {
      return textObj;
    },
    _text: textObj,
  };
  return item;
}

function createFakeTable(rows) {
  const cellGrid = rows.map((row) =>
    row.map((cellText) => {
      const textObj = createFakeText();
      return {
        text: cellText,
        attributes: null,
        setAttributes(attrs) {
          this.attributes = attrs;
        },
        editAsText() {
          return textObj;
        },
        _text: textObj,
      };
    })
  );
  return {
    nodeType: 'table',
    rows: cellGrid,
    getNumRows() {
      return cellGrid.length;
    },
    getRow(r) {
      return {
        getNumCells() {
          return cellGrid[r].length;
        },
        getCell(c) {
          return cellGrid[r][c];
        },
      };
    },
  };
}

function createFakeBody() {
  const nodes = [];
  return {
    insertParagraph(pos, text) {
      const p = createFakeParagraph(text);
      nodes.splice(pos, 0, p);
      return p;
    },
    insertListItem(pos, text) {
      const item = createFakeListItem(text);
      nodes.splice(pos, 0, item);
      return item;
    },
    insertTable(pos, rows) {
      const t = createFakeTable(rows);
      nodes.splice(pos, 0, t);
      return t;
    },
    _nodes: nodes,
  };
}

function createFakeDocumentApp() {
  let currentBody = null;
  return {
    ParagraphHeading: {
      HEADING1: 'HEADING1',
      HEADING2: 'HEADING2',
      HEADING3: 'HEADING3',
    },
    GlyphType: {
      BULLET: 'BULLET',
      NUMBER: 'NUMBER',
    },
    Attribute: {
      BORDER_COLOR: 'BORDER_COLOR',
      BORDER_WIDTH: 'BORDER_WIDTH',
    },
    openById(_id) {
      currentBody = createFakeBody();
      return {
        getBody() {
          return currentBody;
        },
      };
    },
    _getCurrentBody() {
      return currentBody;
    },
  };
}

function createFakePropertiesService(props = {}) {
  return {
    getScriptProperties() {
      return {
        getProperty(key) {
          return Object.prototype.hasOwnProperty.call(props, key) ? props[key] : null;
        },
      };
    },
  };
}

const fakeLogger = { log() {} };

module.exports = {
  createFakeBody,
  createFakeDocumentApp,
  createFakePropertiesService,
  fakeLogger,
};
