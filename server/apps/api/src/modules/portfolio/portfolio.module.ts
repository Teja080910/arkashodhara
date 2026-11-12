import { Module } from '@nestjs/common';
import { PortfolioController, PortfolioUploadsController, PublicPortfolioController } from './portfolio.controller';
import { PortfolioDataController } from './data.controller';
import { PortfolioService } from './portfolio.service';

@Module({
  controllers: [PortfolioController, PublicPortfolioController, PortfolioDataController, PortfolioUploadsController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
