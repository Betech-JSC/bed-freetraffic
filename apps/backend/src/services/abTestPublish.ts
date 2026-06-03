import prisma from '../lib/prisma';
import { renderContent } from '../lib/dispatch/render';

export type PublishContent = {
  title: string;
  content: string;
  imageUrl: string | null;
  urlTarget: string | null;
  abVariant?: 'A' | 'B';
  abTestId?: number;
};

function trackClickUrl(testId: number, variant: 'A' | 'B', target: string): string {
  const base = process.env.API_PUBLIC_URL || 'http://localhost:4000';
  return `${base}/api/abtests/track/click/${testId}?variant=${variant}&url=${encodeURIComponent(target)}`;
}

/** Chọn biến thể A/B và ghi impression khi publish (schedule / automation). */
export async function resolveAbTestContent(input: {
  title: string;
  content: string;
  imageUrl?: string | null;
  urlTarget?: string | null;
  abTestId?: number | null;
}): Promise<PublishContent> {
  const base: PublishContent = {
    title: input.title,
    content: input.content,
    imageUrl: input.imageUrl ?? null,
    urlTarget: input.urlTarget ?? null,
  };

  if (!input.abTestId) return base;

  const test = await prisma.abTest.findUnique({
    where: { id: input.abTestId },
    include: { templateA: true, templateB: true },
  });

  if (!test || test.status !== 'RUNNING' || (!test.templateA && !test.templateB)) {
    return base;
  }

  const variant: 'A' | 'B' =
    test.templateA && test.templateB
      ? Math.random() < 0.5
        ? 'A'
        : 'B'
      : test.templateA
        ? 'A'
        : 'B';

  const template = variant === 'A' ? test.templateA : test.templateB;
  if (!template) return base;

  await prisma.abTest.update({
    where: { id: test.id },
    data:
      variant === 'A' ? { impressionsA: { increment: 1 } } : { impressionsB: { increment: 1 } },
  });

  const urlTarget = input.urlTarget?.trim() || null;
  const trackedUrl = urlTarget ? trackClickUrl(test.id, variant, urlTarget) : null;

  return {
    title: template.title || input.title,
    content: template.content,
    imageUrl: template.imageUrl ?? input.imageUrl ?? null,
    urlTarget: trackedUrl,
    abVariant: variant,
    abTestId: test.id,
  };
}

export function buildDispatchMessage(
  content: string,
  vars: { urlTarget?: string | null; title?: string }
): string {
  return renderContent(content, {
    urlTarget: vars.urlTarget || undefined,
    name: vars.title,
  });
}
