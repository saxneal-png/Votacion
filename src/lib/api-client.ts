import type { Candidate, User } from '@/types';

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'same-origin',
  });

  if (!response.ok) {
    let message = 'No fue posible completar la solicitud.';

    try {
      const payload = (await response.json()) as { message?: string };
      message = payload.message ?? message;
    } catch {
      // Ignore JSON parsing errors and keep the generic message.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function verifyUserCredentials(
  rut: string,
  email: string,
  studentRut?: string,
  voterType?: 'apoderado' | 'funcionario',
): Promise<User> {
  const payload = await requestJson<{ user: User }>('/api/auth/verify-credentials', {
    method: 'POST',
    body: JSON.stringify({ rut, email, studentRut, voterType }),
  });

  return payload.user;
}

export async function verifyOtpCode(otp: string): Promise<void> {
  await requestJson<{ ok: true }>('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ otp }),
  });
}

export async function getCandidates(): Promise<Candidate[]> {
  return requestJson<Candidate[]>('/api/candidates', { method: 'GET' });
}

export async function submitVote(
  candidateId: string,
): Promise<{ receiptCode: string; candidate: Candidate }> {
  return requestJson<{ receiptCode: string; candidate: Candidate }>('/api/votes', {
    method: 'POST',
    body: JSON.stringify({ candidateId }),
  });
}

export async function resetSession(init?: RequestInit): Promise<void> {
  await requestJson<void>('/api/session', { method: 'DELETE', ...init });
}