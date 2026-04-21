import type { FileNode } from '../types';
import { v4 as uuid } from 'uuid';

export function getInitialFiles(): FileNode[] {
  return [
    {
      id: uuid(), name: 'src', type: 'folder', isExpanded: true,
      children: [
        {
          id: uuid(), name: 'index.js', type: 'file', language: 'javascript',
          content: `// Welcome to BlinkCode!
// Press Run to execute your code

function greet(name) {
  return "Hello, " + name + "! Welcome to BlinkCode.";
}

console.log(greet("Developer"));

const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log("Sum of [1,2,3,4,5] = " + sum);
`,
        },
        {
          id: uuid(), name: 'app.js', type: 'file', language: 'javascript',
          content: `class App {
  constructor() {
    this.version = "0.2.0";
    this.name = "BlinkCode";
  }
  start() {
    console.log(this.name + " v" + this.version + " started!");
  }
}

const app = new App();
app.start();
`,
        },
        {
          id: uuid(), name: 'utils.js', type: 'file', language: 'javascript',
          content: `export function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('en-US').format(date);
}
`,
        },
      ],
    },
    {
      id: uuid(), name: 'styles', type: 'folder', isExpanded: false,
      children: [
        {
          id: uuid(), name: 'main.css', type: 'file', language: 'css',
          content: `:root {
  --bg: #0f1115;
  --fg: #e6e6e6;
  --accent: #4f8cff;
}

body {
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  background: var(--bg);
  color: var(--fg);
}
`,
        },
      ],
    },
    {
      id: uuid(), name: 'index.html', type: 'file', language: 'html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>BlinkCode</title>
  <link rel="stylesheet" href="styles/main.css">
</head>
<body>
  <div id="app"></div>
  <script src="src/index.js"></script>
</body>
</html>
`,
    },
    {
      id: uuid(), name: 'package.json', type: 'file', language: 'json',
      content: `{
  "name": "blinkcode-project",
  "version": "0.2.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  }
}
`,
    },
    {
      id: uuid(), name: 'README.md', type: 'file', language: 'markdown',
      content: `# BlinkCode Project

Start coding! Press Run to see output.
`,
    },
  ];
}
