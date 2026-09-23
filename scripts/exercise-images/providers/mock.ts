/**
 * Offline provider for dry runs of the whole flow and for tests: returns the
 * exercise reference itself (upscaled by post-processing) so manifest, QA
 * plumbing, review page and apply can be exercised without any API call.
 */
import fs from 'node:fs';
import type {
  ExerciseImageProvider,
  GenerateRequest,
  GenerateResult,
  QaProvider,
  QaRequest,
} from '../provider';

export class MockProvider implements ExerciseImageProvider {
  readonly name = 'mock';
  readonly usesReferences = true;
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const ref = req.references.find((r) => r.role === 'exercise') ?? req.references[0];
    return { image: fs.readFileSync(ref.path), mime: 'image/jpeg', providerRef: 'mock' };
  }
}

export class MockQaProvider implements QaProvider {
  readonly name = 'mock-qa';
  async review(req: QaRequest): Promise<unknown> {
    void req;
    return {
      passed: true,
      score: 9,
      exerciseCorrect: true,
      equipmentCorrect: true,
      poseCorrect: true,
      anatomyCorrect: true,
      styleCorrect: true,
      identityConsistent: true,
      issues: [],
      retryInstruction: null,
    };
  }
}
