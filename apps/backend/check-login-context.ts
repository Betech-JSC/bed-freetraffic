import prisma from './src/lib/prisma';

async function main() {
  const page = await prisma.landingPage.findFirst({
    where: { slug: 'betecccchhh' }
  });
  if (!page) return;

  const html = page.htmlContent;
  let idx = 0;
  while ((idx = html.indexOf('Đăng nhập', idx)) !== -1) {
    console.log("Found 'Đăng nhập' at index", idx);
    console.log("Context:", html.substring(idx - 100, idx + 100));
    idx += 9;
  }
}
main();
