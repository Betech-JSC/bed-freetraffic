import prisma from './lib/prisma';

async function main() {
  console.log('--- CAMPAIGNS ---');
  const campaigns = await prisma.socialListeningCampaign.findMany();
  console.dir(campaigns, { depth: null });

  console.log('--- LOGS COUNT ---');
  const logsCount = await prisma.socialListeningLog.count();
  console.log('Total logs:', logsCount);

  console.log('--- RECENT LOGS ---');
  const logs = await prisma.socialListeningLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { campaign: { select: { name: true } } }
  });
  console.dir(logs, { depth: null });
}

main().catch(console.error);
