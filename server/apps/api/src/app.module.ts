import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthGuard } from '@platform/authz';
import { AllExceptionsFilter } from '@platform/common';
import { CoreModule } from './core.module';
import { InfrastructureModule } from './infrastructure.module';
import { HealthController } from './health.controller';
import type { Env } from './env';
import { DrawerModule } from './modules/drawer/drawer.module';
import { EnvManagerModule } from './modules/env-manager/env-manager.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { ProjectTrackerModule } from './modules/project-tracker/project-tracker.module';
import { ArkasodharaModule } from './modules/arkasodhara/arkasodhara.module';

const PROJECT_MODULES = {
  drawer: DrawerModule,
  'env-manager': EnvManagerModule,
  portfolio: PortfolioModule,
  'project-tracker': ProjectTrackerModule,
  arkasodhara: ArkasodharaModule,
} as const;

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    const projectModule = PROJECT_MODULES[env.PROJECT];
    return {
      module: AppModule,
      imports: [CoreModule, InfrastructureModule, EventEmitterModule.forRoot(), projectModule],
      controllers: [HealthController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: AuthGuard,
        },
        {
          provide: APP_FILTER,
          useClass: AllExceptionsFilter,
        },
      ],
    };
  }
}
