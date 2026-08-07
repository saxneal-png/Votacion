import { beforeEach, describe, expect, it } from 'vitest';

import {
  consumeTempToken,
  createTempToken,
  generateBlindJwtToken,
  markVotoEmitido,
  validateApoderadoAuth,
  validateFuncionarioAuth,
} from '@/services/authRulesService';
import { addSingleVoter, clearPadronStore, getPadronRecords } from '@/lib/padron-store';

describe('Motor de Reglas de Autenticación, Multirrol y Sufragio Único (Decreto 102)', () => {
  beforeEach(() => {
    clearPadronStore();
    addSingleVoter({
      rutVotante: '12.345.678-5',
      rutEstudianteAsociado: '23.456.789-6',
      nombreCompleto: 'Verónica Alarcón Fuentes',
      estamento: 'PADRES_APODERADOS',
      rbdEstablecimiento: '10202',
      nombreEstablecimiento: 'Escuela Martín Prado',
    });
    addSingleVoter({
      rutVotante: '16.940.271-K',
      nombreCompleto: 'María González Pérez',
      estamento: 'DOCENTES',
      rbdEstablecimiento: '10202',
      nombreEstablecimiento: 'Escuela Martín Prado',
    });
    const records = getPadronRecords().records;
    records.forEach((r) => {
      r.haVotado = false;
      r.habilitado = true;
    });
  });


  describe('Regla A: Estamento Padres y Apoderados', () => {
    it('valida correctamente el par (Apoderado 12345678-5, Estudiante 23456789-6)', () => {
      const record = validateApoderadoAuth('12.345.678-5', '23.456.789-6', 'apoderado@gmail.com');
      expect(record).toBeDefined();
      expect(record.estamento).toBe('PADRES_APODERADOS');
      expect(record.formattedRutVotante).toBe('12.345.678-5');
    });

    it('rechaza cuando el RUN de estudiante no coincide con el apoderado', () => {
      expect(() => {
        validateApoderadoAuth('12345678-5', '99999999-9', 'apoderado@gmail.com');
      }).toThrow('El RUN del apoderado no se encuentra registrado o no está vinculado');
    });

    it('aplica Sufragio Único Multihijo: bloquea si cualquier registro del apoderado ya sufragó', () => {
      // Simular que el apoderado ya sufragó por su primer hijo
      markVotoEmitido('12345678-5', 'PADRES_APODERADOS');

      expect(() => {
        validateApoderadoAuth('12345678-5', '23456789-6', 'apoderado@gmail.com');
      }).toThrow('Usted ya emitió su voto correspondiente al estamento de Padres y Apoderados.');
    });
  });



  describe('Regla B: Estamento Funcionarios SLEP y Dominio Restrictivo', () => {
    it('exige obligatoriamente el dominio @eduvallediguillin.gob.cl', () => {
      expect(() => {
        validateFuncionarioAuth('16940271-k', 'docente@gmail.com');
      }).toThrow('Los funcionarios del SLEP deben ingresar obligatoriamente con su casilla institucional');
    });

    it('acepta la casilla institucional @eduvallediguillin.gob.cl para docente 16940271-k', () => {
      const record = validateFuncionarioAuth('16940271-k', 'maria.gonzalez@eduvallediguillin.gob.cl');
      expect(record).toBeDefined();
      expect(record.estamento).toBe('DOCENTES');
    });

    it('bloquea al funcionario si ya emitió su voto', () => {
      markVotoEmitido('16940271-k', 'DOCENTES');

      expect(() => {
        validateFuncionarioAuth('16940271-k', 'maria.gonzalez@eduvallediguillin.gob.cl');
      }).toThrow('Usted ya emitió su voto correspondiente al estamento de Funcionarios.');
    });
  });

  describe('Regla C: Independencia de Doble Rol (Docente + Apoderado) y Multirrol (Docente + Directivo)', () => {
    it('el sufragio como Apoderado no inhabilita el voto como Docente (roles independientes)', () => {
      // Marcar voto como Apoderado
      markVotoEmitido('16940271-k', 'PADRES_APODERADOS');

      // La validación como docente debe seguir siendo exitosa
      const docRecord = validateFuncionarioAuth('16940271-k', 'maria.gonzalez@eduvallediguillin.gob.cl');
      expect(docRecord).toBeDefined();
      expect(docRecord.haVotado).toBe(false);
    });

    it('permite a un docente registrado también como directivo votar en ambas papeletas', async () => {
      // Registrar segundo estamento DIRECTIVOS para el mismo RUN
      addSingleVoter({
        rutVotante: '16.940.271-K',
        nombreCompleto: 'María González Pérez',
        estamento: 'DIRECTIVOS',
        rbdEstablecimiento: '10202',
        nombreEstablecimiento: 'Escuela Martín Prado',
      });

      const records = getPadronRecords().records;
      const userRecords = records.filter((r) => r.rutVotante === '16940271K');
      expect(userRecords.length).toBe(2);

      // 1. Emitir voto en Docentes
      markVotoEmitido('16940271-k', 'DOCENTES');

      // 2. El estamento Directivos debe seguir pendiente
      const directivoRecord = userRecords.find((r) => r.estamento === 'DIRECTIVOS');
      expect(directivoRecord?.haVotado).toBe(false);

      // 3. Emitir voto en Directivos
      markVotoEmitido('16940271-k', 'DIRECTIVOS');

      // 4. Ambos deben estar marcados como votados
      expect(userRecords.every((r) => r.haVotado)).toBe(true);
    });
  });

  describe('Tokens Temporales de Uso Único y Token Ciego JWT', () => {
    it('crea y consume un temp_token de un solo uso', () => {
      const tempToken = createTempToken({
        rutVotante: '16940271-k',
        estamentoDestino: 'DOCENTES',
        rbdEstablecimiento: '10202',
        nombreEstablecimiento: 'Escuela Martín Prado',
        emailDestino: 'docente@eduvallediguillin.gob.cl',
      });

      expect(tempToken.token).toContain('slep-token-');

      // Consumo inicial (exitoso)
      const res1 = consumeTempToken(tempToken.token);
      expect(res1.valid).toBe(true);
      expect(res1.payload?.rutVotante).toBe('16940271-k');

      // Segundo consumo (debe fallar por uso único)
      const res2 = consumeTempToken(tempToken.token);
      expect(res2.valid).toBe(false);
      expect(res2.reason).toContain('inválido o ya fue utilizado');
    });

    it('genera un Token Ciego Anónimo JWT que oculta RUTs y datos personales', () => {
      const { blindToken, payload } = generateBlindJwtToken({
        estamento: 'PADRES_APODERADOS',
        rbdEstablecimiento: '10202',
      });

      expect(blindToken).toBeDefined();
      expect(blindToken.split('.').length).toBe(3);
      expect(payload.estamento).toBe('PADRES_APODERADOS');
      expect(payload.rbdEstablecimiento).toBe('10202');
      expect(payload.permisoVoto).toBe(true);
      expect(payload).not.toHaveProperty('rutVotante');
      expect(payload).not.toHaveProperty('nombreCompleto');
    });
  });
});
