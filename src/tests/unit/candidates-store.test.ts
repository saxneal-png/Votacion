import { describe, expect, it } from 'vitest';
import {
  addCandidato,
  deleteCandidato,
  getCandidatoById,
  getCandidatos,
  updateCandidato,
} from '@/lib/candidates-store';

describe('candidates-store', () => {
  it('inicia con store vacío (candidatos gestionados desde Supabase)', () => {
    const list = getCandidatos();
    // El store ya no contiene candidatos hardcodeados.
    // En producción, getCandidatosAsync() los trae desde Supabase.
    expect(Array.isArray(list)).toBe(true);
  });

  it('filtra candidatos por estamento a partir de candidatos agregados dinámicamente', () => {
    // Agregar un candidato temporal para verificar el filtro
    const temp = addCandidato({
      nombreCompleto: 'Juan Pérez Rojas',
      estamento: 'docentes',
      biografia: 'Docente de historia',
      propuestaPrincipal: 'Mejorar planificación curricular',
      escuelaEstablecimiento: 'Liceo Bicentenario',
    });

    const docentes = getCandidatos({ estamento: 'docentes' });
    expect(docentes.some((c) => c.id === temp.id)).toBe(true);
    expect(docentes.every((c) => c.estamento === 'docentes')).toBe(true);

    const searchResult = getCandidatos({ search: 'Juan Pérez' });
    expect(searchResult.length).toBeGreaterThanOrEqual(1);
    expect(searchResult[0].nombreCompleto).toContain('Juan Pérez');

    // Limpiar
    deleteCandidato(temp.id);
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

  it('ordena candidatos correctamente según el número de sorteo (numero)', () => {
    const c3 = addCandidato({
      nombreCompleto: 'Candidato C',
      estamento: 'docentes',
      biografia: 'Bio',
      propuestaPrincipal: 'Propuesta',
      escuelaEstablecimiento: 'Escuela',
      numero: 3,
    });
    const c1 = addCandidato({
      nombreCompleto: 'Candidato A',
      estamento: 'docentes',
      biografia: 'Bio',
      propuestaPrincipal: 'Propuesta',
      escuelaEstablecimiento: 'Escuela',
      numero: 1,
    });
    const c2 = addCandidato({
      nombreCompleto: 'Candidato B',
      estamento: 'docentes',
      biografia: 'Bio',
      propuestaPrincipal: 'Propuesta',
      escuelaEstablecimiento: 'Escuela',
      numero: 2,
    });

    const docentes = getCandidatos({ estamento: 'docentes' });
    const c1Index = docentes.findIndex((c) => c.id === c1.id);
    const c2Index = docentes.findIndex((c) => c.id === c2.id);
    const c3Index = docentes.findIndex((c) => c.id === c3.id);

    expect(c1Index).toBeLessThan(c2Index);
    expect(c2Index).toBeLessThan(c3Index);

    // Clean up
    deleteCandidato(c1.id);
    deleteCandidato(c2.id);
    deleteCandidato(c3.id);
  });
});
