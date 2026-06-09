import { dispatchDueSchedules } from '../services/scheduleDispatch';
import prisma from '../lib/prisma';

const TICK_MS = 60_000;

async function autoCompleteRunningAbTests() {
  try {
    const runningTests = await prisma.abTest.findMany({
      where: { status: 'RUNNING' }
    });

    for (const test of runningTests) {
      const { id, clicksA, clicksB, impressionsA, impressionsB } = test;
      const totalImpressions = impressionsA + impressionsB;
      const totalConversions = clicksA + clicksB;
      const totalNonConversions = totalImpressions - totalConversions;

      // Ngưỡng tối thiểu là 200 impressions và mỗi biến thể phải có ít nhất 50 impressions
      if (totalImpressions >= 200 && impressionsA >= 50 && impressionsB >= 50) {
        if (totalConversions > 0 && totalNonConversions > 0) {
          const o11 = clicksA;
          const o12 = impressionsA - clicksA;
          const o21 = clicksB;
          const o22 = impressionsB - clicksB;
          
          const numerator = totalImpressions * Math.pow(o11 * o22 - o12 * o21, 2);
          const denominator = impressionsA * impressionsB * totalConversions * totalNonConversions;
          
          if (denominator > 0) {
            const chiSquare = numerator / denominator;
            // Ngưỡng alpha = 0.05 là 3.841 (độ tin cậy 95%)
            if (chiSquare > 3.841) {
              const crA = clicksA / impressionsA;
              const crB = clicksB / impressionsB;
              const winner = crA > crB ? 'A' : 'B';

              await prisma.abTest.update({
                where: { id },
                data: {
                  status: 'COMPLETED',
                  winner,
                  updatedAt: new Date()
                }
              });
              console.log(`[ABTestEngine] Tự động hoàn thành Test #${id} "${test.name}". Winner: Variant ${winner} (chi-square: ${chiSquare.toFixed(3)})`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[ABTestEngine] Lỗi quét tự động hoàn thành A/B Test:', error);
  }
}

export function startSchedulerEngine() {
  setInterval(() => {
    void dispatchDueSchedules(10).catch((err) => {
      console.error('[ScheduleBot]', err);
    });
    void autoCompleteRunningAbTests().catch((err) => {
      console.error('[ABTestEngine]', err);
    });
  }, TICK_MS);

  console.log('✅ Bot hẹn giờ (schedule dispatch) & AB-Test Auto-Winner — quét mỗi 60 giây');
}

