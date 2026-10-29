import { Module } from '@nestjs/common';
import { MockGatewayController } from './mock-gateway.controller';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [MockGatewayController],
})
export class MockGatewayModule {}
