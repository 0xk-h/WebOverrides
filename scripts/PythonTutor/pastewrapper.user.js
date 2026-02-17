// ==UserScript==
// @name         PythonTutor paste wrapper
// @namespace    http://tampermonkey.net/
// @version      2025-09-04
// @description  auto-paste leetcode wrapper
// @author       Hunter
// @match        https://pythontutor.com/render.html
// @match        https://pythontutor.com/visualize.html
// @icon         https://www.google.com/s2/favicons?sz=64&domain=pythontutor.com
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  console.log("PythonTutor paste wrapper script loaded");

  const importMap = {
    bisect: ["insort", "bisect_left", "bisect_right"],
    collections: ["Counter", "deque", "defaultdict", "OrderedDict"],
    functools: ["lru_cache", "cache", "reduce"],
    itertools: [
      "permutations",
      "combinations",
      "product",
      "accumulate",
      "groupby",
    ],
    typing: ["List", "Optional", "Dict", "Tuple", "Set"],
    heapq: ["heappush", "heappop", "heapify", "nlargest", "nsmallest"],
    math: ["ceil", "floor", "sqrt", "gcd", "lcm", "inf"],
    random: ["randint", "random", "choice"],
    re: ["match", "search", "findall", "sub"],
    string: ["ascii_lowercase", "ascii_uppercase", "digits"],
  };

  const getImports = (code) => {
    const existingImports = new Set();
    const lines = code.split("\n");

    lines.forEach((line) => {
      const match = line.match(/^\s*(?:from|import)\s+([a-zA-Z0-9_]+)/);
      if (match) existingImports.add(match[1]);
    });

    let result = "";

    Object.entries(importMap).forEach(([module, symbols]) => {
      if (existingImports.has(module)) return;

      const moduleUsage = new RegExp(`\\b${module}\\.`).test(code);

      if (moduleUsage) {
        result += `import ${module}\n`;
        return;
      }

      const used = symbols.filter((symbol) =>
        new RegExp(`\\b${symbol}\\b`).test(code),
      );

      if (used.length > 0) {
        result += `from ${module} import ${used.join(", ")}\n`;
      }
    });

    return result ? result + "\n" : "";
  };

  const transformCode = (pasted) => {
    const raw = pasted.trim();
    if (!raw) return raw;

    const classMatches = [...raw.matchAll(/^\s*class\s+(\w+)/gm)];
    const className = classMatches.length
      ? classMatches[classMatches.length - 1][1]
      : null;

    let classBlockMatch = null;

    if (className) {
      const startIndex = raw.indexOf(`class ${className}`);
      if (startIndex !== -1) {
        classBlockMatch = [raw.slice(startIndex)];
      }
    }

    let funcNames = [];
    if (classBlockMatch) {
      const classBlock = classBlockMatch[0];
      const funcMatches = [...classBlock.matchAll(/^\s{4}def\s+(\w+)\s*\(/gm)];
      funcNames = funcMatches
        .map((m) => m[1])
        .filter((name) => !name.startsWith("__"));
    }

    if (className && funcNames.length > 0) {
      let out = raw;

      out = getImports(out) + out;

      out += "\n\n";
      const Classtester = new RegExp(
        `^\\s*h\\s*=\\s*${className}\\s*\\(\\s*\\)`,
        "m",
      );

      if (Classtester.test(out)) {
        return out;
      }

      let calls = `h = ${className}()\n`;
      funcNames.forEach((fn) => {
        calls += `print(h.${fn}())\n`;
      });

      return out + calls.trimEnd();
    }

    return raw;
  };

  const attachPasteHandler = () => {
    const aceInput = document.querySelector(".ace_text-input");
    if (!aceInput || !window.ace) {
      console.log("Waiting for the Editor...");
      return false;
    }

    console.log("Found input field");

    const editor = ace.edit(document.querySelector(".ace_editor"));

    aceInput.addEventListener("paste", (e) => {
      const data = e.clipboardData;
      if (!data) return;

      const text = data.getData("text");
      if (!text) return;

      console.log("Paste detected:");

      const wrapped = transformCode(text);

      if (wrapped === text.trim()) {
        console.log("Allowing normal paste");
        return;
      }

      e.preventDefault();
      e.stopImmediatePropagation();

      editor.setValue(wrapped, -1);
      editor.focus();

      console.log("Wrapped code injected");
    });

    return true;
  };

  if (!attachPasteHandler()) {
    const obs = new MutationObserver(() => {
      if (attachPasteHandler()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
})();
