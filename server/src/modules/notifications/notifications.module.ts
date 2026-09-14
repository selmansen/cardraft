import { Module } from '@nestjs/common';

import { InactivityReminderService } from './inactivity-reminder.service.js';

@Module({
  providers: [InactivityReminderService],
})
export class NotificationsModule {}
