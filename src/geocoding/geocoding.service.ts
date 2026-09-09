import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  async geocode(address: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        address + ', Cameroun',
      )}`;
      const response = await fetch(url, {
        headers: {
          // Nominatim exige un identifiant d'app dans les requêtes (règle d'usage gratuit)
          'User-Agent': 'MERCA-App/1.0',
        },
      });
      const data = await response.json();
      if (!data || data.length === 0) {
        this.logger.warn(`Adresse introuvable : ${address}`);
        return null;
      }
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    } catch (error) {
      this.logger.error(`Erreur de géocodage pour "${address}"`, error);
      return null;
    }
  }
  }
