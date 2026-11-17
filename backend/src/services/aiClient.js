import { env } from '../config/env.js'

export const AI_DISCLAIMER = 'MediMind AI provides general educational information only. It is not medical advice, a diagnosis, or a treatment plan.'
export const EMERGENCY_MESSAGE = 'If this is a medical emergency, call 1990 (Suwa Seriya) or your local emergency number, or go to the nearest hospital immediately.'

const EMERGENCY_TERMS = ['chest pain', 'can\'t breathe', 'cannot breathe', 'difficulty breathing', 'unconscious', 'severe bleeding', 'suicide', 'kill myself', 'overdose', 'stroke', 'seizure', 'heart attack']

export function isEmergency(text) {
  const lower = text.toLowerCase()
  return EMERGENCY_TERMS.some(term => lower.includes(term))
}

export class AiServiceError extends Error {}

// Internal service-to-service call. Only Express talks to FastAPI, never the browser.
export async function callAiService(path, payload) {
  let response
  try {
    response = await fetch(`${env.aiServiceUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(env.aiServiceKey ? { 'X-Service-Key': env.aiServiceKey } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(env.aiTimeoutMs),
    })
  } catch (error) {
    throw new AiServiceError(error.name === 'TimeoutError' ? 'AI service timed out' : 'AI service unreachable')
  }
  if (!response.ok) throw new AiServiceError(`AI service responded with ${response.status}`)
  try {
    return await response.json()
  } catch {
    throw new AiServiceError('AI service returned an invalid response')
  }
}

export function fallbackAnswer(question) {
  return {
    answer: isEmergency(question)
      ? `${EMERGENCY_MESSAGE} The MediMind assistant is temporarily unavailable, so please do not wait for an online answer.`
      : 'The MediMind AI assistant is temporarily unavailable. Please try again in a few minutes, or speak with your doctor about this question at your next appointment.',
    sources: [],
    disclaimer: AI_DISCLAIMER,
    emergency: isEmergency(question),
    fallback: true,
  }
}
