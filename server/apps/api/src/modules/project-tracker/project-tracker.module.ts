import { Module } from '@nestjs/common';
import { ProjectTrackerController, PublicProjectTrackerController } from './project-tracker.controller';
import { ProjectTrackerDataController } from './data.controller';
import { ProjectTrackerService } from './project-tracker.service';
import { TrackerPatService } from './pat-auth.service';
import { TrackerAuthGuard } from './tracker-auth.guard';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  controllers: [ProjectTrackerController, PublicProjectTrackerController, ProjectTrackerDataController],
  providers: [ProjectTrackerService, TrackerPatService, TrackerAuthGuard, RealtimeGateway],
})
export class ProjectTrackerModule {}
