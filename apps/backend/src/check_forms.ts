import prisma from './lib/prisma';

async function checkForms() {
  try {
    const forms = await prisma.customForm.findMany();
    console.log('📋 Custom Forms in Database:', forms);
  } catch (error) {
    console.error('❌ Error reading Custom Forms:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkForms();
