/**
 * Mock establishments (establecimientos) for SLEP VALLE DIGUILLÍN.
 * Each school has a voter count per estamento that makes up the total padrón.
 */

export interface MockSchool {
  id: string;
  name: string;
  shortName: string;
  voters: {
    directivos: number;
    docentes: number;
    asistentes: number;
    apoderados: number;
  };
}

export const SCHOOLS: MockSchool[] = [
  {
    id: 'lastarria',
    name: 'Liceo José Victorino Lastarria',
    shortName: 'Liceo Lastarria',
    voters: { directivos: 2, docentes: 22, asistentes: 14, apoderados: 210 },
  },
  {
    id: 'costa-rica',
    name: 'Colegio República de Costa Rica',
    shortName: 'Rep. Costa Rica',
    voters: { directivos: 2, docentes: 18, asistentes: 12, apoderados: 180 },
  },
  {
    id: 'martin-prado',
    name: 'Escuela Martín Prado',
    shortName: 'Escuela Martín Prado',
    voters: { directivos: 1, docentes: 11, asistentes: 7, apoderados: 120 },
  },
  {
    id: 'carmela-carvajal',
    name: 'Liceo Carmela Carvajal de Prat',
    shortName: 'Liceo C. Carvajal',
    voters: { directivos: 2, docentes: 19, asistentes: 13, apoderados: 195 },
  },
  {
    id: 'aplicacion',
    name: 'Colegio de Aplicación Artística y Cultural',
    shortName: 'Col. Aplicación',
    voters: { directivos: 2, docentes: 15, asistentes: 10, apoderados: 150 },
  },
  {
    id: 'pablo-neruda',
    name: 'Liceo de Aplicación Pablo Neruda',
    shortName: 'Liceo Pablo Neruda',
    voters: { directivos: 2, docentes: 17, asistentes: 11, apoderados: 170 },
  },
  {
    id: 'republica-paraguay',
    name: 'Escuela Básica República de Paraguay',
    shortName: 'Rep. Paraguay',
    voters: { directivos: 1, docentes: 9, asistentes: 6, apoderados: 90 },
  },
  {
    id: 'san-ignacio',
    name: 'Escuela San Ignacio de Loyola',
    shortName: 'San Ignacio',
    voters: { directivos: 1, docentes: 8, asistentes: 5, apoderados: 85 },
  },
  {
    id: 'los-almendros',
    name: 'Escuela Los Almendros',
    shortName: 'Los Almendros',
    voters: { directivos: 1, docentes: 7, asistentes: 5, apoderados: 75 },
  },
  {
    id: 'roberto-humeres',
    name: 'Liceo Roberto Humeres Noble',
    shortName: 'Liceo R. Humeres',
    voters: { directivos: 2, docentes: 16, asistentes: 10, apoderados: 160 },
  },
  {
    id: 'manuel-barros',
    name: 'Escuela Manuel Barros Borgoño',
    shortName: 'Esc. M. Barros',
    voters: { directivos: 1, docentes: 9, asistentes: 6, apoderados: 95 },
  },
  {
    id: 'dario-salas',
    name: 'Liceo Darío Salas',
    shortName: 'Liceo Darío Salas',
    voters: { directivos: 2, docentes: 18, asistentes: 12, apoderados: 185 },
  },
  {
    id: 'pdte-balmaceda',
    name: 'Escuela Presidente Balmaceda',
    shortName: 'Pdte. Balmaceda',
    voters: { directivos: 1, docentes: 8, asistentes: 5, apoderados: 80 },
  },
  {
    id: 'republica-ecuador',
    name: 'Escuela Básica República del Ecuador',
    shortName: 'Rep. Ecuador',
    voters: { directivos: 1, docentes: 7, asistentes: 4, apoderados: 70 },
  },
  {
    id: 'club-atletico',
    name: 'Escuela Club Atlético Santiago',
    shortName: 'Club Atlético',
    voters: { directivos: 1, docentes: 6, asistentes: 4, apoderados: 65 },
  },
];
