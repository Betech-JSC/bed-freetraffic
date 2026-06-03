"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSchedulerEngine = startSchedulerEngine;
const scheduleDispatch_1 = require("../services/scheduleDispatch");
const TICK_MS = 60_000;
function startSchedulerEngine() {
    setInterval(() => {
        void (0, scheduleDispatch_1.dispatchDueSchedules)(10).catch((err) => {
            console.error('[ScheduleBot]', err);
        });
    }, TICK_MS);
    console.log('✅ Bot hẹn giờ (schedule dispatch) — quét mỗi 60 giây');
}
