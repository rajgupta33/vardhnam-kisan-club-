import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const OPENAPI_TITLE = 'Vardhnam Agrotech Marketplace API';
export const OPENAPI_VERSION = '0.1.0';
export const OPENAPI_DESCRIPTION =
  'Managed agriculture marketplace API for identity, organisations, catalogue, distributor offers and inventory, farmer commerce, fulfilment and delivery, finance, returns and disputes, Kisan Club, support, files, notifications, jobs, Tally and dashboards. External providers remain mock unless explicitly configured.';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle(OPENAPI_TITLE)
    .setDescription(OPENAPI_DESCRIPTION)
    .setVersion(OPENAPI_VERSION)
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function serializeOpenApiDocument(document: OpenAPIObject): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
