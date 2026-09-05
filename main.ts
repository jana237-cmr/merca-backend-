// Point d'entrée du serveur (le programme qui démarre l'API)
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ValidationPipe = vérifie automatiquement que les données reçues du client
  // respectent le format attendu (ex: prix doit être un nombre positif)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors(); // autorise l'app mobile à appeler cette API depuis un autre domaine
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`MERCA API démarrée sur le port ${port}`);
}
bootstrap();
