import type { ExportMenuStrings } from '../../components/ui/ExportMenu';
import type { C360Strings } from '../../i18n/coachClient360';

/** The export panel's words for one scope ("session history", "strength results", "decisions"). */
export const exportStrings = (c: C360Strings, scope: string): ExportMenuStrings => ({
  button: c.exLabel,
  title: c.exTitle(scope),
  asShown: c.exAsShown,
  view: c.exView,
  viewHint: c.exViewHint,
  all: c.exAllRows,
  allHint: c.exAllHint,
  group: c.exRowsGroup,
  cols: c.exCols,
  leftOut: c.exLeftOut,
  leftOutNone: c.exLeftOutNone,
  cancel: c.exCancel,
  submit: c.exSubmit,
  empty: c.exEmpty,
});
