export type LayoutMeta = {
  title: string;
  description?: string;
  ogImageUrl?: string;
  ogUrl?: string;
};

export function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function layout(meta: LayoutMeta, bodyHtml: string): string {
  const head: string[] = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escape(meta.title)}</title>`,
    '<link rel="stylesheet" href="/styles.css">',
    '<link rel="icon" href="/favicon.svg">',
    '<script src="/htmx.min.js" defer></script>',
  ];

  if (meta.description) {
    head.push(`<meta name="description" content="${escape(meta.description)}">`);
  }

  if (meta.ogImageUrl) {
    head.push('<meta property="og:type" content="website">');
    head.push(`<meta property="og:title" content="${escape(meta.title)}">`);
    if (meta.description) {
      head.push(
        `<meta property="og:description" content="${escape(meta.description)}">`,
      );
    }
    head.push(`<meta property="og:image" content="${escape(meta.ogImageUrl)}">`);
    head.push('<meta property="og:image:width" content="1200">');
    head.push('<meta property="og:image:height" content="630">');
    if (meta.ogUrl) {
      head.push(`<meta property="og:url" content="${escape(meta.ogUrl)}">`);
    }
    head.push('<meta name="twitter:card" content="summary_large_image">');
    head.push(`<meta name="twitter:title" content="${escape(meta.title)}">`);
    head.push(`<meta name="twitter:image" content="${escape(meta.ogImageUrl)}">`);
  }

  return `<!doctype html>
<html lang="en">
<head>
${head.join("\n")}
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
