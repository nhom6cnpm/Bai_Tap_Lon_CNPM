import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  });
  await app.listen(process.env.PORT || 3001);
  Logger.log(
    `BrewLite API running on port ${process.env.PORT || 3001}`,
    'Bootstrap',
  );
}
void bootstrap();
