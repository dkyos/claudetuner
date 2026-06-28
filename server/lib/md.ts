// Minimal, dependency-free markdown → HTML for review reports. Escapes first,
// then applies a safe subset (headings, bold, inline code, fenced code, lists,
// paragraphs). Output is used with dangerouslySetInnerHTML on local content.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code style="background:#0e1117;padding:1px 5px;border-radius:4px;font-size:0.9em">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function renderMarkdown(md: string): string {
  const lines = (md || "").split("\n");
  const out: string[] = [];
  let inCode = false;
  let code: string[] = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) {
      out.push("</ul>");
      listOpen = false;
    }
  };

  for (const raw of lines) {
    const line = raw;
    if (line.trim().startsWith("```")) {
      if (inCode) {
        out.push(
          `<pre style="background:#0e1117;border:1px solid #1a1e27;border-radius:8px;padding:10px 12px;overflow:auto;font-size:12px"><code>${esc(code.join("\n"))}</code></pre>`
        );
        code = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = h[1].length;
      const size = [22, 18, 15, 13][lvl - 1] || 13;
      out.push(
        `<h${lvl} style="font-size:${size}px;margin:16px 0 6px;color:#e5e7eb">${inline(h[2])}</h${lvl}>`
      );
      continue;
    }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (!listOpen) {
        out.push('<ul style="margin:6px 0;padding-left:20px;color:#cbd5e1">');
        listOpen = true;
      }
      out.push(`<li style="margin:3px 0;line-height:1.6">${inline(li[1])}</li>`);
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    closeList();
    out.push(
      `<p style="margin:8px 0;line-height:1.7;color:#cbd5e1">${inline(line)}</p>`
    );
  }
  closeList();
  if (inCode && code.length)
    out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
  return out.join("\n");
}
