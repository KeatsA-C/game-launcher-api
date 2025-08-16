// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';

function parseOrigins(csv?: string): (string | RegExp)[] | boolean {
  if (!csv) return false; // no CORS in local-only tooling
  const arr = csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length ? arr : false;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Enable native 'ws' for @WebSocketGateway()
  app.useWebSocketAdapter(new WsAdapter(app));
  app.useLogger(['error', 'warn', 'log', 'debug']); // enable 'log'
  const origins = parseOrigins(process.env.CORS_ORIGINS);
  app.enableCors({
    //origin: origins, // exact allowlist
    origin: '*', // exact allowlist
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    exposedHeaders: [],
    credentials: false, // Bearer tokens, keep false
    maxAge: 600,
    optionsSuccessStatus: 204,
  });

  //await app.listen(process.env.PORT ?? 3000); //local
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap().catch((e) => {
  // Avoid leaking secrets; print message + stack only.
  console.error('[FATAL]', e?.message);
  console.error(e?.stack);
  process.exit(1);
});
