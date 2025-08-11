import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function parseOrigins(csv?: string): (string | RegExp)[] | boolean {
  if (!csv) return false; // no CORS in local-only tooling
  const arr = csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length ? arr : false;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origins = parseOrigins(process.env.CORS_ORIGINS);
  app.enableCors({
    origin: origins, // exact allowlist
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    exposedHeaders: [], // add if you need to read custom response headers
    credentials: false, // you’re using Bearer tokens, keep this false
    maxAge: 600, // cache preflight for 10 minutes
    optionsSuccessStatus: 204, // explicit 204 for some clients
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
