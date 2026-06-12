import prisma from './src/lib/prisma';

function injectNavbarAndFooter(html: string, slug: string, workspaceName: string, activeTab: string, theme = 'ocean-breeze'): string {
  let headInject = '';
  if (!html.includes('cdn.tailwindcss.com')) {
    headInject += `<script src="https://cdn.tailwindcss.com"></script>\n`;
  }
  if (!html.includes('fonts.googleapis.com')) {
    headInject += `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; }
</style>\n`;
  }

  let resultHtml = html;
  if (headInject) {
    if (resultHtml.includes('</head>')) {
      resultHtml = resultHtml.replace('</head>', `${headInject}</head>`);
    } else {
      resultHtml = headInject + resultHtml;
    }
  }
  return resultHtml;
}

async function main() {
  const page = await prisma.landingPage.findFirst({
    where: { slug: 'betecccchhh' }
  });
  if (!page) return;

  const finalHtml = injectNavbarAndFooter(page.htmlContent, page.slug, "Workspace", "home");
  const headStart = finalHtml.indexOf('<head>');
  const headEnd = finalHtml.indexOf('</head>');
  console.log("=== HEAD ===");
  console.log(finalHtml.substring(headStart, headEnd + 7));
}
main();
