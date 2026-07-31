import { describe, expect, it } from 'vitest';
import {
  addCandidato,
  deleteCandidato,
  getCandidatoById,
  getCandidatos,
  updateCandidato,
} from '@/lib/candidates-store';

describe('candidates-store', () => {
  it('obtiene la lista inicial de candidatos', () => {
    const list = getCandidatos();
    expect(list.length).toBeGreaterThan(0);
  });

  it('filtra candidatos por estamento y por texto de búsqueda', () => {
    const docentes = getCandidatos({ estamento: 'docentes' });
    expect(docentes.every((c) => c.estamento === 'docentes')).toBe(true);

    const searchResult = getCandidatos({ search: 'Pablo Reyes' });
    expect(searchResult.length).toBeGreaterThanOrEqual(1);
    expect(searchResult[0].name).toContain('Pablo Reyes');
  });

  it('agrega un nuevo candidato con campos completos y foto de perfil', () => {
    const newCand = addCandidato({
      nombreCompleto: 'Test Candidate Suite',
      estamento: 'estudiantes',
      biografia: 'Estudiante destacado en debate escolar.',
      propuestaPrincipal: 'Fomentar ferias de ciencias inter-comunales.',
      escuelaEstablecimiento: 'Liceo Bicentenario',
      fotoPerfil: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    });

    expect(newCand.id).toBeDefined();
    expect(newCand.nombreCompleto).toBe('Test Candidate Suite');
    expect(newCand.estamento).toBe('estudiantes');
    expect(newCand.initials).toBe('TC');

    const fetched = getCandidatoById(newCand.id);
    expect(fetched).toBeDefined();
    expect(fetched?.biografia).toBe('Estudiante destacado en debate escolar.');
  });

  it('actualiza un candidato existente', () => {
    const newCand = addCandidato({
      nombreCompleto: 'Candidate For Edit',
      estamento: 'docentes',
      biografia: 'Bio original',
      propuestaPrincipal: 'Propuesta original',
      escuelaEstablecimiento: 'Escuela Original',
    });

    const updated = updateCandidato(newCand.id, {
      nombreCompleto: 'Candidate Updated Name',
      propuestaPrincipal: 'Nueva propuesta renovada',
    });

    expect(updated.nombreCompleto).toBe('Candidate Updated Name');
    expect(updated.propuestaPrincipal).toBe('Nueva propuesta renovada');
    expect(updated.biografia).toBe('Bio original');
  });

  it('elimina un candidato correctamente', () => {
    const newCand = addCandidato({
      nombreCompleto: 'Candidate For Delete',
      estamento: 'asistentes',
      biografia: 'Bio',
      propuestaPrincipal: 'Propuesta',
      escuelaEstablecimiento: 'Escuela',
    });

    const deleted = deleteCandidato(newCand.id);
    expect(deleted).toBe(true);

    const fetched = getCandidatoById(newCand.id);
    expect(fetched).toBeUndefined();
  });
});
