import { Module } from '@nestjs/common';
import { DrawerAccessService, FlowsService, TeamsService } from './drawer.service';
import { FlowsController, FlowMembersController, PublicFlowsController, TeamsController } from './drawer.controller';
import { UploadsController } from './uploads.controller';

@Module({
  controllers: [FlowsController, FlowMembersController, PublicFlowsController, TeamsController, UploadsController],
  providers: [DrawerAccessService, FlowsService, TeamsService],
})
export class DrawerModule {}
