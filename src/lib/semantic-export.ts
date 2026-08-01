import type { AdminMetrics } from '@/types';

/**
 * Genera una estructura JSON-LD oficial según esquemas de Schema.org para Open Data.
 */
export function generateJsonLdMetrics(metrics: AdminMetrics): string {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Resultados Oficiales Elecciones Consejo Local SLEP',
    description: 'Cómputo final estructurado del proceso de votación electrónica democrática.',
    datePublished: new Date(metrics.lastUpdated).toISOString(),
    publisher: {
      '@type': 'GovernmentOrganization',
      name: 'Servicio Local de Educación Pública',
    },
    spatialCoverage: {
      '@type': 'Place',
      name: 'Chile',
    },
    variableMeasured: [
      {
        '@type': 'PropertyValue',
        name: 'Votos Totales Emitidos',
        value: metrics.votes.total,
      },
      {
        '@type': 'PropertyValue',
        name: 'Padrón Electoral Habilitado',
        value: metrics.padron.total,
      },
    ],
    hasPart: metrics.estamentos.map((e) => ({
      '@type': 'VoteAction',
      name: `Escrutinio Estamento: ${e.label}`,
      agent: {
        '@type': 'Audience',
        audienceType: e.estamento,
      },
      result: e.candidates.map((c) => ({
        '@type': 'Candidate',
        name: c.name,
        identifier: c.id,
        votesReceived: c.votes,
      })),
    })),
  };

  return JSON.stringify(jsonLd, null, 2);
}

/**
 * Genera el formato RDF Turtle (.ttl) para ingesta directa en bases de datos orientadas a grafos.
 */
export function generateTurtleMetrics(metrics: AdminMetrics): string {
  const timestampIso = new Date(metrics.lastUpdated).toISOString();
  let turtle = `@prefix schema: <https://schema.org/> .\n`;
  turtle += `@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n`;
  turtle += `@prefix slep: <https://slep.gob.cl/ontology/> .\n\n`;

  turtle += `<https://slep.gob.cl/eleccion/2026> a schema:Dataset ;\n`;
  turtle += `    schema:name "Resultados Oficiales Elecciones Consejo Local SLEP" ;\n`;
  turtle += `    schema:datePublished "${timestampIso}"^^xsd:dateTime ;\n`;
  turtle += `    slep:votosTotales ${metrics.votes.total} ;\n`;
  turtle += `    slep:padronTotal ${metrics.padron.total} .\n\n`;

  metrics.estamentos.forEach((e) => {
    turtle += `<https://slep.gob.cl/estamento/${e.estamento}> a slep:Estamento ;\n`;
    turtle += `    schema:name "${e.label}" ;\n`;
    turtle += `    slep:votosCast ${e.votesCast} ;\n`;
    turtle += `    slep:padronCount ${e.padronCount} .\n\n`;

    e.candidates.forEach((c) => {
      turtle += `<https://slep.gob.cl/candidato/${c.id}> a schema:Person, slep:Candidato ;\n`;
      turtle += `    schema:name "${c.name}" ;\n`;
      turtle += `    slep:votosAcumulados ${c.votes} ;\n`;
      turtle += `    slep:perteneceAEstamento <https://slep.gob.cl/estamento/${e.estamento}> .\n\n`;
    });
  });

  return turtle;
}
