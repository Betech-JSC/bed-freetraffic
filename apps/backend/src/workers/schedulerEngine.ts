import { dispatchDueSchedules } from '../services/scheduleDispatch';

const TICK_MS = 60_000;

export function startSchedulerEngine() {
  setInterval(() => {
    void dispatchDueSchedules(10).catch((err) => {
      console.error('[ScheduleBot]', err);
    });
  }, TICK_MS);

  console.log('✅ Bot hẹn giờ (schedule dispatch) — quét mỗi 60 giây');
}
