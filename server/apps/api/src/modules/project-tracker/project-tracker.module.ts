import { Module } from '@nestjs/common';
import { ProjectTrackerController, PublicProjectTrackerController } from './project-tracker.controller';
import { ProjectTrackerDataController } from './data.controller';
import { ProjectTrackerService } from './project-tracker.service';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  controllers: [ProjectTrackerController, PublicProjectTrackerController, ProjectTrackerDataController],
  providers: [ProjectTrackerService, RealtimeGateway],
})
export class ProjectTrackerModule {}
