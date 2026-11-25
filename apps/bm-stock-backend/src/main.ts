import 'module-alias/register';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from './shared/logger/logger.service';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AdminSeeder } from './database/seeds/admin.seed';
import { RoleUsersSeeder } from './database/seeds/role-users.seed';

import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Increase body parser limits for payment screenshot uploads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);

  const corsOrigin = configService.get<string>('app.corsOrigin') || '*';
  const corsOrigins = corsOrigin === '*'
    ? '*'
    : corsOrigin?.split(',').map(o => o.trim()) || '*';

  app.enableCors({
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'x-company-id', 'X-Company-Id', 'X-Requested-With', '*'],
    credentials: true,
    optionsSuccessStatus: 200,
  });

  app.useLogger(logger);
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.setGlobalPrefix(configService.get<string>('app.apiPrefix') || 'api/v1');

  // Serve uploaded files (e.g. sale receipt screenshots) from /uploads with strict security headers (CWE-434 mitigation)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    setHeaders: (res: any) => {
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Swagger setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || 'NestJS Backend Starter API')
    .setDescription(configService.get<string>('swagger.description') || 'A comprehensive NestJS backend starter template API')
    .setVersion(configService.get<string>('swagger.version') || '1.0')
    .addBearerAuth({
      type: 'http',
      name: 'Authorization',
      description: 'Enter your Bearer token',
      scheme: 'bearer',
      bearerFormat: 'Bearer',
      in: 'header',
    },
      'access-token'
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig, {
  });
  SwaggerModule.setup('docs', app, document,{
    
     swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      operationsSorter: (a: any, b: any) => {
        const methodsOrder = [
          'post',
          'get',
          'put',
          'patch',
          'delete',
          'options',
          'trace',
        ];
        let result =
          methodsOrder.indexOf(a.get('method')) -
          methodsOrder.indexOf(b.get('method'));
        if (result === 0) {
          result = a.get('path').localeCompare(b.get('path'));
        }
        return result;
      },
      tagsSorter: 'alpha',
    }
  });

  // Run admin seeder
  try {
    const adminSeeder = app.get(AdminSeeder);
    await adminSeeder.seed();
    logger.log('Admin seeding completed');
  } catch (error) {
    logger.error('Error during admin seeding:', error);
  }

  // Run per-role demo user seeder (phone-number based credentials)
  try {
    const roleUsersSeeder = app.get(RoleUsersSeeder);
    await roleUsersSeeder.seed();
    logger.log('Role users seeding completed');
  } catch (error) {
    logger.error('Error during role users seeding:', error);
  }

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port, () => {
    logger.log(`Server started on http://localhost:${port}`, 'Bootstrap');
  });
}

bootstrap();