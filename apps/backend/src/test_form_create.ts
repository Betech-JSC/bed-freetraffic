import prisma from './lib/prisma';

async function testFormCreate() {
  console.log('🚀 Testing CustomForm insertion in Prisma...');
  try {
    const workspace = await prisma.workspace.findFirst();
    if (!workspace) {
      console.error('❌ No workspace found.');
      return;
    }

    const payload = {
      name: 'đăng ký tư vấn',
      fieldsJson: JSON.stringify([
        { name: 'name', label: 'Lê Duy KH', required: true },
        { name: 'email', label: 'nhocnano2@gmail.com', required: true },
        { name: 'phone', label: '0963660548', required: false }
      ]),
      workspaceId: workspace.id,
    };

    console.log('📦 Creating CustomForm with payload:', payload);

    const form = await prisma.customForm.create({
      data: {
        name: payload.name,
        fieldsJson: payload.fieldsJson,
        workspaceId: payload.workspaceId,
      }
    });

    console.log('✅ CustomForm created successfully:', form);

    // Clean it up
    await prisma.customForm.delete({ where: { id: form.id } });
    console.log('🧹 Cleaned up test form.');

  } catch (error) {
    console.error('❌ Error during CustomForm creation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFormCreate();
