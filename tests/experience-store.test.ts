import { learningApi } from '@/api/academics/learning';
import { AppApiError } from '@/api/client/error';
import { useLearningExperience } from '@/features/learning/experience-store';

jest.mock('@/api/academics/learning', () => ({ learningApi: { experience: jest.fn() } }));

const experience = learningApi.experience as jest.Mock;
const config = { mascot: { enabled: false, name: null, assetKey: null, messages: {} }, languages: ['en'], streakMilestones: [3] };

beforeEach(() => { useLearningExperience.getState().reset(); experience.mockReset(); });

const load = async () => { await useLearningExperience.getState().load(); return useLearningExperience.getState(); };

test('an explicit server decision is distinguished from a failure', async () => {
  experience.mockResolvedValueOnce({ enabled: true, experienceKey: 'VIDEO_LEARNING', config });
  expect(await load()).toMatchObject({ status: 'ready', outcome: 'enabled', enabled: true });
  useLearningExperience.getState().reset();
  experience.mockResolvedValueOnce({ enabled: false });
  expect(await load()).toMatchObject({ status: 'ready', outcome: 'disabled', enabled: false });
});

test.each([
  [new AppApiError('x', 404), 'route-missing'],
  [new AppApiError('x', 401), 'session-unavailable'],
  [new AppApiError('x', 500), 'request-failed'],
  [new AppApiError('x'), 'request-failed'],
])('failure %# falls back to standard and records %s', async (error, outcome) => {
  experience.mockRejectedValueOnce(error);
  expect(await load()).toMatchObject({ status: 'failed', outcome, enabled: false });
});

test('a malformed response never enables the institution UI', async () => {
  experience.mockResolvedValueOnce({ enabled: true, experienceKey: 'VIDEO_LEARNING' });
  expect(await load()).toMatchObject({ status: 'failed', outcome: 'unexpected-response', enabled: false });
});

test('reset clears the previous account decision', async () => {
  experience.mockResolvedValueOnce({ enabled: true, experienceKey: 'VIDEO_LEARNING', config });
  await load();
  useLearningExperience.getState().reset();
  expect(useLearningExperience.getState()).toMatchObject({ status: 'idle', outcome: null, enabled: false, config: null });
});
