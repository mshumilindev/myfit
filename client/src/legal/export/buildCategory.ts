import { buildAccount, buildSharing } from './buildAccount';
import { buildBody } from './buildBody';
import { buildAtlas, buildTraining } from './buildTraining';
import type { CategoryResult, ExportCategory, ExportSources } from './exportModel';

/** One category's files and gaps from the sources. Reads only that category's part of `ExportSources`. */
export function buildCategory(
  id: ExportCategory,
  s: ExportSources,
  exportedAt: string,
): CategoryResult {
  switch (id) {
    case 'account':
      return buildAccount(s, exportedAt);
    case 'training':
      return buildTraining(s);
    case 'body':
      return buildBody(s);
    case 'atlas':
      return buildAtlas(s);
    case 'sharing':
      return buildSharing(s);
  }
}
