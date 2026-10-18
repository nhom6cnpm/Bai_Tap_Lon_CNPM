import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  });
  await app.listen(process.env.PORT || 3001);
  console.log(`BrewLite API running on port ${process.env.PORT || 3001}`);
}
void bootstrap();
