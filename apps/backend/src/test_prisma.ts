import prisma from './lib/prisma';

async function test() {
  try {
    console.log('Querying CskhConfig...');
    const configs = await prisma.cskhConfig.findMany();
    console.log('Configs count:', configs.length);
    console.log('First config:', configs[0]);
    process.exit(0);
  } catch (err) {
    console.error('Prisma query failed:', err);
    process.exit(1);
  }
}

void test();
