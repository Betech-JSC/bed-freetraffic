import prisma from './lib/prisma';

async function main() {
  const pages = await prisma.landingPage.findMany({});
  console.log('PAGES IN DB:', JSON.stringify(pages.map(p => ({ id: p.id, title: p.title, slug: p.slug, status: p.status })), null, 2));
}

main().catch(console.error);
